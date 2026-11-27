# 02 · Microsoft Foundry and model

```bash
if [[ "${FOUNDRY_RECOVER:-false}" == true ]]; then
  # Reset path: preserve the name without requiring subscription-level purge.
  az cognitiveservices account recover -g "$RG" -n "$FOUNDRY" -l "$LOC" --output none
  az cognitiveservices account keys regenerate -g "$RG" -n "$FOUNDRY" --key-name Key1 --output none
  az cognitiveservices account keys regenerate -g "$RG" -n "$FOUNDRY" --key-name Key2 --output none
  # A recovered account may retain model deployments. Recreate them explicitly.
  for deployment in $(az cognitiveservices account deployment list -g "$RG" -n "$FOUNDRY" --query '[].name' -o tsv); do
    az cognitiveservices account deployment delete -g "$RG" -n "$FOUNDRY" \
      --deployment-name "$deployment"
  done
else
  # Fresh installation.
  az cognitiveservices account create -g "$RG" -n "$FOUNDRY" -l "$LOC" \
    --kind AIServices --sku S0 --custom-domain "$FOUNDRY" \
    --allow-project-management true --yes --output none
fi

# Deploy the model with the SKU and capacity you selected.
az cognitiveservices account deployment create -g "$RG" -n "$FOUNDRY" \
  --deployment-name "$MODEL_DEPLOYMENT" \
  --model-name "$MODEL_NAME" --model-version "$MODEL_VERSION" --model-format OpenAI \
  --sku-name "$MODEL_SKU" --sku-capacity "$MODEL_CAPACITY"
```

For a fresh account, leave `FOUNDRY_RECOVER` unset. After the documented reset,
it is `true`: the soft-deleted account is recovered, both keys are rotated and
its model deployment is recreated. This is **not** a fresh account creation.
A full purge requires subscription-level permissions, even for a resource-group
Owner, and may prevent immediate reuse of the name.

Read the endpoint from the account rather than hardcoding its hostname.

Key and Application Insights connection string (used in [04-app.md](04-app.md)):

```bash
export FOUNDRY_ENDPOINT=$(az cognitiveservices account show -g "$RG" -n "$FOUNDRY" --query properties.endpoint -o tsv)
export FOUNDRY_API_KEY=$(az cognitiveservices account keys list -g "$RG" -n "$FOUNDRY" --query key1 -o tsv)
export AI_CONN=$(az monitor app-insights component show -g "$RG" -a "$AI" --query connectionString -o tsv)
```

> These scripts use a key. The app also supports Entra ID (`DefaultAzureCredential`) when `FOUNDRY_API_KEY` is not set.
