"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResourceGroupOwners = getResourceGroupOwners;
exports.getRgLifecycle = getRgLifecycle;
exports.getServiceMetadata = getServiceMetadata;
exports.getServiceOwners = getServiceOwners;
const arm_resources_1 = require("@azure/arm-resources");
const arm_monitor_1 = require("@azure/arm-monitor");
const azure_credential_service_1 = require("./azure-credential.service");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// ─── Cache ───────────────────────────────────────────────────────────────────
// Owner/tag data changes rarely — cache for 30 minutes.
const CACHE_TTL_MS = 30 * 60 * 1000;
let rgOwnerCache = null;
// key: resourceType (lower-cased) → ServiceMetadata
let serviceMetadataCache = null;
// Activity log creators: rgName (lower-cased) → caller display
let rgCreatorCache = null;
// Service creators: resourceType (lower-cased) → caller display
let svcCreatorCache = null;
// RG creation timestamps: rgName (lower-cased) → ISO date string (earliest write event)
let rgCreatedAtCache = null;
// RG deletion timestamps: rgName (lower-cased) → ISO date string
let rgDeletedAtCache = null;
// Active RG names (lower-cased) from ARM list
let rgActiveSetCache = null;
// ─── Tag key candidates (case-insensitive lookup) ─────────────────────────────
const OWNER_TAG_KEYS = ['createdby', 'created_by', 'created-by', 'owner', 'creator', 'responsible'];
const ENV_TAG_KEYS = ['environment', 'env', 'stage', 'deployment-environment', 'deploymentenvironment', 'deploymentring'];
const BUILD_TAG_KEYS = ['buildnumber', 'build_number', 'build-number', 'build', 'release', 'releasename',
    'release_name', 'version', 'appversion', 'app-version', 'pipeline', 'pipelinename', 'pipeline-name'];
function extractTagValue(tags, keys) {
    if (!tags)
        return undefined;
    for (const [k, v] of Object.entries(tags)) {
        if (keys.includes(k.toLowerCase()) && v)
            return v;
    }
    return undefined;
}
const extractOwner = (tags) => extractTagValue(tags, OWNER_TAG_KEYS);
const extractEnv = (tags) => extractTagValue(tags, ENV_TAG_KEYS);
const extractBuildInfo = (tags) => extractTagValue(tags, BUILD_TAG_KEYS);
/**
 * Strips service principal / managed identity noise from activity log caller strings.
 * e.g. "john.doe@contoso.com" stays, "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" → "Service Principal"
 */
function formatCaller(caller) {
    if (!caller)
        return undefined;
    // UUID-only strings are service principal object IDs — make them readable
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caller.trim())) {
        return 'Service Principal';
    }
    return caller.trim() || undefined;
}
// ─── Activity Log creator look-up ────────────────────────────────────────────
/**
 * Queries the Azure Monitor Activity Log (last 90 days) for successful write
 * operations on resource groups and individual resources.
 *
 * Returns two maps:
 *  - rgCreators:  rgName.toLowerCase()       → caller
 *  - svcCreators: resourceType.toLowerCase() → caller (first/most common creator found)
 */
async function getActivityLogCreators(subscriptionId) {
    const rgCreators = new Map();
    const svcCreators = new Map();
    // rgName → earliest write timestamp (ISO)
    const rgCreatedAt = new Map();
    // rgName → delete timestamp (ISO)
    const rgDeletedAt = new Map();
    // Activity logs are retained for 90 days
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 88 * 24 * 60 * 60 * 1000);
    const filter = `eventTimestamp ge '${startTime.toISOString()}' and ` +
        `eventTimestamp le '${endTime.toISOString()}' and ` +
        `status eq 'Succeeded'`;
    try {
        const monitor = new arm_monitor_1.MonitorClient((0, azure_credential_service_1.getAzureCredential)(), subscriptionId);
        const svcCallerTally = new Map();
        for await (const event of monitor.activityLogs.list(filter, { select: 'caller,operationName,resourceGroupName,resourceType,status,eventTimestamp' })) {
            const op = (event.operationName?.value ?? '').toLowerCase();
            const rgName = (event.resourceGroupName ?? '').toLowerCase();
            const rtName = (event.resourceType?.value ?? '').toLowerCase();
            const ts = event.eventTimestamp?.toISOString();
            const caller = formatCaller(event.caller ?? undefined);
            // ── Resource group create ──────────────────────────────────────────────
            if (op === 'microsoft.resources/subscriptions/resourcegroups/write' && rgName) {
                if (caller && !rgCreators.has(rgName))
                    rgCreators.set(rgName, caller);
                // Keep the earliest write timestamp as creation date
                if (ts && (!rgCreatedAt.has(rgName) || ts < rgCreatedAt.get(rgName))) {
                    rgCreatedAt.set(rgName, ts);
                }
            }
            // ── Resource group delete ──────────────────────────────────────────────
            if (op === 'microsoft.resources/subscriptions/resourcegroups/delete' && rgName && ts) {
                if (!rgDeletedAt.has(rgName) || ts > rgDeletedAt.get(rgName)) {
                    rgDeletedAt.set(rgName, ts);
                }
            }
            // ── Per-service writer (tally to pick the most-common caller) ──────────
            if (caller && op.endsWith('/write') && rtName && !rtName.startsWith('microsoft.resources/')) {
                if (!svcCallerTally.has(rtName))
                    svcCallerTally.set(rtName, new Map());
                const tally = svcCallerTally.get(rtName);
                tally.set(caller, (tally.get(caller) ?? 0) + 1);
            }
        }
        for (const [rt, tally] of svcCallerTally) {
            let top = '';
            let topCount = 0;
            for (const [caller, count] of tally) {
                if (count > topCount) {
                    top = caller;
                    topCount = count;
                }
            }
            if (top)
                svcCreators.set(rt, top);
        }
        logger_1.logger.info(`Activity log: creators for ${rgCreators.size} RGs, ${svcCreators.size} resource types; lifecycle for ${rgCreatedAt.size} RG creates, ${rgDeletedAt.size} RG deletes`);
    }
    catch (err) {
        const status = err?.statusCode ?? err?.code;
        if (status === 403 || status === 'AuthorizationFailed') {
            logger_1.logger.warn('Permission denied reading activity logs — assign "Monitoring Reader" role to service principal for creator info');
        }
        else {
            logger_1.logger.warn('Unable to fetch activity log creators (non-critical)', { err: String(err) });
        }
    }
    return { rgCreators, svcCreators, rgCreatedAt, rgDeletedAt };
}
// ─── Resource Group owners ───────────────────────────────────────────────────
/**
/**
 * Returns a map of resource-group-name (lower-cased) → owner string.
 * Priority: owner tag on the RG → activity log creator fallback.
 */
