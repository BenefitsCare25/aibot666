# Azure Web App Service Migration Guide

## Overview
Complete guide for migrating Insurance Chatbot from Render.com to Azure Web App Services.

**Current State:** Render.com (Singapore region)
**Target State:** Azure Web App (Southeast Asia region)

---

## Azure Resources to Create

| Resource | Azure Service | Name Pattern |
|----------|--------------|--------------|
| Backend API | App Service (Node 20 LTS) | `app-aibot-api` |
| Admin Frontend | Static Web App | `app-aibot-admin` |
| Redis | Azure Cache for Redis | `redis-aibot` |
| Document Worker | WebJob (in API App) | Continuous WebJob |

**Supabase:** No migration needed - stays as-is (already cloud-hosted)

---

## Phase 1: Code Changes (Required Before Deployment)

### 1.1 Update Widget Default API URL
**File:** `frontend/widget/src/embed.js`
```javascript
// Line 30 - Change from:
apiUrl = 'https://insurance-chatbot-api.onrender.com',
// To:
apiUrl = 'https://app-aibot-api.azurewebsites.net',
```

### 1.2 Update Widget Base URL for SRI Generation
**File:** `backend/scripts/generate-sri.js`
```javascript
// Line 43 - Change from:
const baseUrl = process.env.WIDGET_BASE_URL || 'https://aibot666.onrender.com';
// To:
const baseUrl = process.env.WIDGET_BASE_URL || 'https://app-aibot-api.azurewebsites.net';
```

### 1.3 Add TLS Support for Azure Redis
**File:** `backend/api/utils/session.js`

Update lines 11-18 to handle Azure Redis TLS (port 6380, `rediss://` protocol):
```javascript
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});
```

### 1.4 Update Document Worker Redis Connection
**File:** `backend/api/workers/documentWorker.js`

Update the `parseRedisUrl` function (lines 13-29) to handle Azure Redis TLS:
```javascript
const parseRedisUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const isTls = urlObj.protocol === 'rediss:';
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || (isTls ? 6380 : 6379),
      password: urlObj.password || undefined,
      username: urlObj.username || undefined,
      tls: isTls ? {} : undefined,
    };
  } catch (error) {
    console.error('Error parsing Redis URL:', error);
    return { host: 'localhost', port: 6379 };
  }
};
```

### 1.5 Add Azure Startup Configuration
**Create File:** `backend/startup.sh`
```bash
#!/bin/bash
npm start
```

---

## Phase 2: Azure Resource Provisioning

### 2.1 Create Resource Group
```bash
az group create --name rg-aibot-prod --location southeastasia
```

### 2.2 Create App Service Plan
```bash
az appservice plan create \
  --name plan-aibot \
  --resource-group rg-aibot-prod \
  --sku B1 \
  --is-linux
```

### 2.3 Create Azure Cache for Redis
```bash
az redis create \
  --name redis-aibot \
  --resource-group rg-aibot-prod \
  --location southeastasia \
  --sku Basic \
  --vm-size c0
```

**Note:** After creation, get the access key from Azure Portal:
- Navigate to: Redis resource > Access keys
- Copy the Primary connection string

### 2.4 Create Web App for Backend API
```bash
az webapp create \
  --name app-aibot-api \
  --resource-group rg-aibot-prod \
  --plan plan-aibot \
  --runtime "NODE:20-lts"
```

### 2.5 Create Static Web App for Admin
```bash
az staticwebapp create \
  --name app-aibot-admin \
  --resource-group rg-aibot-prod \
  --location southeastasia
```

---

## Phase 3: Environment Configuration

### 3.1 Backend API Environment Variables

