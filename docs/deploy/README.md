# Deploying Elena on Azure

Manual guide (Azure CLI + bash) for deploying into your own resource group. No azd, no Bicep.

| Resource | Type | Doc |
| --- | --- | --- |
| `$LAW` | Log Analytics workspace | [01-platform.md](01-platform.md) |
| `$AI` | Application Insights (workspace-based) | [01-platform.md](01-platform.md) |
| `Failure Anomalies - ${AI}` | Smart detector alert rule | [01-platform.md](01-platform.md) |
| `$ALERT_GROUP` | Action group (notifies subscription Owners) | [01-platform.md](01-platform.md) |
| `$ACR` | Container Registry (Standard) | [01-platform.md](01-platform.md) |
| `$PULL_ID` | User-assigned managed identity (`AcrPull`) | [01-platform.md](01-platform.md) |
| `$ENV_NAME` | Container Apps environment (Consumption) | [01-platform.md](01-platform.md) |
| `$FOUNDRY` | Foundry / AIServices + `$MODEL_DEPLOYMENT` deployment | [02-foundry.md](02-foundry.md) |
| `$REDIS_APP` | Container App (Redis, internal TCP) | [03-redis.md](03-redis.md) |
| `$APP` | Container App (web + API) | [04-app.md](04-app.md) |
| local `.env` | Local development settings | [05-local-env.md](05-local-env.md) |

The smart detector alert uses `$ALERT_GROUP` in the same resource group.
No external action group is required or modified.

## Order

1. `01-platform.md` → 2. `02-foundry.md` → 3. `03-redis.md` → 4. `04-app.md` (optional: `05-local-env.md` after step 2)

For an intentionally destructive clean-room test, first follow
[00-reset.md](00-reset.md). This is not needed for normal deployment.

## Common variables

Replace every `<...>` placeholder with your own value before running any commands.
All scripts assume these variables (paste them into the same shell, or keep them
in a `deploy.env` **outside git**). Choose a model, version, deployment SKU and
capacity available in your subscription and region.

```bash
export SUB='<subscription-id>'
export RG='<resource-group-name>'
export LOC='<azure-region>'
export ACR='<globally-unique-registry-name>'
export ENV_NAME='<container-apps-environment-name>'
export PULL_ID='<registry-pull-identity-name>'
export LAW='<log-analytics-workspace-name>'
export AI='<application-insights-name>'
export FOUNDRY='<globally-unique-foundry-account-name>'
export REDIS_APP='<redis-container-app-name>'
export APP='<web-container-app-name>'
export ALERT_GROUP='<action-group-name>'
export ALERT_SHORT_NAME='<action-group-short-name>'
export MODEL_DEPLOYMENT='<model-deployment-name>'
export MODEL_NAME='<model-name>'
export MODEL_VERSION='<model-version>'
export MODEL_SKU='<model-deployment-sku>'
export MODEL_CAPACITY='<model-deployment-capacity>'
export IMAGE_REPOSITORY='<application-image-repository>'

az account show --output none || az login --output none
az account set --subscription "$SUB"
az extension add --name containerapp --upgrade --only-show-errors
for provider in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry \
  Microsoft.CognitiveServices Microsoft.Insights Microsoft.ManagedIdentity Microsoft.AlertsManagement; do
  if [[ "$(az provider show --namespace "$provider" --query registrationState -o tsv)" != Registered ]]; then
    az provider register --namespace "$provider" --wait
  fi
done
```

Provider registration needs subscription-level permissions. Already-registered
providers are skipped, allowing a resource-group Owner to run the deployment.
If a provider is unregistered, ask a subscription administrator to register it.

## Secrets

Never commit secrets. The values (`FOUNDRY_API_KEY`, `QUOTA_IDENTITY_SECRET`, the Redis password) are generated or fetched by the scripts and passed as Container Apps secrets.

Run the commands in Bash with `set -euo pipefail` and `umask 077`. Do not enable
shell tracing (`set -x`), which would print credentials. Resource names such as
the registry name and Foundry subdomain must be globally unique.

## Verification checklist

- Verify Redis has its config secret mounted as a file, internal TCP ingress,
  and exactly one replica.
- Send a production question and check that it passes the Redis quota check and
  returns a model-built UI with `fallback: false`.
- Query **both console and system logs for both Container Apps from `$LAW`**,
  not just from the live log stream.
- Generate the local `.env` and verify Foundry authentication.
- Distinguish a fresh Foundry account creation from the soft-delete/recovery
  path; validating one does not validate the other.
