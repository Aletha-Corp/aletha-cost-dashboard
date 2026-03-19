#!/usr/bin/env bash
# setup-service-principal.sh
# Creates an Azure Service Principal with the minimum required permissions
# (Cost Management Reader) and prints the credentials you need for .env

set -euo pipefail

SUBSCRIPTION_ID="${1:?Usage: ./setup-service-principal.sh <subscription-id> [sp-name]}"
SP_NAME="${2:-aletha-cost-dashboard-sp}"

echo "==> Creating Service Principal: ${SP_NAME}"
echo "    Subscription: ${SUBSCRIPTION_ID}"
echo ""

SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role "Cost Management Reader" \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}" \
  --output json)

echo "==> Assigning Reader role (required for resource/tag metadata)..."
PRINCIPAL_ID=$(echo "$SP_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Reader" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}" \
  --output none

echo "==> Assigning Monitoring Reader role (required for activity log / creator info)..."
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Monitoring Reader" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}" \
  --output none

TENANT_ID=$(az account show --query tenantId -o tsv)
CLIENT_ID=$(echo "$SP_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
CLIENT_SECRET=$(echo "$SP_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")

echo "==> Service Principal created. Add these to backend/.env:"
echo ""
echo "AZURE_TENANT_ID=${TENANT_ID}"
echo "AZURE_CLIENT_ID=${CLIENT_ID}"
echo "AZURE_CLIENT_SECRET=${CLIENT_SECRET}"
echo "AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}"
echo ""
echo "IMPORTANT: Store the client secret securely. It cannot be retrieved again."