Set in Azure Portal > App Service > Configuration > Application Settings:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `8080` | Azure uses 8080 |
| `OPENAI_API_KEY` | Copy from Render | |
| `OPENAI_MODEL` | `gpt-4o` | |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large` | |
| `OPENAI_TEMPERATURE` | `0` | |
| `OPENAI_MAX_TOKENS` | `1000` | |
| `SUPABASE_URL` | Copy from Render | No change |
| `SUPABASE_ANON_KEY` | Copy from Render | No change |
| `SUPABASE_SERVICE_KEY` | Copy from Render | No change |
| `SUPABASE_CONNECTION_STRING` | Copy from Render | No change |
| `REDIS_URL` | `rediss://:ACCESS_KEY@redis-aibot.redis.cache.windows.net:6380` | Azure format |
| `REDIS_SESSION_TTL` | `3600` | |
| `TELEGRAM_BOT_TOKEN` | Copy from Render | Optional |
| `TELEGRAM_CHAT_ID` | Copy from Render | Optional |
| `VECTOR_SIMILARITY_THRESHOLD` | `0.7` | |
| `TOP_K_RESULTS` | `5` | |
| `CONFIDENCE_THRESHOLD` | `0.7` | |
| `MAX_CONTEXT_LENGTH` | `3000` | |
| `ESCALATE_ON_NO_KNOWLEDGE` | `true` | |
| `ENABLE_WEB_SEARCH` | `false` | |
| `ENABLE_EMPLOYEE_VECTOR_SEARCH` | `false` | |
| `RATE_LIMIT_WINDOW_MS` | `60000` | |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | |
| `JWT_SECRET` | Generate new UUID | |
| `JWT_EXPIRY` | `24h` | |
| `SESSION_TIMEOUT_MINUTES` | `30` | |
| `CORS_ORIGIN` | `https://app-aibot-admin.azurestaticapps.net` | Update for Azure |
| `AZURE_CLIENT_ID` | Copy from Render | For email |
| `AZURE_CLIENT_SECRET` | Copy from Render | For email |
| `AZURE_TENANT_ID` | Copy from Render | For email |
| `AZURE_SERVICE_ACCOUNT_USERNAME` | Copy from Render | For email |
| `AZURE_SERVICE_ACCOUNT_PASSWORD` | Copy from Render | For email |
| `LOG_REQUEST_EMAIL_FROM` | Copy from Render | |
| `LOG_REQUEST_EMAIL_TO` | Copy from Render | |
| `LOG_REQUEST_KEYWORDS` | `request log,send logs,need log` | |
| `MAX_ATTACHMENT_SIZE` | `10485760` | |
| `MAX_ATTACHMENTS` | `5` | |
| `UPLOAD_DIR` | `./uploads` | |
| `WIDGET_BASE_URL` | `https://app-aibot-api.azurewebsites.net` | For SRI |

### 3.2 Static Web App Build Variables
```
VITE_API_URL=https://app-aibot-api.azurewebsites.net
```

---

## Phase 4: Deployment

### 4.1 Deploy Backend API

**Option A: GitHub Actions (Recommended)**

Create `.github/workflows/azure-backend.yml`:
```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd backend && npm ci --production

      - uses: azure/webapps-deploy@v2
        with:
          app-name: 'app-aibot-api'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: backend
```

**To get Publish Profile:**
1. Azure Portal > App Service > Deployment Center
2. Click "Manage publish profile" > Download
3. Add to GitHub Secrets as `AZURE_WEBAPP_PUBLISH_PROFILE`

**Option B: ZIP Deploy (Manual)**
```bash
cd backend
zip -r deploy.zip . -x "node_modules/*" -x ".env"
az webapp deployment source config-zip \
  --resource-group rg-aibot-prod \
  --name app-aibot-api \
  --src deploy.zip
```

### 4.2 Deploy Document Worker as WebJob

1. Create `backend/api/workers/run.sh`:
```bash
#!/bin/bash
cd /home/site/wwwroot/api/workers
node documentWorker.js
```

2. In Azure Portal:
   - Navigate to: App Service > WebJobs
   - Click "Add"
   - Name: `document-worker`
   - Type: Continuous
   - Upload the worker folder as ZIP

**Alternative:** The worker can also run within the same Node.js process if you modify `server.js` to spawn it on startup.

### 4.3 Deploy Admin Frontend

Create `.github/workflows/azure-admin.yml`:
```yaml
name: Deploy Admin to Azure Static Web Apps

on:
  push:
    branches: [main]
    paths:
      - 'frontend/admin/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: 'frontend/admin'
          output_location: 'dist'
        env:
          VITE_API_URL: https://app-aibot-api.azurewebsites.net
```

**To get Static Web App Token:**
1. Azure Portal > Static Web App > Manage deployment token
2. Add to GitHub Secrets as `AZURE_STATIC_WEB_APPS_TOKEN`

### 4.4 Rebuild Widget with New URLs

After code changes are deployed:
```bash
cd frontend/widget
npm run build
npm run copy-to-backend
npm run generate-sri
git add backend/public/widget.* backend/public/sri-hashes.json backend/public/embed-code.html
git commit -m "feat: update widget for Azure"
git push origin main
```

---

## Phase 5: Company Widget Migration

### New Embed Code Template
After deployment, the new embed code will be at `backend/public/embed-code.html`:

