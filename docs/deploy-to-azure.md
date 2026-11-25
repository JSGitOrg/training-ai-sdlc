# Deploy with GitHub Actions to Azure App Service

The workflow in `.github/workflows/deploy-azure.yml` runs tests, provisions an Azure App Service with Bicep and Azure Verified Modules, and deploys the application whenever code is pushed to `main`. It uses GitHub OpenID Connect (OIDC), so no Azure client secret is stored in GitHub.

The template creates a Linux App Service Plan (Basic B1) and a Node.js 24 LTS web app. B1 incurs Azure charges while the resource exists. The app keeps registration data in `/home/data/workshops.json`; the deployment archive contains only an empty-registration seed. App Service storage must remain enabled, and this file-based app should run with one instance.

## 1. Create a GitHub repository and push the source

Create an empty repository in GitHub. From the project folder, initialize and push the source:

```powershell
git init -b main
git add .gitignore package.json server.js src public test infra .github docs data/workshops.seed.json
git status --short
git check-ignore -v data/workshops.json
git commit -m "Prepare workshop registration app for Azure deployment"
git remote add origin https://github.com/<OWNER>/<REPOSITORY>.git
git push -u origin main
```

Replace `<OWNER>` and `<REPOSITORY>` with the GitHub account or organization and repository name. Check the staged files before committing. `data/workshops.json` is intentionally ignored because it contains live registration data; deploys use `data/workshops.seed.json` only when the persistent data file does not exist.

## 2. Create the Azure resource group

In Azure Cloud Shell or a local terminal with Azure CLI:

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
az group create --name "<RESOURCE_GROUP>" --location "<AZURE_REGION>"
```

Use an App Service-supported region. The workflow will provision the App Service Plan and web app inside this resource group.

## 3. Configure GitHub OIDC access in Azure

In Microsoft Entra ID:

1. Create an app registration for the GitHub Actions deployment identity.
2. Create a service principal for that app registration.
3. Assign the service principal the **Contributor** role scoped to the resource group from step 2.
4. In the app registration, open **Certificates & secrets → Federated credentials → Add credential**. Choose the GitHub Actions deployment option and enter the repository owner, repository name, and `main` branch.
5. Record the app's **Application (client) ID**, **Directory (tenant) ID**, and your Azure **Subscription ID**.

The federated credential must match the repository and branch exactly. No client secret is required.

## 4. Add repository settings

In GitHub, open **Settings → Secrets and variables → Actions** and add these **Repository secrets**:

- `AZURE_CLIENT_ID` — app registration's Application (client) ID
- `AZURE_TENANT_ID` — Microsoft Entra tenant ID
- `AZURE_SUBSCRIPTION_ID` — Azure subscription ID

Add these **Repository variables**:

- `AZURE_RESOURCE_GROUP` — resource group from step 2
- `AZURE_WEBAPP_NAME` — globally unique, lowercase web app name
- `AZURE_LOCATION` — Azure region, for example `eastus`

## 5. Deploy

Push a commit to `main`, or run **Actions → Deploy workshop registration app → Run workflow** on `main`. The workflow runs `npm test`; if tests pass, it creates or updates the App Service resources and deploys the app. The App Service URL is `https://<AZURE_WEBAPP_NAME>.azurewebsites.net`.

The app initializes `/home/data/workshops.json` from the seed on its first start and preserves that file on later deploys. Do not scale this file-based deployment beyond one App Service instance; use a managed database before scaling out.

## Official references

- [Configure Node.js apps in Azure App Service](https://learn.microsoft.com/azure/app-service/configure-language-nodejs)
- [Azure Login GitHub Action and OpenID Connect](https://github.com/Azure/login#configure-a-service-principal-with-a-federated-credential-to-use-oidc-based-authentication)
