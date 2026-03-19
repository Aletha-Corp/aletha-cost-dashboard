import type { CostEntry, CostQueryParams, CostSummary, ResourceGroupCost } from '../types/cost.types';
/**
 * Returns cost entries grouped by resource group, enriched with owner info from tags.
 */
export declare function getCostsByResourceGroup(params: CostQueryParams): Promise<ResourceGroupCost[]>;
/**
 * Returns a high-level cost summary for the date range.
 */
export declare function getCostSummary(params: CostQueryParams): Promise<CostSummary>;
/**
 * Fetches all raw cost entries (used for detailed table views).
 */
export declare function getAllCostEntries(params: CostQueryParams): Promise<CostEntry[]>;
/**
 * Returns costs aggregated by employee/owner, derived from resource group and
 * resource-level owner tags (CreatedBy, Owner, Creator, etc.).
 *
 * Attribution priority:
 *   1. Resource group has an owner tag → entire RG cost attributed to that owner
 *   2. No RG owner, but resource type has an owner tag → that service's cost goes to that owner
 *   3. Neither → attributed to 'Unassigned'
 */
export declare function getCostsByOwner(params: CostQueryParams): Promise<{
    owner: string;
    totalCost: number;
    currency: string;
    resourceGroupCount: number;
    serviceCount: number;
    resourceGroups: {
        name: string;
        totalCost: number;
    }[];
    services: {
        totalCost: number;
        serviceName: string;
        resourceType: string;
        currency: string;
        resourceCount: number;
    }[];
}[]>;
//# sourceMappingURL=cost.service.d.ts.map