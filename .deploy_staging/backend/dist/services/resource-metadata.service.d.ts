export interface ServiceMetadata {
    owner?: string;
    /** Deployment environment tag, e.g. prod, staging, dev */
    environment?: string;
    /** Build/release info tag, e.g. build number, version, pipeline name */
    buildInfo?: string;
}
/**
/**
 * Returns a map of resource-group-name (lower-cased) → owner string.
 * Priority: owner tag on the RG → activity log creator fallback.
 */
export declare function getResourceGroupOwners(subscriptionId?: string): Promise<Map<string, string>>;
/**
 * Returns a map of rgName (lower-cased) → { createdAt?, isActive }.
 * Relies on caches populated by getResourceGroupOwners() having been called first;
 * if not yet populated, calls getResourceGroupOwners() to trigger the fill.
 */
export declare function getRgLifecycle(subscriptionId?: string): Promise<Map<string, {
    createdAt?: string;
    isActive: boolean;
}>>;
/**
 * Returns a map of resourceType (lower-cased) → ServiceMetadata,
 * derived from tags on individual resources. A single Azure API pass
 * collects owner, environment, and build-related tags, using
 * majority-vote per resource type to pick a representative value.
 */
export declare function getServiceMetadata(subscriptionId?: string): Promise<Map<string, ServiceMetadata>>;
/**
 * Thin wrapper kept for any callers that only need the owner map.
 */
export declare function getServiceOwners(subscriptionId?: string): Promise<Map<string, string>>;
//# sourceMappingURL=resource-metadata.service.d.ts.map