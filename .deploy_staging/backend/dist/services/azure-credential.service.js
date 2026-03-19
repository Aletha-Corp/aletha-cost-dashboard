"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAzureCredential = getAzureCredential;
const identity_1 = require("@azure/identity");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
let credentialInstance = null;
/**
 * Returns a singleton Azure ClientSecretCredential.
 * Credentials are sourced exclusively from environment variables — never hardcoded.
 */
function getAzureCredential() {
    if (!credentialInstance) {
        credentialInstance = new identity_1.ClientSecretCredential(env_1.env.AZURE_TENANT_ID, env_1.env.AZURE_CLIENT_ID, env_1.env.AZURE_CLIENT_SECRET);
        logger_1.logger.info('Azure credential initialised (Service Principal)');
    }
    return credentialInstance;
}
//# sourceMappingURL=azure-credential.service.js.map