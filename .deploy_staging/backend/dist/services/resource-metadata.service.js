"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResourceGroupOwners = getResourceGroupOwners;
exports.getServiceMetadata = getServiceMetadata;
exports.getServiceOwners = getServiceOwners;
const arm_resources_1 = require("@azure/arm-resources");
const azure_credential_service_1 = require("./azure-credential.service");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// ─── Cache ───────────────────────────────────────────────────────────────────
// Owner/tag data changes rarely — cache for 30 minutes.
const CACHE_TTL_MS = 30 * 60 * 1000;
let rgOwnerCache = null;
// key: resourceType (lower-cased) → ServiceMetadata
let serviceMetadataCache = null;
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
// ─── Resource Group owners ───────────────────────────────────────────────────
/**
 * Returns a map of resource-group-name (lower-cased) → owner string,
 * populated from common owner-related tags on the resource group itself.
 */
async function getResourceGroupOwners(subscriptionId) {
    if (rgOwnerCache && Date.now() - rgOwnerCache.cachedAt < CACHE_TTL_MS) {
        return rgOwnerCache.data;
    }
    const subId = subscriptionId ?? env_1.env.AZURE_SUBSCRIPTION_ID;
    const client = new arm_resources_1.ResourceManagementClient((0, azure_credential_service_1.getAzureCredential)(), subId);
    const ownerMap = new Map();
    try {
        for await (const rg of client.resourceGroups.list()) {
            const owner = extractOwner(rg.tags);
            if (rg.name && owner) {
                ownerMap.set(rg.name.toLowerCase(), owner);
            }
        }
        logger_1.logger.info(`Loaded owner tags for ${ownerMap.size} resource groups`);
    }
    catch (err) {
        logger_1.logger.warn('Failed to fetch resource group tags — owner info unavailable', { err });
    }
    rgOwnerCache = { data: ownerMap, cachedAt: Date.now() };
    return ownerMap;
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
        logger_1.logger.info(`Loaded service metadata across ${ownerTally.size} distinct resource types`);
    }
    catch (err) {
        logger_1.logger.warn('Failed to fetch resource tags — service metadata unavailable', { err });
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
    serviceMetadataCache = { data: result, cachedAt: Date.now() };
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