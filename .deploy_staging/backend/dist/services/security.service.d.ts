import type { SecurityReport } from '../types/security.types';
/**
 * Run a security scan on the given subscription.
 * Results are cached for 15 minutes and concurrent calls are coalesced.
 */
export declare function runSecurityScan(subscriptionId?: string): Promise<SecurityReport>;
/** Force-invalidate the security report cache */
export declare function invalidateSecurityCache(): void;
//# sourceMappingURL=security.service.d.ts.map