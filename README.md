# Azure Cost Dashboard

A modern, full-stack web application that connects to your Azure Cost Management API and provides an interactive dashboard to monitor and analyse Azure spending — broken down by **resource group**, **service**, and **date range**.

Built with:
- **Backend**: Node.js · TypeScript · Express · `@azure/identity` · `@azure/arm-costmanagement`
- **Frontend**: React 18 · TypeScript · Vite · Tailwind CSS · Recharts · TanStack Query
- **Deployment**: Azure App Service (Linux/Node 18)

---

## Screenshots

| Summary | Resource Groups | Services |
|---------|----------------|----------|
| KPIs + area chart + pie chart | Expandable accordions per resource group | Bar chart + ranked table |

---

## Project Structure

```
azure-cost/
├── backend/                   # Express API
│   └── src/
│       ├── config/            # Environment validation (Zod)
│       ├── middleware/        # Error handler
│       ├── routes/            # cost.routes.ts
│       ├── services/          # azure-credential.service.ts, cost.service.ts
│       ├── types/             # Shared TypeScript interfaces
│       ├── utils/             # Winston logger
│       ├── validators/        # Zod request validators
│       └── server.ts          # Express app entry point
│
├── frontend/                  # React SPA
│   └── src/
│       ├── api/               # Axios client + cost API functions
│       ├── components/        # UI components (layout/, ui/)
│       ├── hooks/             # use-costs.ts, use-date-range.ts
│       ├── pages/             # SummaryPage, ResourceGroupsPage, ServicesPage, EntriesPage
│       ├── types/             # cost.types.ts
│       └── utils/             # format.ts
│
├── infra/
│   └── main.bicep             # Azure Bicep deployment template
│
└── scripts/
    ├── deploy.sh              # Build + zip-deploy to Azure App Service
    └── setup-service-principal.sh  # Create SP with minimal permissions
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js ≥ 18
- An **Azure Service Principal** with **Cost Management Reader** role on your subscription
- Azure CLI (optional, for the helper scripts)

### 1. Create a Service Principal

```bash
bash scripts/setup-service-principal.sh <your-subscription-id>
```

This creates a Service Principal with **Cost Management Reader** (read-only) permissions and prints the credentials.

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

`.env` contents:
```env
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Install & Run

```bash
# Install all dependencies
npm run install:all

# Terminal 1 — Backend API
npm run dev:backend

# Terminal 2 — Frontend dev server
npm run dev:frontend
```

Open **http://localhost:5173** in your browser.

---

## Features

### Summary Page
- Total cost KPI, resource group count, service count, daily average
- Interactive area chart — daily cost trend over selected period
- Top resource groups pie chart
- Top 10 services by cost with progress bars

### Resource Groups Page
- All resource groups sorted by cost (highest first)
- Resources with **no resource group** listed as `None`
- Expandable accordion showing services + resource types within each group

### Services Page
- Horizontal bar chart of top 15 services
- Full ranked table with cost, resource count, and % share

### All Entries Page
- Paginated table (50 per page) of daily granularity cost entries
- Live search filtering by resource group, service, type, subscription

### Date Range Picker
- Quick presets: Last 7 / 30 / 60 / 90 days
- Custom date range input (validated before fetching)

---

## Deployment to Azure App Service

Follow these steps in order.

### Prerequisites
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- [Bicep CLI](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) — or use `az bicep install`
- Node.js ≥ 18

---

### Step 1 — Create a Service Principal

Run the helper script with your Azure Subscription ID:

```bash
bash scripts/setup-service-principal.sh <your-subscription-id>
```

This creates a Service Principal with **Cost Management Reader** (read-only) permissions and prints the four credential values you need in the next steps.

> If you prefer to do this manually: Azure Portal → Azure Active Directory → App registrations → New registration → Certificates & secrets → then assign **Cost Management Reader** on your subscription via IAM.

---

### Step 2 — Create the Resource Group

Choose a name for your resource group. This example uses `aletha-custom-cost-dashboard`:

```bash
az group create \
  --name <your-resource-group> \
  --location canadacentral
```

---

### Step 3 — Deploy Infrastructure (Bicep)

Choose a **globally unique** name for your app — it becomes the subdomain `<app-name>.azurewebsites.net`. Use the credentials from Step 1:

```bash
az deployment group create \
  --resource-group <your-resource-group> \
  --template-file infra/main.bicep \
  --parameters \
      appName=<your-unique-app-name> \
      azureTenantId=<tenant-id> \
      azureClientId=<client-id> \
      azureClientSecret=<client-secret> \
      azureSubscriptionId=<subscription-id>
```

> If the deployment fails partway through with a name conflict, re-run with a different `appName`. Check for and delete any orphaned App Service Plans in the resource group before retrying:
> ```bash
> az appservice plan list --resource-group <your-resource-group> --output table
> az appservice plan delete --name <orphaned-plan-name> --resource-group <your-resource-group> --yes
> ```

