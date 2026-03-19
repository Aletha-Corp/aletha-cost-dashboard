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

export interface ServiceCost {
  serviceName: string;
  resourceType: string;
  totalCost: number;
  currency: string;
  resourceCount: number;
  owner?: string;
  environment?: string;
  buildInfo?: string;
  regions?: string[];
  firstSeen?: string;
  lastSeen?: string;
}

export interface ResourceGroupCost {
  resourceGroup: string;
  totalCost: number;
  currency: string;
  services: ServiceCost[];
  owner?: string;
  subscriptionId?: string;
  createdAt?: string;
  isActive?: boolean;
}

export interface DailyCost {
  date: string;
  cost: number;
  currency: string;
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

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface OwnerCost {
  /** Owner name from resource tags, or 'Unassigned' */
  owner: string;
  totalCost: number;
  currency: string;
  resourceGroupCount: number;
  serviceCount: number;
  resourceGroups: Array<{ name: string; totalCost: number }>;
  services: Array<{ serviceName: string; resourceType: string; totalCost: number; currency: string; resourceCount: number }>;
}