async function getResourceGroupOwners(subscriptionId) {
    if (rgOwnerCache && Date.now() - rgOwnerCache.cachedAt < CACHE_TTL_MS) {
        return rgOwnerCache.data;
    }
    const subId = subscriptionId ?? env_1.env.AZURE_SUBSCRIPTION_ID;
    const client = new arm_resources_1.ResourceManagementClient((0, azure_credential_service_1.getAzureCredential)(), subId);
    const ownerMap = new Map();
    let tagFetchSucceeded = false;
    const activeRgSet = new Set();
    try {
        for await (const rg of client.resourceGroups.list()) {
            const name = rg.name?.toLowerCase();
            if (name)
                activeRgSet.add(name);
            const owner = extractOwner(rg.tags);
            if (name && owner) {
                ownerMap.set(name, owner);
            }
        }
        tagFetchSucceeded = true;
        rgActiveSetCache = { data: activeRgSet, cachedAt: Date.now() };
        logger_1.logger.info(`Loaded owner tags for ${ownerMap.size} resource groups (tag-based); ${activeRgSet.size} active RGs`);
    }
    catch (err) {
        const status = err?.statusCode ?? err?.code;
        if (status === 403 || status === 'AuthorizationFailed') {
            logger_1.logger.error('Permission denied listing resource group tags — service principal needs Reader role on the subscription', { err });
        }
        else {
            logger_1.logger.warn('Failed to fetch resource group tags', { err });
        }
    }
    // Fallback: activity log creators for RGs that have no owner tag
    if (rgCreatorCache && Date.now() - rgCreatorCache.cachedAt < CACHE_TTL_MS &&
        rgCreatedAtCache && rgDeletedAtCache) {
        for (const [rg, creator] of rgCreatorCache.data) {
            if (!ownerMap.has(rg))
                ownerMap.set(rg, creator);
        }
    }
    else {
        // Fetch activity log creators + lifecycle timestamps
        const { rgCreators, svcCreators, rgCreatedAt, rgDeletedAt } = await getActivityLogCreators(subId);
        rgCreatorCache = { data: rgCreators, cachedAt: Date.now() };
        svcCreatorCache = { data: svcCreators, cachedAt: Date.now() };
        rgCreatedAtCache = { data: rgCreatedAt, cachedAt: Date.now() };
        rgDeletedAtCache = { data: rgDeletedAt, cachedAt: Date.now() };
        for (const [rg, creator] of rgCreators) {
            if (!ownerMap.has(rg))
                ownerMap.set(rg, creator);
        }
    }
    logger_1.logger.info(`RG owner map: ${ownerMap.size} entries (tags + activity log)`);
    // Only cache if either tag fetch worked or we have data — don't cache empty-on-error
    if (tagFetchSucceeded || ownerMap.size > 0) {
        rgOwnerCache = { data: ownerMap, cachedAt: Date.now() };
    }
    return ownerMap;
}
// ─── RG lifecycle ─────────────────────────────────────────────────────────────
/**
 * Returns a map of rgName (lower-cased) → { createdAt?, isActive }.
 * Relies on caches populated by getResourceGroupOwners() having been called first;
 * if not yet populated, calls getResourceGroupOwners() to trigger the fill.
 */
