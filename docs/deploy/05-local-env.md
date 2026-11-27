# 05 · Local development `.env`

Generates the repo-root `.env` (git-ignored) with the Foundry settings and key, so `npm run dev` works locally. Requires the variables from [README.md](README.md) and `az login`.

```bash
# Run from the repo root
[ -f .env ] && { echo ".env already exists; move it first" >&2; return 1 2>/dev/null || exit 1; }

FOUNDRY_ENDPOINT=$(az cognitiveservices account show -g "$RG" -n "$FOUNDRY" --query properties.endpoint -o tsv)
FOUNDRY_API_KEY=$(az cognitiveservices account keys list -g "$RG" -n "$FOUNDRY" --query key1 -o tsv)

umask 077
cat > .env <<EOF
FOUNDRY_ENDPOINT=${FOUNDRY_ENDPOINT}
FOUNDRY_MODEL_DEPLOYMENT=${MODEL_DEPLOYMENT}
FOUNDRY_API_KEY=${FOUNDRY_API_KEY}
EOF

echo ".env written"
```

Then:

```bash
npm ci
npm run dev   # http://localhost:8787
```

Notes:

- The quota (`QUOTA_REDIS_URL`, `QUOTA_IDENTITY_SECRET`) is only enforced when `NODE_ENV=production`, so it isn't needed locally. Redis is internal to the Container Apps environment and not reachable from your machine anyway.
- Telemetry is optional: to send it to Application Insights, append  
  `echo "APPLICATIONINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show -g "$RG" -a "$AI" --query connectionString -o tsv)" >> .env`
- Keyless alternative: omit `FOUNDRY_API_KEY`; the app then uses `DefaultAzureCredential` (`az login`), which needs the `Cognitive Services OpenAI User` role on `$FOUNDRY`.
- Never commit `.env`.
