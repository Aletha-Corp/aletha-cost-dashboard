import { CostManagementClient, KnownGranularityType, KnownQueryColumnType, KnownExportType } from '@azure/arm-costmanagement';
import { getAzureCredential } from './azure-credential.service';
import { getResourceGroupOwners, getServiceMetadata, getRgLifecycle } from './resource-metadata.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type {
  CostEntry,
  CostQueryParams,
  CostSummary,
  DailyCost,
  ResourceGroupCost,
  ServiceCost,
} from '../types/cost.types';

// ─── In-memory cache & request coalescing ───────────────────────────────────
// Prevents multiple simultaneous page loads from hammering the Azure Cost
// Management API (which has aggressive rate limits).
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const rawDataCache = new Map<string, { data: CostEntry[]; cachedAt: number }>();
const inFlight = new Map<string, Promise<CostEntry[]>>();

function buildCacheKey(params: CostQueryParams): string {
  return `${params.subscriptionId ?? env.AZURE_SUBSCRIPTION_ID}::${params.startDate}::${params.endDate}`;
}

/**
 * Fetches raw cost data from Azure Cost Management API for the given date range.
 * Uses ClientSecretCredential with read-only Cost Management Reader permissions.
 *
 * Results are cached for 5 minutes and simultaneous requests for the same key
 * are coalesced into a single Azure API call to avoid 429 rate-limit errors.
 */
