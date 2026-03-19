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
for attempt in 1 2 3; do
  echo "    Attempt $attempt/3"
  if az webapp deployment source config-zip \
    --resource-group "$RG" \
    --name "$APP_NAME" \
    --src deploy.zip \
    --timeout 600; then
    break
  fi
  if [[ "$attempt" -lt 3 ]]; then
    echo "    Deploy failed; retrying in 10s..."
    sleep 10
  else
    echo "    Deploy failed after 3 attempts."
    exit 1
  fi
done

echo "==> Done! App deployed to: https://${APP_NAME}.azurewebsites.net"
