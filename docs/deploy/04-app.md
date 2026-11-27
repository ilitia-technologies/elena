# 04 · Application (`$APP`)

Requires steps 01–03 and the exported `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY`, `AI_CONN` and `QUOTA_REDIS_URL`.

## 1. Build and push the image

From the repo root (uses the `Dockerfile`); choose a unique version tag:

```bash
TAG=v1
az acr build -r "$ACR" -t "${IMAGE_REPOSITORY}:${TAG}" .
```

## 2. Create the Container App

```bash
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
QUOTA_IDENTITY_SECRET=$(openssl rand -hex 32)   # ≥ 32 bytes; changing it invalidates existing browser identities

az containerapp create -g "$RG" -n "$APP" --environment "$ENV_NAME" \
  --image "${ACR}.azurecr.io/${IMAGE_REPOSITORY}:${TAG}" \
  --registry-server "${ACR}.azurecr.io" --registry-username "$ACR" --registry-password "$ACR_PASS" \
  --ingress external --target-port 8787 --transport auto \
  --cpu 0.5 --memory 1Gi \
  --min-replicas 0 --max-replicas 10 \
  --scale-rule-name http-scaler --scale-rule-type http --scale-rule-http-concurrency 10 \
  --revision-suffix "$TAG" \
  --secrets "quota-redis-url=${QUOTA_REDIS_URL}" "quota-identity-secret=${QUOTA_IDENTITY_SECRET}" \
    "foundry-api-key=${FOUNDRY_API_KEY}" \
  --env-vars \
    FOUNDRY_ENDPOINT="$FOUNDRY_ENDPOINT" \
    FOUNDRY_MODEL_DEPLOYMENT="$MODEL_DEPLOYMENT" \
    FOUNDRY_API_KEY=secretref:foundry-api-key \
    APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONN" \
    QUOTA_REDIS_URL=secretref:quota-redis-url \
    QUOTA_IDENTITY_SECRET=secretref:quota-identity-secret
```

Notes:

- `NODE_ENV=production` is set by the `Dockerfile`; in production the app requires `QUOTA_REDIS_URL` and `QUOTA_IDENTITY_SECRET`.
- `FOUNDRY_API_KEY` is stored as a Container Apps secret, rather than a plain environment variable.
- Probes: default TCP probes on port 8787 (liveness, readiness, startup).

## 3. Ship a new version

```bash
TAG=v2
az acr build -r "$ACR" -t "${IMAGE_REPOSITORY}:${TAG}" .
az containerapp update -g "$RG" -n "$APP" \
  --image "${ACR}.azurecr.io/${IMAGE_REPOSITORY}:${TAG}" --revision-suffix "$TAG"
```

## 4. Verify

```bash
FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
curl --fail-with-body --silent --show-error "https://${FQDN}/api/health"
curl --fail --silent --show-error --output /dev/null "https://${FQDN}/"
az containerapp logs show -g "$RG" -n "$APP" --tail 30
```

The health endpoint verifies startup configuration, **not** Redis or model access.
Check both through a real question (this consumes one model request). Production
first establishes a signed browser cookie with HTTP 428; retry with that cookie:

```bash
COOKIE_FILE=$(mktemp)
RESPONSE_FILE=$(mktemp)
trap 'rm -f "$COOKIE_FILE" "$RESPONSE_FILE"' EXIT

STATUS=$(curl --silent --show-error --max-time 120 \
  -c "$COOKIE_FILE" -o "$RESPONSE_FILE" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"question":"Recomiéndame una lavadora de menos de 500 euros.","surfaceId":"deployment-check"}' \
  "https://${FQDN}/api/ask")
test "$STATUS" = 428

curl --fail-with-body --silent --show-error --no-buffer --max-time 120 \
  -b "$COOKIE_FILE" -o "$RESPONSE_FILE" \
  -H 'Content-Type: application/json' \
  -d '{"question":"Recomiéndame una lavadora de menos de 500 euros.","surfaceId":"deployment-check"}' \
  "https://${FQDN}/api/ask"
if grep -q '^event: error' "$RESPONSE_FILE"; then
  cat "$RESPONSE_FILE" >&2
  exit 1
fi
grep '^event: done' "$RESPONSE_FILE"
grep '"fallback":false' "$RESPONSE_FILE"
rm -f "$COOKIE_FILE" "$RESPONSE_FILE"
trap - EXIT
```

HTTP 503 indicates the Redis quota backend is unavailable. An SSE `error` or
`"fallback":true` is not a successful model/UI check, even with HTTP 200.
Finally run the workspace ingestion query in [01-platform.md](01-platform.md).
