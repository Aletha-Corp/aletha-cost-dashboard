import { ClientSecretCredential } from '@azure/identity';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let credentialInstance: ClientSecretCredential | null = null;

/**
 * Returns a singleton Azure ClientSecretCredential.
 * Credentials are sourced exclusively from environment variables — never hardcoded.
 */
export function getAzureCredential(): ClientSecretCredential {
  if (!credentialInstance) {
    credentialInstance = new ClientSecretCredential(
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET
    );
    logger.info('Azure credential initialised (Service Principal)');
  }
  return credentialInstance;
}
