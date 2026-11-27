# Deploying Elena on Azure

Manual guide (Azure CLI + bash) for the resources in resource group `A2UIDemo`. No azd, no Bicep.

| Resource | Type | Doc |
| --- | --- | --- |
| `elena-logs` | Log Analytics workspace | [01-platform.md](01-platform.md) |
| `elena-monitor` | Application Insights (workspace-based) | [01-platform.md](01-platform.md) |
| `Failure Anomalies - elena-monitor` | Smart detector alert rule | [01-platform.md](01-platform.md) |
| `elena-alerts` | Action group (notifies subscription Owners) | [01-platform.md](01-platform.md) |
| `elenaacr` | Container Registry (Standard) | [01-platform.md](01-platform.md) |
| `elenaacr-pull` | User-assigned managed identity (`AcrPull`) | [01-platform.md](01-platform.md) |
| `elena-apps` | Container Apps environment (Consumption) | [01-platform.md](01-platform.md) |
| `elena-foundry` | Foundry / AIServices + `gpt-6-luna` deployment | [02-foundry.md](02-foundry.md) |
| `elena-pre-redis` | Container App (Redis, internal TCP) | [03-redis.md](03-redis.md) |
| `elena-pre` | Container App (web + API) | [04-app.md](04-app.md) |
| local `.env` | Local development settings | [05-local-env.md](05-local-env.md) |

The smart detector alert uses `elena-alerts` in this resource group. This replaces
the previous cross-resource-group action-group reference, which was inaccessible
to the deploying identity. No external action group is modified.

## Order

1. `01-platform.md` → 2. `02-foundry.md` → 3. `03-redis.md` → 4. `04-app.md` (optional: `05-local-env.md` after step 2)

For an intentionally destructive clean-room test, first follow
[00-reset.md](00-reset.md). This is not needed for normal deployment.

## Common variables

All scripts assume these variables (paste them into the same shell, or keep them in a `deploy.env` **outside git**):

```bash
export SUB=28508e6b-28ed-456c-a003-e4af5e5209dc
export RG=A2UIDemo
export LOC=spaincentral
export ACR=elenaacr
export ENV_NAME=elena-apps
export PULL_ID=elenaacr-pull
export LAW=elena-logs
export AI=elena-monitor
export FOUNDRY=elena-foundry
export REDIS_APP=elena-pre-redis
export APP=elena-pre
export ALERT_GROUP=elena-alerts

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

## Rebuild verification

The reset/rebuild path was exercised against `A2UIDemo` on 2026-11-27 using
these Bash blocks. The resource group and its access assignments were retained.
The deployment now contains ten resources, including the new local action group.

- Redis was created from scratch with the native CLI flags, its config secret
  mounted as a file, internal TCP ingress, and exactly one replica.
- A production question passed the Redis quota check and returned a model-built
  UI with `fallback: false`.
- **Both console and system logs for both Container Apps were queried from
  `elena-logs`**, not just from the live log stream.
- The local `.env` generation authenticated against Foundry with a rotated key.

Foundry was soft-deleted and **recovered**, with both keys rotated and the model
deployment recreated, because subscription-level purge was denied. The fresh
account creation branch in step 02 was not exercised by this rebuild.
