"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSecurityScan = runSecurityScan;
exports.invalidateSecurityCache = invalidateSecurityCache;
const arm_authorization_1 = require("@azure/arm-authorization");
const arm_network_1 = require("@azure/arm-network");
const arm_storage_1 = require("@azure/arm-storage");
const arm_keyvault_1 = require("@azure/arm-keyvault");
const arm_resources_1 = require("@azure/arm-resources");
const azure_credential_service_1 = require("./azure-credential.service");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// ─── Cache ───────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — security scans are expensive
let reportCache = null;
let inFlightPromise = null;
// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeId(parts) {
    return parts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
function buildSummary(findings) {
    const summary = {
        totalFindings: findings.length,
        securityScore: 100,
        critical: 0, high: 0, medium: 0, low: 0, info: 0,
        findingsByCategory: {},
    };
    for (const f of findings) {
        summary[f.severity]++;
        summary.findingsByCategory[f.category] = (summary.findingsByCategory[f.category] ?? 0) + 1;
    }
    // Weighted deduction: critical -20, high -10, medium -5, low -2, info 0
    const deduction = summary.critical * 20 +
        summary.high * 10 +
        summary.medium * 5 +
        summary.low * 2;
    summary.securityScore = Math.max(0, Math.min(100, 100 - deduction));
    return summary;
}
// ─── Check: Owner/Classic Admins (Co-Administrators) ─────────────────────────
async function checkClassicAdmins(authClient, subscriptionId) {
    const findings = [];
    try {
        const admins = [];
        for await (const admin of authClient.classicAdministrators.list()) {
            if (admin.role && admin.role.toLowerCase().includes('coadministrator')) {
                admins.push({ id: admin.id ?? '', name: admin.emailAddress ?? 'Unknown' });
            }
        }
        if (admins.length > 0) {
            findings.push({
                id: 'iam-classic-admins',
                category: 'identity-access',
                severity: 'high',
                title: 'Classic Co-Administrators Found',
                description: `${admins.length} Co-Administrator(s) detected. Classic admin roles bypass Azure RBAC and cannot benefit from Conditional Access or PIM.`,
                remediation: 'Remove Co-Administrator roles and replace with equivalent Azure RBAC roles such as Owner or Contributor scoped to specific resource groups.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/classic-administrators',
                affectedCount: admins.length,
                affectedResources: admins.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkClassicAdmins skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: Subscription Owners ──────────────────────────────────────────────
async function checkSubscriptionOwners(authClient, subscriptionId) {
    const findings = [];
    try {
        const scope = `/subscriptions/${subscriptionId}`;
        const owners = [];
        for await (const ra of authClient.roleAssignments.listForScope(scope)) {
            // Owner role definition ID is fixed across all Azure tenants
            if (ra.roleDefinitionId?.endsWith('/8e3af657-a8ff-443c-a75c-2fe8c4bcb635')) {
                owners.push({ id: ra.id ?? '', name: ra.principalId ?? 'Unknown' });
            }
        }
        if (owners.length > 3) {
            findings.push({
                id: 'iam-too-many-owners',
                category: 'identity-access',
                severity: 'medium',
                title: 'Excessive Subscription Owners',
                description: `${owners.length} principals have the Owner role on the subscription. Having many owners at subscription scope increases the blast radius of a compromised account.`,
                remediation: 'Reduce owners to a maximum of 3. Assign the Contributor or more specific roles scoped to resource groups instead.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/security/fundamentals/identity-management-best-practices',
                affectedCount: owners.length,
                affectedResources: owners.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkSubscriptionOwners skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: NSG – All ports open to Internet ─────────────────────────────────
const SENSITIVE_PORTS = [22, 3389, 1433, 3306, 5432, 27017, 6379, 8080, 8443];
async function checkNsgOpenPorts(networkClient) {
    const findings = [];
    try {
        const wideOpenNsgs = [];
        const sshRdpNsgs = [];
        for await (const nsg of networkClient.networkSecurityGroups.listAll()) {
            for (const rule of nsg.securityRules ?? []) {
                if (rule.direction !== 'Inbound' || rule.access !== 'Allow')
                    continue;
                const src = rule.sourceAddressPrefix ?? '';
                const isInternet = src === '*' || src === 'Internet' || src === '0.0.0.0/0' || src === '::/0';
                if (!isInternet)
                    continue;
                const portRange = (rule.destinationPortRange ?? '').trim();
                const allPorts = portRange === '*' || portRange === '0-65535';
                const resource = {
                    id: nsg.id ?? '',
                    name: nsg.name ?? 'Unknown NSG',
                    resourceGroup: nsg.id?.split('/')[4],
                    type: 'Microsoft.Network/networkSecurityGroups',
                };
                if (allPorts) {
                    wideOpenNsgs.push(resource);
                    break;
                }
                // Check if a sensitive port is open
                const portNum = parseInt(portRange, 10);
                if (!isNaN(portNum) && SENSITIVE_PORTS.includes(portNum)) {
                    sshRdpNsgs.push(resource);
                    break;
                }
            }
        }
        if (wideOpenNsgs.length > 0) {
            findings.push({
                id: 'nsg-any-port-internet',
                category: 'network-security',
                severity: 'critical',
                title: 'NSG Rules Allow All Inbound Traffic from Internet',
                description: `${wideOpenNsgs.length} Network Security Group(s) have an inbound Allow rule with source * or Internet and destination port *.`,
                remediation: 'Remove "Any" port rules and replace with explicit port allowances for only required traffic. Use Azure Bastion for administrative access.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/security/fundamentals/network-best-practices',
                affectedCount: wideOpenNsgs.length,
                affectedResources: wideOpenNsgs.slice(0, 20),
            });
        }
        if (sshRdpNsgs.length > 0) {
            findings.push({
                id: 'nsg-ssh-rdp-internet',
                category: 'network-security',
                severity: 'high',
                title: 'SSH / RDP Open to Internet',
                description: `${sshRdpNsgs.length} NSG(s) allow inbound SSH (22) or RDP (3389) or other sensitive ports from any internet source. These are common brute-force attack vectors.`,
                remediation: 'Restrict port 22 and 3389 to specific IP ranges or use Azure Bastion. Use Just-In-Time (JIT) VM access via Microsoft Defender for Cloud.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview',
                affectedCount: sshRdpNsgs.length,
                affectedResources: sshRdpNsgs.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkNsgOpenPorts skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: Storage Accounts – Public Blob Access ───────────────────────────
async function checkStorageSecurity(storageClient) {
    const findings = [];
    try {
        const publicBlobAccounts = [];
        const httpOnlyAccounts = [];
        const noSoftDeleteAccounts = [];
        for await (const sa of storageClient.storageAccounts.list()) {
            const resource = {
                id: sa.id ?? '',
                name: sa.name ?? 'Unknown',
                resourceGroup: sa.id?.split('/')[4],
                type: 'Microsoft.Storage/storageAccounts',
            };
            if (sa.allowBlobPublicAccess === true) {
                publicBlobAccounts.push(resource);
            }
            if (sa.enableHttpsTrafficOnly === false) {
                httpOnlyAccounts.push(resource);
            }
            // Blob soft delete check via blob service properties
            try {
                const rgName = sa.id?.split('/')[4];
                if (rgName && sa.name) {
                    const blobProps = await storageClient.blobServices.getServiceProperties(rgName, sa.name);
                    if (!blobProps.deleteRetentionPolicy?.enabled) {
                        noSoftDeleteAccounts.push(resource);
                    }
                }
            }
            catch {
                // Some accounts types don't support blob service props — skip silently
            }
        }
        if (publicBlobAccounts.length > 0) {
            findings.push({
                id: 'storage-public-blob-access',
                category: 'storage-security',
                severity: 'high',
                title: 'Storage Accounts Allow Public Blob Access',
                description: `${publicBlobAccounts.length} storage account(s) have anonymous public blob access enabled. This could expose sensitive files to anyone on the internet.`,
                remediation: 'Set "allowBlobPublicAccess" to false on all storage accounts unless public access is explicitly required. Use Shared Access Signatures for limited external access.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent',
                affectedCount: publicBlobAccounts.length,
                affectedResources: publicBlobAccounts.slice(0, 20),
            });
        }
        if (httpOnlyAccounts.length > 0) {
            findings.push({
                id: 'storage-http-allowed',
                category: 'storage-security',
                severity: 'medium',
                title: 'Storage Accounts Allow HTTP (Unencrypted) Traffic',
                description: `${httpOnlyAccounts.length} storage account(s) do not enforce HTTPS-only traffic, allowing data to be transmitted in plain text.`,
                remediation: 'Enable "Secure transfer required" (HTTPS only) on all storage accounts.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-require-secure-transfer',
                affectedCount: httpOnlyAccounts.length,
                affectedResources: httpOnlyAccounts.slice(0, 20),
            });
        }
        if (noSoftDeleteAccounts.length > 0) {
            findings.push({
                id: 'storage-no-soft-delete',
                category: 'storage-security',
                severity: 'low',
                title: 'Blob Soft Delete Disabled on Storage Accounts',
                description: `${noSoftDeleteAccounts.length} storage account(s) do not have blob soft delete enabled. Accidental or malicious deletion cannot be recovered.`,
                remediation: 'Enable blob soft delete with a retention period of at least 7 days on all storage accounts.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-overview',
                affectedCount: noSoftDeleteAccounts.length,
                affectedResources: noSoftDeleteAccounts.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkStorageSecurity skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: Key Vaults ────────────────────────────────────────────────────────
async function checkKeyVaults(kvClient) {
    const findings = [];
    try {
        const noSoftDeleteKvs = [];
        const noPurgeProtectionKvs = [];
        const publicNetworkKvs = [];
        for await (const kv of kvClient.vaults.list()) {
            const resource = {
                id: kv.id ?? '',
                name: kv.name ?? 'Unknown',
                resourceGroup: kv.id?.split('/')[4],
                type: 'Microsoft.KeyVault/vaults',
            };
            const props = kv;
            if (props.properties?.enableSoftDelete === false)
                noSoftDeleteKvs.push(resource);
            if (!props.properties?.enablePurgeProtection)
                noPurgeProtectionKvs.push(resource);
            const netAccess = props.properties?.publicNetworkAccess ?? 'Enabled';
            const defaultAction = props.properties?.networkAcls?.defaultAction ?? 'Allow';
            if (netAccess !== 'Disabled' && defaultAction === 'Allow') {
                publicNetworkKvs.push(resource);
            }
        }
        if (noSoftDeleteKvs.length > 0) {
            findings.push({
                id: 'kv-soft-delete-disabled',
                category: 'key-management',
                severity: 'high',
                title: 'Key Vault Soft Delete Disabled',
                description: `${noSoftDeleteKvs.length} Key Vault(s) do not have soft delete enabled. Deleted keys, secrets, and certificates cannot be recovered.`,
                remediation: 'Enable soft delete on all Key Vaults. Note: new vaults have soft delete enabled by default since 2020.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview',
                affectedCount: noSoftDeleteKvs.length,
                affectedResources: noSoftDeleteKvs.slice(0, 20),
            });
        }
        if (noPurgeProtectionKvs.length > 0) {
            findings.push({
                id: 'kv-purge-protection-disabled',
                category: 'key-management',
                severity: 'medium',
                title: 'Key Vault Purge Protection Disabled',
                description: `${noPurgeProtectionKvs.length} Key Vault(s) do not have purge protection enabled. A malicious admin could permanently destroy vault contents during the soft-delete retention period.`,
                remediation: 'Enable purge protection on Key Vaults containing production secrets or encryption keys.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview#purge-protection',
                affectedCount: noPurgeProtectionKvs.length,
                affectedResources: noPurgeProtectionKvs.slice(0, 20),
            });
        }
        if (publicNetworkKvs.length > 0) {
            findings.push({
                id: 'kv-public-network-access',
                category: 'key-management',
                severity: 'medium',
                title: 'Key Vaults Accessible from Public Internet',
                description: `${publicNetworkKvs.length} Key Vault(s) allow public network access with no network ACL restrictions.`,
                remediation: 'Configure Key Vault firewall rules to restrict access to specific virtual networks and IP ranges, or use Private Endpoints.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/key-vault/general/network-security',
                affectedCount: publicNetworkKvs.length,
                affectedResources: publicNetworkKvs.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkKeyVaults skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: Resource Groups without tags ──────────────────────────────────────
async function checkGovernance(resourceClient) {
    const findings = [];
    try {
        const untaggedRgs = [];
        const lockedRgs = new Set();
        // List all management locks at subscription scope
        for await (const rg of resourceClient.resourceGroups.list()) {
            const name = rg.name ?? '';
            const tags = rg.tags ?? {};
            const hasOwner = Object.keys(tags).some((k) => ['owner', 'createdby', 'created_by', 'team'].includes(k.toLowerCase()));
            const hasEnv = Object.keys(tags).some((k) => ['environment', 'env', 'stage'].includes(k.toLowerCase()));
            if (!hasOwner || !hasEnv) {
                untaggedRgs.push({
                    id: rg.id ?? '',
                    name,
                    resourceGroup: name,
                    type: 'Microsoft.Resources/resourceGroups',
                });
            }
        }
        if (untaggedRgs.length > 0) {
            findings.push({
                id: 'governance-missing-tags',
                category: 'governance',
                severity: 'low',
                title: 'Resource Groups Missing Owner or Environment Tags',
                description: `${untaggedRgs.length} resource group(s) are missing standard Owner and/or Environment tags, making it difficult to track accountability.`,
                remediation: 'Apply tagging policies (Azure Policy) to enforce required tags on all resource groups. At minimum require "owner" and "environment" tags.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging',
                affectedCount: untaggedRgs.length,
                affectedResources: untaggedRgs.slice(0, 30),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkGovernance skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: Diagnostic settings (monitoring) ─────────────────────────────────
async function checkMonitoringLogging(resourceClient, subscriptionId) {
    const findings = [];
    try {
        // We check whether there is at least one diagnostic setting at subscription scope
        // by trying to list activity log profiles — if none exist flag it.
        // We enumerate resource groups and check for resources that are VMs / SQL servers
        // without diagnostics (heuristic: check total resource count vs presence of monitoring infra).
        const allResources = [];
        let hasLogAnalytics = false;
        let hasStorageDiag = false;
        for await (const resource of resourceClient.resources.list()) {
            const type = (resource.type ?? '').toLowerCase();
            allResources.push(type);
            if (type.includes('microsoft.operationalinsights/workspaces'))
                hasLogAnalytics = true;
            if (type.includes('microsoft.insights/diagnosticsettings'))
                hasStorageDiag = true;
        }
        if (allResources.length > 5 && !hasLogAnalytics) {
            findings.push({
                id: 'monitor-no-log-analytics',
                category: 'monitoring-logging',
                severity: 'medium',
                title: 'No Log Analytics Workspace Detected',
                description: 'No Log Analytics workspace was found in this subscription. Without centralized logging, security incidents are difficult to detect and investigate.',
                remediation: 'Create a Log Analytics workspace and configure Azure Monitor diagnostic settings to send logs from key resources (VMs, NSGs, Key Vaults, etc.) to it.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-overview',
                affectedCount: 1,
                affectedResources: [{ id: `/subscriptions/${subscriptionId}`, name: 'Subscription', type: 'subscription' }],
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkMonitoringLogging skipped', { err: String(err) });
    }
    return findings;
}
// ─── Check: VNets without DDoS Protection ─────────────────────────────────────
async function checkDdosProtection(networkClient) {
    const findings = [];
    try {
        const unprotectedVnets = [];
        for await (const vnet of networkClient.virtualNetworks.listAll()) {
            const ddos = vnet.enableDdosProtection;
            if (!ddos) {
                unprotectedVnets.push({
                    id: vnet.id ?? '',
                    name: vnet.name ?? 'Unknown',
                    resourceGroup: vnet.id?.split('/')[4],
                    type: 'Microsoft.Network/virtualNetworks',
                });
            }
        }
        if (unprotectedVnets.length > 0) {
            findings.push({
                id: 'network-no-ddos-protection',
                category: 'network-security',
                severity: 'low',
                title: 'Virtual Networks Without DDoS Protection',
                description: `${unprotectedVnets.length} VNet(s) do not have DDoS Protection Standard enabled (Basic DDoS only).`,
                remediation: 'Enable Azure DDoS Protection Standard on VNets hosting public-facing workloads. Consider cost-benefit for non-production VNets.',
                learnMoreUrl: 'https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-protection-overview',
                affectedCount: unprotectedVnets.length,
                affectedResources: unprotectedVnets.slice(0, 20),
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('checkDdosProtection skipped', { err: String(err) });
    }
    return findings;
}
// ─── Main scan orchestrator ───────────────────────────────────────────────────
async function doRunSecurityScan(subscriptionId) {
    const startTime = Date.now();
    const credential = (0, azure_credential_service_1.getAzureCredential)();
    const skippedCategories = [];
    const authClient = new arm_authorization_1.AuthorizationManagementClient(credential, subscriptionId);
    const networkClient = new arm_network_1.NetworkManagementClient(credential, subscriptionId);
    const storageClient = new arm_storage_1.StorageManagementClient(credential, subscriptionId);
    const kvClient = new arm_keyvault_1.KeyVaultManagementClient(credential, subscriptionId);
    const resourceClient = new arm_resources_1.ResourceManagementClient(credential, subscriptionId);
    // Run all checks in parallel with per-check error isolation
    const safeRun = async (category, fn) => {
        try {
            return await fn();
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            skippedCategories.push({ category, reason });
            logger_1.logger.warn(`Security check category skipped: ${category}`, { reason });
            return [];
        }
    };
    const results = await Promise.allSettled([
        safeRun('identity-access', () => checkClassicAdmins(authClient, subscriptionId)),
        safeRun('identity-access', () => checkSubscriptionOwners(authClient, subscriptionId)),
        safeRun('network-security', () => checkNsgOpenPorts(networkClient)),
        safeRun('network-security', () => checkDdosProtection(networkClient)),
        safeRun('storage-security', () => checkStorageSecurity(storageClient)),
        safeRun('key-management', () => checkKeyVaults(kvClient)),
        safeRun('governance', () => checkGovernance(resourceClient)),
        safeRun('monitoring-logging', () => checkMonitoringLogging(resourceClient, subscriptionId)),
    ]);
    const allFindings = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allFindings.push(...result.value);
        }
    }
    // Sort by severity weight
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allFindings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
    return {
        subscriptionId,
        scannedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        summary: buildSummary(allFindings),
        findings: allFindings,
        skippedCategories,
    };
}
/**
 * Run a security scan on the given subscription.
 * Results are cached for 15 minutes and concurrent calls are coalesced.
 */
async function runSecurityScan(subscriptionId) {
    const subId = subscriptionId ?? env_1.env.AZURE_SUBSCRIPTION_ID;
    if (reportCache && Date.now() - reportCache.cachedAt < CACHE_TTL_MS) {
        logger_1.logger.info('Returning security report from cache');
        return reportCache.data;
    }
    if (inFlightPromise) {
        logger_1.logger.info('Coalescing into in-flight security scan');
        return inFlightPromise;
    }
    inFlightPromise = doRunSecurityScan(subId)
        .then((report) => {
        reportCache = { data: report, cachedAt: Date.now() };
        return report;
    })
        .finally(() => {
        inFlightPromise = null;
    });
    return inFlightPromise;
}
/** Force-invalidate the security report cache */
function invalidateSecurityCache() {
    reportCache = null;
    logger_1.logger.info('Security report cache invalidated');
}
//# sourceMappingURL=security.service.js.map