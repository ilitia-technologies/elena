# 00 · Destructive reset (optional)

**This deletes the running deployment, all registry images, Redis quotas and
telemetry history.** Use only when intentionally testing a full rebuild.
Recreation can fail because of capacity or globally unique name availability.
Foundry keys and the web app URL can change; refresh local development settings
afterwards. Keep any unrelated `.env` settings backed up privately.

Load the variables in [README.md](README.md) first. The resource group and its
human access assignments are preserved. Review the inventory and ensure it
contains only the documented resources before proceeding:

```bash
az resource list --subscription "$SUB" -g "$RG" \
  --query '[].{name:name,type:type}' -o table
```

Run only after explicitly approving the deletion:

```bash
set -euo pipefail
az account set --subscription "$SUB"

# Remove apps before their environment.
az containerapp delete -g "$RG" -n "$APP" --yes
az containerapp delete -g "$RG" -n "$REDIS_APP" --yes
az containerapp env delete -g "$RG" -n "$ENV_NAME" --yes

# Soft-delete; step 02 recovers the name and rotates both keys.
az cognitiveservices account delete -g "$RG" -n "$FOUNDRY"
export FOUNDRY_RECOVER=true

az acr delete -g "$RG" -n "$ACR" --yes
az identity delete -g "$RG" -n "$PULL_ID"
az resource delete --ids \
  "/subscriptions/$SUB/resourceGroups/$RG/providers/microsoft.alertsmanagement/smartDetectorAlertRules/Failure Anomalies - ${AI}"
# Only present after deploying the new, self-contained alert configuration.
if az monitor action-group list -g "$RG" --query '[].name' -o tsv | grep -Fxq "$ALERT_GROUP"; then
  az monitor action-group delete -g "$RG" -n "$ALERT_GROUP"
fi
az monitor app-insights component delete -g "$RG" -a "$AI"

# Force permanently deletes the workspace and releases its name.
az monitor log-analytics workspace delete -g "$RG" -n "$LAW" --force true --yes

az resource list -g "$RG" --query '[].{name:name,type:type}' -o json
```

The final inventory must be empty. Then follow steps 01–04 to rebuild. Do not
repeat these destructive commands as a recovery step for a partial creation:
inspect the failure and resume from the failed command instead.

The Foundry account remains soft-deleted until step 02. Resource-group Owner
does not grant permission to purge it at subscription scope. Recovering it is
the tested path here; it does not validate fresh account creation. A subscription
administrator can instead purge it before deploying with `FOUNDRY_RECOVER=false`:

```bash
az cognitiveservices account purge -g "$RG" -n "$FOUNDRY" -l "$LOC"
export FOUNDRY_RECOVER=false
```