async function getRgLifecycle(subscriptionId) {
    const subId = subscriptionId ?? env_1.env.AZURE_SUBSCRIPTION_ID;
    // Ensure caches are warm
    if (!rgCreatedAtCache || !rgActiveSetCache) {
        await getResourceGroupOwners(subId);
    }
    const result = new Map();
    // Merge all known RG names from active set + creation log
    const allNames = new Set();
    if (rgActiveSetCache)
        for (const n of rgActiveSetCache.data)
            allNames.add(n);
    if (rgCreatedAtCache)
        for (const n of rgCreatedAtCache.data.keys())
            allNames.add(n);
    if (rgDeletedAtCache)
        for (const n of rgDeletedAtCache.data.keys())
            allNames.add(n);
    for (const name of allNames) {
        result.set(name, {
            createdAt: rgCreatedAtCache?.data.get(name),
            isActive: rgActiveSetCache?.data.has(name) ?? true,
        });
    }
    return result;
}
// ─── Resource service metadata (owner + environment + build info) ─────────────
/**
 * Returns a map of resourceType (lower-cased) → ServiceMetadata,
 * derived from tags on individual resources. A single Azure API pass
 * collects owner, environment, and build-related tags, using
 * majority-vote per resource type to pick a representative value.
 */
async function getServiceMetadata(subscriptionId) {
    if (serviceMetadataCache && Date.now() - serviceMetadataCache.cachedAt < CACHE_TTL_MS) {
        return serviceMetadataCache.data;
    }
    const subId = subscriptionId ?? env_1.env.AZURE_SUBSCRIPTION_ID;
    const client = new arm_resources_1.ResourceManagementClient((0, azure_credential_service_1.getAzureCredential)(), subId);
    const ownerTally = new Map();
    const envTally = new Map();
    const buildTally = new Map();
    let tagFetchSucceeded = false;
    function tally(map, key, value) {
        if (!map.has(key))
            map.set(key, new Map());
        const inner = map.get(key);
        inner.set(value, (inner.get(value) ?? 0) + 1);
    }
    function topValue(map, key) {
        const inner = map.get(key);
        if (!inner)
            return undefined;
        let top = '';
        let topCount = 0;
        for (const [val, cnt] of inner) {
            if (cnt > topCount) {
                top = val;
                topCount = cnt;
            }
        }
        return top || undefined;
    }
    try {
        for await (const resource of client.resources.list()) {
            if (!resource.type)
                continue;
            const key = resource.type.toLowerCase();
            const owner = extractOwner(resource.tags);
            const env_ = extractEnv(resource.tags);
            const build = extractBuildInfo(resource.tags);
            if (owner)
                tally(ownerTally, key, owner);
            if (env_)
                tally(envTally, key, env_);
            if (build)
                tally(buildTally, key, build);
        }
        tagFetchSucceeded = true;
        logger_1.logger.info(`Loaded service metadata across ${ownerTally.size} distinct resource types (tag-based)`);
    }
    catch (err) {
        const status = err?.statusCode ?? err?.code;
        if (status === 403 || status === 'AuthorizationFailed') {
            logger_1.logger.error('Permission denied listing resources — service principal needs Reader role on the subscription', { err });
        }
        else {
            logger_1.logger.warn('Failed to fetch resource tags', { err });
        }
    }
    const allKeys = new Set([...ownerTally.keys(), ...envTally.keys(), ...buildTally.keys()]);
    const result = new Map();
    for (const key of allKeys) {
        result.set(key, {
            owner: topValue(ownerTally, key),
            environment: topValue(envTally, key),
            buildInfo: topValue(buildTally, key),
        });
    }
    // Fallback: fill in owners from activity log creators for types without a tag-based owner
    const svcCreators = svcCreatorCache && Date.now() - svcCreatorCache.cachedAt < CACHE_TTL_MS
        ? svcCreatorCache.data
        : null;
    if (svcCreators) {
        for (const [rt, creator] of svcCreators) {
            if (!result.has(rt)) {
                result.set(rt, { owner: creator });
            }
            else {
                const existing = result.get(rt);
                if (!existing.owner)
                    existing.owner = creator;
            }
        }
    }
    logger_1.logger.info(`Service metadata: ${result.size} resource types enriched (tags + activity log)`);
    // Only cache if tags were fetched successfully or we have useful data;
    // don't cache empty results caused by transient errors
    if (tagFetchSucceeded || result.size > 0) {
        serviceMetadataCache = { data: result, cachedAt: Date.now() };
    }
    return result;
}
/**
 * Thin wrapper kept for any callers that only need the owner map.
 */
async function getServiceOwners(subscriptionId) {
    const meta = await getServiceMetadata(subscriptionId);
    const out = new Map();
    for (const [key, { owner }] of meta) {
        if (owner)
            out.set(key, owner);
    }
    return out;
}
//# sourceMappingURL=resource-metadata.service.js.map