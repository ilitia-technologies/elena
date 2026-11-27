# Deploying Elena on Azure

Manual guide (Azure CLI + bash) for the resources in resource group `A2UIDemo`. No azd, no Bicep.

| Resource | Type | Doc |
| --- | --- | --- |
| `elena-logs` | Log Analytics workspace | [01-platform.md](01-platform.md) |
| `elena-monitor` | Application Insights (workspace-based) | [01-platform.md](01-platform.md) |
| `elenaacr` | Container Registry (Standard) | [01-platform.md](01-platform.md) |
| `elenaacr-pull` | User-assigned managed identity (`AcrPull`) | [01-platform.md](01-platform.md) |
| `elena-apps` | Container Apps environment (Consumption) | [01-platform.md](01-platform.md) |
| `elena-foundry` | Foundry / AIServices + `gpt-6-luna` deployment | [02-foundry.md](02-foundry.md) |
| `elena-pre-redis` | Container App (Redis, internal TCP) | [03-redis.md](03-redis.md) |
| `elena-pre` | Container App (web + API) | [04-app.md](04-app.md) |
| local `.env` | Local development settings | [05-local-env.md](05-local-env.md) |

`Failure Anomalies - elena-monitor` (smart detector rule) is created automatically by Application Insights.

## Order

1. `01-platform.md` → 2. `02-foundry.md` → 3. `03-redis.md` → 4. `04-app.md` (optional: `05-local-env.md` after step 2)

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

az login
az account set --subscription "$SUB"
az extension add --name containerapp --upgrade --only-show-errors
az provider register -n Microsoft.App -n Microsoft.OperationalInsights \
  -n Microsoft.ContainerRegistry -n Microsoft.CognitiveServices --wait
```

## Secrets

Never commit secrets. The values (`FOUNDRY_API_KEY`, `QUOTA_IDENTITY_SECRET`, the Redis password) are generated or fetched by the scripts and passed as Container Apps secrets.
