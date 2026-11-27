# 01 · Platform: logs, monitor, ACR, identity, environment

Requires the variables from [README.md](README.md).

```bash
az group create -n "$RG" -l "$LOC"

# Log Analytics (PerGB2018, 30-day retention)
az monitor log-analytics workspace create -g "$RG" -n "$LAW" -l "$LOC" \
  --sku PerGB2018 --retention-time 30

# Workspace-based Application Insights
az extension add --name application-insights --only-show-errors
LAW_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query id -o tsv)
az monitor app-insights component create -g "$RG" -a "$AI" -l "$LOC" \
  --kind web --application-type web --workspace "$LAW_ID"

# Container Registry (Standard, admin enabled: elena-pre uses it to pull)
az acr create -g "$RG" -n "$ACR" -l "$LOC" --sku Standard --admin-enabled true

# Managed identity so Redis can pull without a password
az identity create -g "$RG" -n "$PULL_ID" -l "$LOC"
PULL_PRINCIPAL=$(az identity show -g "$RG" -n "$PULL_ID" --query principalId -o tsv)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
az role assignment create --assignee-object-id "$PULL_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"

# Container Apps environment (Consumption profile, logs to Azure Monitor)
az containerapp env create -g "$RG" -n "$ENV_NAME" -l "$LOC" \
  --logs-destination azure-monitor
```

> With `--logs-destination azure-monitor` you must also create a diagnostic setting on the environment that sends to `elena-logs`, otherwise the logs won't show up in Log Analytics:

```bash
ENV_ID=$(az containerapp env show -g "$RG" -n "$ENV_NAME" --query id -o tsv)
az monitor diagnostic-settings create --name to-law --resource "$ENV_ID" \
  --workspace "$LAW_ID" \
  --logs '[{"category":"ContainerAppConsoleLogs","enabled":true},{"category":"ContainerAppSystemLogs","enabled":true}]'
```

## Human access (optional)

The resource group grants `Contributor` to the team and `Owner` to the administrator:

```bash
az role assignment create --assignee <user@domain> --role Contributor \
  --scope "/subscriptions/$SUB/resourceGroups/$RG"
```
