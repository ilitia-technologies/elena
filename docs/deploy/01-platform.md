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

# Container Registry (Standard, admin enabled for the web app to pull)
az acr create -g "$RG" -n "$ACR" -l "$LOC" --sku Standard --admin-enabled true

# Managed identity so Redis can pull without a password
az identity create -g "$RG" -n "$PULL_ID" -l "$LOC"
PULL_PRINCIPAL=$(az identity show -g "$RG" -n "$PULL_ID" --query principalId -o tsv)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
az role assignment create --assignee-object-id "$PULL_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"

# Connect the environment directly to this workspace.
# This needs the workspace customer ID, not its ARM resource ID.
LAW_CUSTOMER_ID=$(az monitor log-analytics workspace show -g "$RG" -n "$LAW" --query customerId -o tsv)
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LAW" --query primarySharedKey -o tsv)

# Container Apps environment (Consumption profile, logs to Log Analytics)
az containerapp env create -g "$RG" -n "$ENV_NAME" -l "$LOC" \
  --enable-workload-profiles true \
  --logs-destination log-analytics \
  --logs-workspace-id "$LAW_CUSTOMER_ID" --logs-workspace-key "$LAW_KEY" \
  --output none
unset LAW_KEY
```

Use **direct Log Analytics integration**, not `azure-monitor` without a diagnostic
setting. Otherwise, a workspace can exist without the environment having a route
to send logs to it. Application Insights uses
the same workspace independently; configuring it does not connect Container Apps logs.

Verify the environment's destination and workspace ID:

```bash
az containerapp env show -g "$RG" -n "$ENV_NAME" \
  --query 'properties.appLogsConfiguration.{destination:destination,workspace:logAnalyticsConfiguration.customerId}' -o json
test "$(az containerapp env show -g "$RG" -n "$ENV_NAME" \
  --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv)" = "$LAW_CUSTOMER_ID"
```

## Failure-anomaly alert

Do not assume the CLI creates the portal's default smart detector alert.
Explicitly create it against the new Application Insights resource. Create an
action group in the same resource group that notifies subscription Owners.
Keeping the action group local avoids a dependency on permissions to external
resource groups.

```bash
# The GUID below is Azure's built-in Owner role ID, not a subscription-specific ID.
az monitor action-group create -g "$RG" -n "$ALERT_GROUP" --short-name "$ALERT_SHORT_NAME" \
  --action armrole subscription-owners 8e3af657-a8ff-443c-a75c-2fe8c4bcb635 \
  --output none
ALERT_ACTION_GROUP_ID=$(az monitor action-group show -g "$RG" \
  -n "$ALERT_GROUP" --query id -o tsv)
AI_ID=$(az monitor app-insights component show -g "$RG" -a "$AI" --query id -o tsv)
az rest --method put \
  --url "https://management.azure.com/subscriptions/${SUB}/resourceGroups/${RG}/providers/Microsoft.AlertsManagement/smartDetectorAlertRules/Failure%20Anomalies%20-%20${AI}?api-version=2021-04-01" \
  --body "{
    \"location\": \"global\",
    \"properties\": {
    \"description\": \"Failure Anomalies notifies you of an unusual rise in the rate of failed HTTP requests or dependency calls.\",
    \"state\": \"Enabled\",
    \"severity\": \"Sev3\",
    \"frequency\": \"PT1M\",
    \"scope\": [\"${AI_ID}\"],
    \"detector\": {\"id\": \"FailureAnomaliesDetector\"},
    \"actionGroups\": {\"groupIds\": [\"${ALERT_ACTION_GROUP_ID}\"]}
    }
  }" --output none
```

## Verify log ingestion

After deploying the apps and sending a request, confirm **actual ingestion**
(initial ingestion can take several minutes):

```bash
az extension add --name log-analytics --allow-preview true --only-show-errors
az monitor log-analytics query --workspace "$LAW_CUSTOMER_ID" --analytics-query \
  'union isfuzzy=true ContainerAppConsoleLogs_CL, ContainerAppSystemLogs_CL
   | where TimeGenerated > ago(1h)
   | summarize Rows=count(), LastSeen=max(TimeGenerated) by Type, ContainerAppName_s' \
  -o table
```

Expect rows for both `$APP` and `$REDIS_APP`. A successful environment
deployment or live log stream alone does not prove workspace ingestion.

## Human access (optional)

If needed, grant team members `Contributor` on the resource group:

```bash
az role assignment create --assignee 'user@domain' --role Contributor \
  --scope "/subscriptions/$SUB/resourceGroups/$RG"
```