---

### Step 4 — Build & Deploy Application Code

```bash
bash scripts/deploy.sh <your-resource-group> <your-unique-app-name>
```

This builds both the backend and frontend, creates a zip archive (including production `node_modules`), and uploads it to Azure App Service. The script also disables Kudu builds and enables run-from-package so the zip is run as-is.

> Deployment can take several minutes on small plans (B1). If it appears to hang, check the latest deployment status:
> ```bash
> az webapp log deployment list \
>   --resource-group <your-resource-group> \
>   --name <your-unique-app-name> \
>   --query "[0].{status:status,received_time:received_time,message:message}" -o json
> ```

Once complete, your dashboard is live at:

```
https://<your-unique-app-name>.azurewebsites.net
```

---

### Step 5 — Restrict Access to Your Organisation (Easy Auth)

By default the app is publicly reachable. Use **Azure App Service Built-in Authentication (Easy Auth)** to require a company Microsoft login before anyone can view the dashboard. This is enforced at the infrastructure layer — no code changes required.

#### 5a — Configure the App Registration

1. Azure Portal → **Azure Active Directory → App registrations** → open the registration for this app
2. **Authentication** tab → **Add a platform → Web**
3. Set Redirect URI to:
   ```
   https://<your-unique-app-name>.azurewebsites.net/.auth/login/aad/callback
   ```
4. Under **Implicit grant and hybrid flows**, tick **ID tokens**
5. Save

#### 5b — Enable Easy Auth on the App Service

1. Azure Portal → **App Service** → your app → **Authentication** (left menu)
2. Click **Add identity provider**
3. Choose **Microsoft**
4. Set **App registration type** to *Provide the details of an existing app registration*
5. Enter your **Client ID** and **Client Secret** (from the App Registration)
6. Set **Issuer URL** to `https://sts.windows.net/<your-tenant-id>/v2.0`
7. Set **Unauthenticated requests** → **HTTP 302 Found redirect: Log in using this provider**
8. Save

#### 5c — Restrict to specific users or groups (optional)

By default any user in your Azure AD tenant can sign in. To limit it further:

1. Azure Portal → **Azure Active Directory → Enterprise applications** → open the app
2. **Properties** → set **Assignment required** to **Yes** → Save
3. **Users and groups** → **Add user/group** → select approved users or security groups

#### How it works

- Unauthenticated requests receive an HTTP `401 / 302` and are redirected to `login.microsoftonline.com`
- Users outside your tenant cannot sign in
- Company devices with Seamless SSO configured will sign in silently with no visible prompt — this is expected behaviour, not a bypass
- The app's service principal (used for Cost Management API calls) is separate from Easy Auth and is unaffected

> **Security reminder:** Never commit real credentials to source control. The `backend/.env` file is git-ignored. Rotate your client secret if it is ever accidentally exposed.

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Unauthenticated access | Azure App Service Easy Auth — redirects all unauthenticated requests to Microsoft login before they reach the app |
| External users | Only identities in your Azure AD tenant can complete the OAuth flow |
| Credentials in code | All Azure secrets in env vars only — never in source |
| Secret exposure | `.env` is git-ignored; `.env.example` has no real values |
| HTTP headers | `helmet` sets security headers (CSP, HSTS, etc.) |
| CORS | Restricted to configured `CORS_ORIGIN` only |
| Rate limiting | `express-rate-limit` — 100 req / 15 min per IP (custom key generator strips port from forwarded IPs) |
| Input validation | Zod schemas validate all query parameters |
| Error leakage | 500 errors return generic messages in production |
| Minimal permissions | Service Principal has **Cost Management Reader** only |
| TLS | Azure App Service enforces HTTPS only (`httpsOnly: true`) |
| TLS version | Minimum TLS 1.2 enforced in Bicep template |

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/costs/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Cost summary with KPIs, daily chart, top groups/services |
| `GET /api/costs/by-resource-group?startDate=...&endDate=...` | Costs grouped by resource group with service breakdown |
| `GET /api/costs/entries?startDate=...&endDate=...` | Raw daily cost entries |
| `GET /api/costs/health` | Liveness probe |
| `GET /health` | Root liveness probe (Azure App Service health check) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_TENANT_ID` | ✅ | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | ✅ | Service Principal client ID |
| `AZURE_CLIENT_SECRET` | ✅ | Service Principal client secret |
| `AZURE_SUBSCRIPTION_ID` | ✅ | Default subscription to query |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | `development` or `production` |
| `CORS_ORIGIN` | ❌ | Allowed CORS origin |
| `RATE_LIMIT_WINDOW_MS` | ❌ | Rate limit window in ms (default: 900000) |
| `RATE_LIMIT_MAX` | ❌ | Max requests per window (default: 100) |