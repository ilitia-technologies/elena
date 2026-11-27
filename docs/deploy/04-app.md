# 04 · Application (`elena-pre`)

Requires steps 01–03 and the exported `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY`, `AI_CONN` and `QUOTA_REDIS_URL`.

## 1. Build and push the image

From the repo root (uses the `Dockerfile`); the current tag is `003`:

```bash
TAG=003
az acr build -r "$ACR" -t "elena:${TAG}" .
```

## 2. Create the Container App

```bash
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
QUOTA_IDENTITY_SECRET=$(openssl rand -hex 32)   # ≥ 32 bytes; changing it invalidates existing browser identities

az containerapp create -g "$RG" -n "$APP" --environment "$ENV_NAME" \
  --image "${ACR}.azurecr.io/elena:${TAG}" \
  --registry-server "${ACR}.azurecr.io" --registry-username "$ACR" --registry-password "$ACR_PASS" \
  --ingress external --target-port 8787 --transport auto \
  --cpu 0.5 --memory 1Gi \
  --min-replicas 0 --max-replicas 10 \
  --scale-rule-name http-scaler --scale-rule-type http --scale-rule-http-concurrency 10 \
  --revision-suffix "elena-pre-${TAG#0}" \
  --secrets "quota-redis-url=${QUOTA_REDIS_URL}" "quota-identity-secret=${QUOTA_IDENTITY_SECRET}" \
  --env-vars \
    FOUNDRY_ENDPOINT="$FOUNDRY_ENDPOINT" \
    FOUNDRY_MODEL_DEPLOYMENT=gpt-6-luna \
    FOUNDRY_API_KEY="$FOUNDRY_API_KEY" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONN" \
    QUOTA_REDIS_URL=secretref:quota-redis-url \
    QUOTA_IDENTITY_SECRET=secretref:quota-identity-secret
```

Notes:

- `NODE_ENV=production` is set by the `Dockerfile`; in production the app requires `QUOTA_REDIS_URL` and `QUOTA_IDENTITY_SECRET`.
- `FOUNDRY_API_KEY` is currently a plain env var; better as a secret: `--secrets foundry-api-key=...` and `FOUNDRY_API_KEY=secretref:foundry-api-key`.
- Probes: default TCP probes on port 8787 (liveness, readiness, startup).

## 3. Ship a new version

```bash
TAG=004
az acr build -r "$ACR" -t "elena:${TAG}" .
az containerapp update -g "$RG" -n "$APP" \
  --image "${ACR}.azurecr.io/elena:${TAG}" --revision-suffix "elena-pre-${TAG#0}"
```

## 4. Verify

```bash
FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
curl -sI "https://${FQDN}/" | head -n 1
az containerapp logs show -g "$RG" -n "$APP" --tail 30
```
