export interface CostEntry {
    resourceId: string;
    resourceGroup: string | null;
    resourceType: string;
    serviceName: string;
    cost: number;
    currency: string;
    usageDate: string;
    subscriptionId: string;
    subscriptionName: string;
    region: string;
    tags: Record<string, string>;
}
export interface ResourceGroupCost {
    resourceGroup: string;
    totalCost: number;
    currency: string;
    services: ServiceCost[];
    /** Owner/creator derived from resource group tags (CreatedBy, Owner, etc.) */
    owner?: string;
    /** Azure subscription this resource group belongs to */
    subscriptionId?: string;
}
export interface ServiceCost {
    serviceName: string;
    resourceType: string;
    totalCost: number;
    currency: string;
    resourceCount: number;
    /** Owner derived from resource tags for this resource type */
    owner?: string;
    /** Deployment environment derived from resource tags (e.g. prod, staging, dev) */
    environment?: string;
    /** Build/release info derived from resource tags (build number, version, pipeline, etc.) */
    buildInfo?: string;
    /** Azure region(s) this service runs in */
    regions?: string[];
}
export interface CostSummary {
    totalCost: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    resourceGroupCount: number;
    serviceCount: number;
    topResourceGroups: ResourceGroupCost[];
    topServices: ServiceCost[];
    dailyCosts: DailyCost[];
}
export interface DailyCost {
    date: string;
    cost: number;
    currency: string;
}
export interface CostQueryParams {
    startDate: string;
    endDate: string;
    subscriptionId?: string;
}
export interface OwnerCost {
    /** Owner name from resource tags, or 'Unassigned' */
    owner: string;
    totalCost: number;
    currency: string;
    resourceGroupCount: number;
    serviceCount: number;
    resourceGroups: Array<{
        name: string;
        totalCost: number;
    }>;
    services: Array<{
        serviceName: string;
        resourceType: string;
        totalCost: number;
        currency: string;
        resourceCount: number;
    }>;
}
//# sourceMappingURL=cost.types.d.ts.map