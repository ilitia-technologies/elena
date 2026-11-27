# 02 · Microsoft Foundry and model

```bash
# AIServices account with a custom subdomain and project management enabled
az cognitiveservices account create -g "$RG" -n "$FOUNDRY" -l "$LOC" \
  --kind AIServices --sku S0 --custom-domain "$FOUNDRY" --yes
az resource update --ids "$(az cognitiveservices account show -g "$RG" -n "$FOUNDRY" --query id -o tsv)" \
  --set properties.allowProjectManagement=true

# Model deployment (GlobalStandard, capacity 50)
az cognitiveservices account deployment create -g "$RG" -n "$FOUNDRY" \
  --deployment-name gpt-6-luna \
  --model-name gpt-6-luna --model-version 2026-09-22 --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity 50
```

Resulting endpoint: `https://elena-foundry.cognitiveservices.azure.com/`.

Key and Application Insights connection string (used in [04-app.md](04-app.md)):

```bash
export FOUNDRY_ENDPOINT=$(az cognitiveservices account show -g "$RG" -n "$FOUNDRY" --query properties.endpoint -o tsv)
export FOUNDRY_API_KEY=$(az cognitiveservices account keys list -g "$RG" -n "$FOUNDRY" --query key1 -o tsv)
export AI_CONN=$(az monitor app-insights component show -g "$RG" -a "$AI" --query connectionString -o tsv)
```

> The app also supports Entra ID (`DefaultAzureCredential`) when `FOUNDRY_API_KEY` is not set; the current deployment uses a key.