async function fetchRawCostData(params: CostQueryParams): Promise<CostEntry[]> {
  const key = buildCacheKey(params);

  // Return from cache if still fresh
  const cached = rawDataCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    logger.info('Returning cost data from cache', { key });
    return cached.data;
  }

  // If an identical request is already in-flight, wait for it
  const existing = inFlight.get(key);
  if (existing) {
    logger.info('Coalescing into in-flight Azure cost request', { key });
    return existing;
  }

  const promise = doFetchRawCostData(params).then((data) => {
    rawDataCache.set(key, { data, cachedAt: Date.now() });
    return data;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

async function doFetchRawCostData(params: CostQueryParams): Promise<CostEntry[]> {
  const msPerDay = 86_400_000;
  const spanDays = (new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / msPerDay;

  // Azure Cost Management API hard-limits queries to exactly 1 year.
  // For ranges longer than 365 days, split into yearly windows and merge.
  if (spanDays > 365) {
    logger.info(`Range spans ${Math.round(spanDays)} days — splitting into yearly chunks`);
    const chunks: Array<{ startDate: string; endDate: string }> = [];
    let cursor = new Date(params.startDate);
    const end = new Date(params.endDate);
    while (cursor < end) {
      const chunkEnd = new Date(cursor);
      chunkEnd.setFullYear(chunkEnd.getFullYear() + 1);
      chunkEnd.setDate(chunkEnd.getDate() - 1); // one day before the next year start
      const actualEnd = chunkEnd < end ? chunkEnd : end;
      chunks.push({
        startDate: cursor.toISOString().slice(0, 10),
        endDate:   actualEnd.toISOString().slice(0, 10),
      });
      cursor = new Date(chunkEnd);
      cursor.setDate(cursor.getDate() + 1);
    }
    const results: CostEntry[][] = [];
    for (const c of chunks) {
      results.push(await doFetchRawCostData({ ...params, startDate: c.startDate, endDate: c.endDate }));
      // Brief pause between chunks to avoid 429 rate-limit errors
      if (chunks.indexOf(c) < chunks.length - 1) await new Promise((r) => setTimeout(r, 1500));
    }
    return results.flat();
  }

  const credential = getAzureCredential();
  const client = new CostManagementClient(credential);

  const subscriptionId = params.subscriptionId ?? env.AZURE_SUBSCRIPTION_ID;
  const scope = `/subscriptions/${subscriptionId}`;

  // Use monthly granularity for ranges > 90 days to keep response sizes manageable.
  const granularity = (spanDays > 90 ? 'Monthly' : KnownGranularityType.Daily) as KnownGranularityType;

  logger.info('Fetching cost data from Azure', {
    scope,
    startDate: params.startDate,
    endDate: params.endDate,
    granularity,
  });

  const queryResult = await client.query.usage(scope, {
    type: KnownExportType.ActualCost,
    timeframe: 'Custom',
    timePeriod: {
      from: new Date(params.startDate),
      to: new Date(params.endDate),
    },
    dataset: {
      granularity,
      aggregation: {
        totalCost: { name: 'Cost', function: 'Sum' },
      },
      grouping: [
        { type: KnownQueryColumnType.Dimension, name: 'ResourceGroup' },
        { type: KnownQueryColumnType.Dimension, name: 'ResourceType' },
        { type: KnownQueryColumnType.Dimension, name: 'ServiceName' },
        { type: KnownQueryColumnType.Dimension, name: 'ResourceLocation' },
        { type: KnownQueryColumnType.Dimension, name: 'SubscriptionId' },
        { type: KnownQueryColumnType.Dimension, name: 'SubscriptionName' },
      ],
    },
  });

  const entries: CostEntry[] = [];

  if (!queryResult.rows || !queryResult.columns) {
    logger.warn('No cost data returned from Azure Cost Management API');
    return entries;
  }

  // Build a column name → index map for robust parsing
  const colIndex: Record<string, number> = {};
  queryResult.columns.forEach((col, idx) => {
    if (col.name) colIndex[col.name.toLowerCase()] = idx;
  });

  const costIdx = colIndex['cost'] ?? colIndex['totalcost'] ?? 0;
  const dateIdx = colIndex['usagedate'] ?? colIndex['billingmonth'] ?? colIndex['billingperiodstartdate'] ?? 1;
  const rgIdx = colIndex['resourcegroup'] ?? -1;
  const rtIdx = colIndex['resourcetype'] ?? -1;
  const snIdx = colIndex['servicename'] ?? -1;
  const subIdIdx = colIndex['subscriptionid'] ?? -1;
  const subNameIdx = colIndex['subscriptionname'] ?? -1;
  const currencyIdx = colIndex['currency'] ?? -1;
  const locationIdx = colIndex['resourcelocation'] ?? -1;

  for (const row of queryResult.rows) {
    const rawDate = String(row[dateIdx] ?? '');
    const usageDate =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

    const rawRg = rgIdx >= 0 ? String(row[rgIdx] ?? '') : '';
    const resourceGroup = rawRg === '' || rawRg.toLowerCase() === 'unassigned' ? null : rawRg;

    entries.push({
      resourceId: '',
      resourceGroup,
      resourceType: rtIdx >= 0 ? String(row[rtIdx] ?? '') : '',
      serviceName: snIdx >= 0 ? String(row[snIdx] ?? '') : '',
      cost: parseFloat(String(row[costIdx] ?? 0)) || 0,
      currency: currencyIdx >= 0 ? String(row[currencyIdx] ?? 'USD') : 'USD',
      usageDate,
      subscriptionId: subIdIdx >= 0 ? String(row[subIdIdx] ?? subscriptionId) : subscriptionId,
      subscriptionName: subNameIdx >= 0 ? String(row[subNameIdx] ?? '') : '',
      region: locationIdx >= 0 ? String(row[locationIdx] ?? '') : '',
      tags: {},
    });
  }

  logger.info(`Parsed ${entries.length} cost entries`);
  return entries;
}

/**
 * Returns cost entries grouped by resource group, enriched with owner info from tags.
 */
export async function getCostsByResourceGroup(
  params: CostQueryParams
): Promise<ResourceGroupCost[]> {
  const [entries, rgOwners, svcMeta, rgLifecycle] = await Promise.all([
    fetchRawCostData(params),
    getResourceGroupOwners(params.subscriptionId),
    getServiceMetadata(params.subscriptionId),
    getRgLifecycle(params.subscriptionId),
  ]);

  const rgMap = new Map<string, {
    totalCost: number;
    currency: string;
    subscriptionId: string;
    services: Map<string, ServiceCost & { regionSet: Set<string>; minDate: string; maxDate: string }>;
  }>();

  for (const entry of entries) {
    const rgKey = entry.resourceGroup ?? 'None';
    if (!rgMap.has(rgKey)) {
      rgMap.set(rgKey, { totalCost: 0, currency: entry.currency, subscriptionId: entry.subscriptionId, services: new Map() });
    }
    const rg = rgMap.get(rgKey)!;
    rg.totalCost += entry.cost;

    const svcKey = `${entry.serviceName}::${entry.resourceType}`;
    if (!rg.services.has(svcKey)) {
      const meta = svcMeta.get(entry.resourceType.toLowerCase());
      rg.services.set(svcKey, {
        serviceName: entry.serviceName,
        resourceType: entry.resourceType,
        totalCost: 0,
        currency: entry.currency,
        resourceCount: 0,
        owner:       meta?.owner,
        environment: meta?.environment,
        buildInfo:   meta?.buildInfo,
        regionSet:   new Set(),
        minDate:     entry.usageDate,
        maxDate:     entry.usageDate,
      });
    }
    const svc = rg.services.get(svcKey)!;
    svc.totalCost += entry.cost;
    svc.resourceCount += 1;
    if (entry.region) svc.regionSet.add(entry.region);
    if (entry.usageDate < svc.minDate) svc.minDate = entry.usageDate;
    if (entry.usageDate > svc.maxDate) svc.maxDate = entry.usageDate;
  }

  return Array.from(rgMap.entries())
    .map(([resourceGroup, data]) => {
      const lc = rgLifecycle.get(resourceGroup.toLowerCase());
      return {
        resourceGroup,
        totalCost: Math.round(data.totalCost * 100) / 100,
        currency: data.currency,
        subscriptionId: data.subscriptionId,
        owner:     rgOwners.get(resourceGroup.toLowerCase()),
        createdAt: lc?.createdAt,
        isActive:  lc?.isActive,
        services: Array.from(data.services.values())
          .map(({ regionSet, minDate, maxDate, ...s }) => ({
            ...s,
            totalCost: Math.round(s.totalCost * 100) / 100,
            regions:   regionSet.size > 0 ? Array.from(regionSet).sort() : undefined,
            firstSeen: minDate,
            lastSeen:  maxDate,
          }))
          .sort((a, b) => b.totalCost - a.totalCost),
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Returns a high-level cost summary for the date range.
 */
export async function getCostSummary(params: CostQueryParams): Promise<CostSummary> {
  const entries = await fetchRawCostData(params);

  let totalCost = 0;
  let currency = 'USD';
  const rgSet = new Set<string>();
  const svcSet = new Set<string>();
  const dailyMap = new Map<string, number>();
  const rgCostMap = new Map<string, number>();
  const svcCostMap = new Map<string, ServiceCost>();

  for (const entry of entries) {
    totalCost += entry.cost;
    currency = entry.currency;

    const rgKey = entry.resourceGroup ?? 'None';
    rgSet.add(rgKey);
    rgCostMap.set(rgKey, (rgCostMap.get(rgKey) ?? 0) + entry.cost);

    const svcKey = `${entry.serviceName}::${entry.resourceType}`;
    svcSet.add(svcKey);
    if (!svcCostMap.has(svcKey)) {
      svcCostMap.set(svcKey, {
        serviceName: entry.serviceName,
        resourceType: entry.resourceType,
        totalCost: 0,
        currency: entry.currency,
        resourceCount: 0,
      });
    }
    const svc = svcCostMap.get(svcKey)!;
    svc.totalCost += entry.cost;
    svc.resourceCount += 1;

    dailyMap.set(entry.usageDate, (dailyMap.get(entry.usageDate) ?? 0) + entry.cost);
  }

  const topResourceGroups: ResourceGroupCost[] = Array.from(rgCostMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([resourceGroup, cost]) => ({
      resourceGroup,
      totalCost: Math.round(cost * 100) / 100,
      currency,
      services: [],
    }));

  const topServices: ServiceCost[] = Array.from(svcCostMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)
    .map((s) => ({ ...s, totalCost: Math.round(s.totalCost * 100) / 100 }));

  const dailyCosts: DailyCost[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100, currency }));

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
    periodStart: params.startDate,
    periodEnd: params.endDate,
    resourceGroupCount: rgSet.size,
    serviceCount: svcSet.size,
    topResourceGroups,
    topServices,
    dailyCosts,
  };
}

/**
 * Fetches all raw cost entries (used for detailed table views).
 */
export async function getAllCostEntries(params: CostQueryParams): Promise<CostEntry[]> {
  return fetchRawCostData(params);
}

/**
 * Returns costs aggregated by employee/owner, derived from resource group and
 * resource-level owner tags (CreatedBy, Owner, Creator, etc.).
 *
 * Attribution priority:
 *   1. Resource group has an owner tag → entire RG cost attributed to that owner
 *   2. No RG owner, but resource type has an owner tag → that service's cost goes to that owner
 *   3. Neither → attributed to 'Unassigned'
 */
export async function getCostsByOwner(params: CostQueryParams) {
  const [entries, rgOwners, svcMeta] = await Promise.all([
    fetchRawCostData(params),
    getResourceGroupOwners(params.subscriptionId),
    getServiceMetadata(params.subscriptionId),
  ]);

  // owner → { totalCost, currency, rgs: Map<name,cost>, svcs: Map<key, svc> }
  const ownerMap = new Map<string, {
    totalCost: number;
    currency: string;
    rgs: Map<string, number>;
    svcs: Map<string, { serviceName: string; resourceType: string; totalCost: number; currency: string; resourceCount: number }>;
  }>();

  function getOrCreate(owner: string, currency: string) {
    if (!ownerMap.has(owner)) {
      ownerMap.set(owner, { totalCost: 0, currency, rgs: new Map(), svcs: new Map() });
    }
    return ownerMap.get(owner)!;
  }

  for (const entry of entries) {
    const rgKey = entry.resourceGroup ?? 'None';
    const rgOwner = rgOwners.get(rgKey.toLowerCase());
    const svcOwner = svcMeta.get(entry.resourceType.toLowerCase())?.owner;
    const owner = rgOwner ?? svcOwner ?? 'Unassigned';

    const bucket = getOrCreate(owner, entry.currency);
    bucket.totalCost += entry.cost;

    bucket.rgs.set(rgKey, (bucket.rgs.get(rgKey) ?? 0) + entry.cost);

    const svcKey = `${entry.serviceName}::${entry.resourceType}`;
    if (!bucket.svcs.has(svcKey)) {
      bucket.svcs.set(svcKey, {
        serviceName: entry.serviceName,
        resourceType: entry.resourceType,
        totalCost: 0,
        currency: entry.currency,
        resourceCount: 0,
      });
    }
    const svc = bucket.svcs.get(svcKey)!;
    svc.totalCost += entry.cost;
    svc.resourceCount += 1;
  }

  return Array.from(ownerMap.entries())
    .map(([owner, data]) => ({
      owner,
      totalCost: Math.round(data.totalCost * 100) / 100,
      currency: data.currency,
      resourceGroupCount: data.rgs.size,
      serviceCount: data.svcs.size,
      resourceGroups: Array.from(data.rgs.entries())
        .map(([name, totalCost]) => ({ name, totalCost: Math.round(totalCost * 100) / 100 }))
        .sort((a, b) => b.totalCost - a.totalCost),
      services: Array.from(data.svcs.values())
        .map((s) => ({ ...s, totalCost: Math.round(s.totalCost * 100) / 100 }))
        .sort((a, b) => b.totalCost - a.totalCost),
    }))
    .sort((a, b) => {
      // Always put Unassigned last
      if (a.owner === 'Unassigned') return 1;
      if (b.owner === 'Unassigned') return -1;
      return b.totalCost - a.totalCost;
    });
}

