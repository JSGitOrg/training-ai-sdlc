@description('Globally unique name for the Azure App Service.')
param appName string

@description('Azure region for the App Service resources.')
param location string = resourceGroup().location

@description('B1 provides a single Basic-tier instance for the JSON-file data store.')
param skuName string = 'B1'

var appServicePlanName = '${appName}-plan'

module appServicePlan 'br/public:avm/res/web/serverfarm:0.7.1' = {
  name: 'appServicePlanDeployment'
  params: {
    name: appServicePlanName
    kind: 'linux'
    location: location
    reserved: true
    skuName: skuName
    skuCapacity: 1
    zoneRedundant: false
    enableTelemetry: false
  }
}

module webApp 'br/public:avm/res/web/site:0.24.0' = {
  name: 'webAppDeployment'
  params: {
    kind: 'app,linux'
    name: appName
    location: location
    serverFarmResourceId: appServicePlan.outputs.resourceId
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      ftpsState: 'FtpsOnly'
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      minTlsVersion: '1.2'
    }
    configs: [
      {
        name: 'appsettings'
        properties: {
          WEBSITE_RUN_FROM_PACKAGE: '1'
          WEBSITES_ENABLE_APP_SERVICE_STORAGE: 'true'
          DATA_FILE: '/home/data/workshops.json'
          PORT: '8080'
        }
      }
    ]
    enableTelemetry: false
  }
}

output appUrl string = 'https://${webApp.outputs.defaultHostname}'
