#!/usr/bin/env bash
# deploy.sh — Build and deploy the Azure Cost Dashboard to Azure App Service
# Usage: ./deploy.sh <resource-group> <app-name>
# Prerequisites: Azure CLI logged in, zip installed, Node.js >= 18.

set -euo pipefail

RG="${1:?Usage: ./deploy.sh <resource-group> <app-name>}"
APP_NAME="${2:?Usage: ./deploy.sh <resource-group> <app-name>}"
STAGING=".deploy_staging"
KEEP_DEPLOY_ZIP="${KEEP_DEPLOY_ZIP:-0}"
KEEP_DEPLOY_STAGING="${KEEP_DEPLOY_STAGING:-0}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"

# Clean up staging dir and zip on exit (success or failure)
trap 'if [[ "$KEEP_DEPLOY_STAGING" != "1" ]]; then rm -rf "$STAGING"; fi; if [[ "$KEEP_DEPLOY_ZIP" != "1" ]]; then rm -f deploy.zip; fi' EXIT

echo "==> Building backend..."
cd backend
npm ci
npm run build
cd ..

echo "==> Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "==> Creating staging directory..."
rm -rf "$STAGING"
mkdir -p "$STAGING/backend" "$STAGING/frontend"

# Compiled backend JS
cp -r backend/dist "$STAGING/backend/dist"

# Built React SPA
cp -r frontend/dist "$STAGING/frontend/dist"

# Root-level package.json so the app can start
node -e "
const pkg = require('./backend/package.json');
pkg.scripts = { start: 'node backend/dist/server.js' };
pkg.main = 'backend/dist/server.js';
require('fs').writeFileSync('./$STAGING/package.json', JSON.stringify(pkg, null, 2));
"
cp backend/package-lock.json "$STAGING/package-lock.json"

echo "==> Installing production dependencies for the deployment..."
cd "$STAGING"
npm ci --omit=dev
cd ..

echo "==> Creating deployment archive..."
cd "$STAGING"
zip -r ../deploy.zip . -q --exclude "**/*.map"
cd ..

echo "==> Zip size: $(du -sh deploy.zip | cut -f1)"

if [[ "$SKIP_DEPLOY" == "1" ]]; then
  echo "==> SKIP_DEPLOY=1 set; skipping Azure deployment."
  exit 0
fi

echo "==> Ensuring Kudu build is disabled..."
az webapp config appsettings set \
  --resource-group "$RG" \
  --name "$APP_NAME" \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  --output none

# WEBSITE_RUN_FROM_PACKAGE conflicts with config-zip deployment — ensure it is removed.
az webapp config appsettings delete \
  --resource-group "$RG" \
  --name "$APP_NAME" \
  --setting-names WEBSITE_RUN_FROM_PACKAGE \
  --output none 2>/dev/null || true

echo "==> Waiting for App Service to apply settings and restart..."
sleep 20

echo "==> Deploying to Azure App Service: ${APP_NAME}..."

# az webapp deploy blocks until Azure accepts the zip.
# Kudu sometimes drops the TCP connection after receiving the file but before
# sending the 202 response (RemoteDisconnected / ConnectionError). The deployment
# still proceeds in that case, so we treat that specific error as non-fatal and
# fall through to the health-poll. Any other non-zero exit is a real failure.
DEPLOY_OUT=$(az webapp deploy \
  --resource-group "$RG" \
  --name "$APP_NAME" \
  --src-path deploy.zip \
  --type zip \
  --output none 2>&1) && DEPLOY_EXIT=0 || DEPLOY_EXIT=$?

if [[ "$DEPLOY_EXIT" -ne 0 ]]; then
  if echo "$DEPLOY_OUT" | grep -q "RemoteDisconnected\|ConnectionError\|Connection aborted"; then
    echo "==> Deploy command disconnected (Kudu connection drop — deployment likely succeeded). Falling through to health check..."
  else
    echo "==> Deployment failed:"
    echo "$DEPLOY_OUT"
    exit 1
  fi
fi

echo "==> Package accepted. Waiting for site to come up..."

# Poll /health every 30s until the app responds (max 10 minutes).
MAX_WAIT=600
ELAPSED=0
POLL_INTERVAL=30

while true; do
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    "https://${APP_NAME}.azurewebsites.net/health" 2>/dev/null || echo "000")

  echo "    [${ELAPSED}s] HTTP ${HTTP_CODE}"

  # Any real HTTP response means the site is up (401/302 = Easy Auth is running)
  if [[ "$HTTP_CODE" =~ ^(200|301|302|401|403)$ ]]; then
    echo "==> Site is live (HTTP ${HTTP_CODE})."
    break
  fi

  if [[ "$ELAPSED" -ge "$MAX_WAIT" ]]; then
    echo "==> Site did not respond within ${MAX_WAIT}s — check App Service logs."
    exit 1
  fi
done

echo "==> Done! App deployed to: https://${APP_NAME}.azurewebsites.net"
