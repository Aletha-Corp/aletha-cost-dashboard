// Bicep template to deploy the Azure Cost Dashboard to Azure App Service
// Sensitive values (client secret) are passed via secure parameters — never hardcoded.

@description('Location for all resources')
param location string = 'canadacentral'

@description('Name prefix for all resources')
param appName string = 'azure-cost-dashboard'

@description('Azure AD Tenant ID for the Service Principal')
@secure()
param azureTenantId string

@description('Client ID of the Service Principal with Cost Management Reader role')
@secure()
param azureClientId string

@description('Client Secret of the Service Principal')
@secure()
param azureClientSecret string

@description('Azure Subscription ID to query costs from')
@secure()
param azureSubscriptionId string

@description('App Service Plan SKU')
param appServicePlanSku string = 'B1'

// ─── App Service Plan ───────────────────────────────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: appServicePlanSku
  }
  properties: {
    reserved: true // Linux
  }
  kind: 'linux'
}

// ─── App Service ────────────────────────────────────────────────────────────
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      nodeVersion: '18-lts'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'AZURE_TENANT_ID', value: azureTenantId }
        { name: 'AZURE_CLIENT_ID', value: azureClientId }
        { name: 'AZURE_CLIENT_SECRET', value: azureClientSecret }
        { name: 'AZURE_SUBSCRIPTION_ID', value: azureSubscriptionId }
        { name: 'CORS_ORIGIN', value: 'https://${appName}.azurewebsites.net' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '18-lts' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
      ]
      appCommandLine: 'node backend/dist/server.js'
      alwaysOn: false
      http20Enabled: true
      minTlsVersion: '1.2'
    }
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppName string = webApp.name
