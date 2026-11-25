@description('Globally unique name for the Azure App Service.')
param appName string

@description('Azure region for the App Service resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B1 supports always-on single-instance hosting.')
param skuName string = 'B1'

var appServicePlanName = '${appName}-plan'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: 'Basic'
    size: skuName
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      appSettings: [
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'true'
        }
        {
          name: 'DATA_FILE'
          value: '/home/data/workshops.json'
        }
        {
          name: 'PORT'
          value: '8080'
        }
      ]
    }
  }
}

output appUrl string = 'https://${webApp.properties.defaultHostName}'