```html
<!-- Secure Widget Embed Code with SRI -->
<script
  src="https://app-aibot-api.azurewebsites.net/widget.iife.js"
  integrity="sha384-NEW_HASH_HERE"
  crossorigin="anonymous">
</script>
<link
  rel="stylesheet"
  href="https://app-aibot-api.azurewebsites.net/widget.css"
  integrity="sha384-NEW_CSS_HASH"
  crossorigin="anonymous">

<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://app-aibot-api.azurewebsites.net'
  });
</script>
```

### Migration Steps for Companies
1. Generate new SRI hashes after Azure deployment
2. Create updated embed code from `backend/public/embed-code.html`
3. Notify each company to update their embed code
4. Recommended: Run both Render and Azure in parallel for 2 weeks
5. After all companies migrate, decommission Render services

---

## Phase 6: Validation Checklist

### API Health
- [ ] `curl https://app-aibot-api.azurewebsites.net/health` returns OK
- [ ] Response includes `"redis": "connected"`
- [ ] Supabase queries work (check admin login)

### Admin Panel
- [ ] Login works at `https://app-aibot-admin.azurestaticapps.net`
- [ ] Dashboard loads data from API
- [ ] CRUD operations work (create/update/delete)
- [ ] Document upload triggers worker processing

### Widget
- [ ] Widget script loads with correct SRI hash
- [ ] CSS loads correctly
- [ ] Chat messages send/receive
- [ ] Multi-tenant company detection works
- [ ] Iframe embedding works (`/chat` route)

### Document Worker
- [ ] WebJob shows "Running" in Azure Portal > WebJobs
- [ ] Upload PDF via admin panel
- [ ] Job appears in BullMQ queue (check logs)
- [ ] Processing completes (status changes to "completed")
- [ ] Chunks appear in knowledge base

---

## Critical Files Summary

| File | Change Required |
|------|-----------------|
| `frontend/widget/src/embed.js:30` | Update default API URL |
| `backend/scripts/generate-sri.js:43` | Update widget base URL |
| `backend/api/utils/session.js:11-18` | Add TLS support for Redis |
| `backend/api/workers/documentWorker.js:13-29` | Add TLS support for Redis |
| `backend/startup.sh` | New file - Azure startup script |
| `.github/workflows/azure-backend.yml` | New file - CI/CD for backend |
| `.github/workflows/azure-admin.yml` | New file - CI/CD for admin |

---

## Rollback Plan

If migration fails:

1. **Keep Render running** during migration window (2 weeks recommended)
2. **DNS unchanged** initially (using Azure default domains)
3. **Supabase unchanged** - no rollback needed
4. **Revert code changes** if needed (git revert)
5. **Companies continue** using old Render embed codes

---

## Cost Comparison

| Service | Render (Current) | Azure (Proposed) |
|---------|------------------|------------------|
| Backend API | $7/mo (Starter) | ~$13/mo (B1 Basic) |
| Admin Frontend | Free (Static) | Free (Static Web App) |
| Document Worker | Included | Included (WebJob) |
| Redis | Free (25MB) | ~$16/mo (Basic C0) |
| **Total** | **~$7/mo** | **~$29/mo** |

### Cost Optimization Options
- **Dev/Test:** Use Azure Free Tier (F1) for testing
- **Reserved Instances:** Save 30-40% with 1-year commitment
- **Scale Down:** Use B1 and scale up only when needed
- **Functions:** Consider Azure Functions for worker (pay-per-execution)

---

## Troubleshooting

### Redis Connection Issues
```
Error: ECONNREFUSED
```
- Verify Redis URL uses `rediss://` protocol (TLS)
- Verify port is `6380` (not `6379`)
- Check Redis firewall rules in Azure Portal

### Widget Not Loading
```
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
```
- Verify SRI hashes match the deployed files
- Regenerate SRI hashes: `npm run generate-sri`
- Check CORS headers on backend

### WebJob Not Starting
- Check WebJob logs in Azure Portal > App Service > WebJobs > Logs
- Verify `run.sh` has execute permissions
- Ensure all environment variables are set

### Admin CORS Errors
```
Access-Control-Allow-Origin
```
- Update `CORS_ORIGIN` environment variable to include admin URL
- Restart App Service after changing environment variables

---

## Next Steps

1. [ ] Apply code changes (Phase 1)
2. [ ] Create Azure resources via CLI or Portal (Phase 2)
3. [ ] Configure all environment variables (Phase 3)
4. [ ] Set up GitHub Actions workflows (Phase 4)
5. [ ] Deploy and test each component (Phase 4)
6. [ ] Validate all functionality (Phase 6)
7. [ ] Coordinate company widget updates (Phase 5)
8. [ ] Monitor for 2 weeks, then decommission Render
