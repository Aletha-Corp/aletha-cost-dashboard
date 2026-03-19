export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityCategory = 'identity-access' | 'network-security' | 'storage-security' | 'key-management' | 'monitoring-logging' | 'governance';
export interface AffectedResource {
    id: string;
    name: string;
    resourceGroup?: string;
    type?: string;
}
export interface SecurityFinding {
    id: string;
    category: SecurityCategory;
    severity: SecuritySeverity;
    title: string;
    description: string;
    remediation: string;
    learnMoreUrl?: string;
    affectedCount: number;
    affectedResources: AffectedResource[];
}
export interface SecurityScanSummary {
    totalFindings: number;
    /** 0–100 composite score (higher = better) */
    securityScore: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    findingsByCategory: Partial<Record<SecurityCategory, number>>;
}
export interface SecurityReport {
    subscriptionId: string;
    scannedAt: string;
    durationMs: number;
    summary: SecurityScanSummary;
    findings: SecurityFinding[];
    /** Categories that could not be scanned due to insufficient permissions or API errors */
    skippedCategories: Array<{
        category: SecurityCategory;
        reason: string;
    }>;
}
//# sourceMappingURL=security.types.d.ts.map