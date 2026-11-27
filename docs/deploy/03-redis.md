# 03 · Redis (`elena-pre-redis`)

Redis stores the per-browser quota (`server/quota.ts`). It runs as a **Container App** inside the environment, not as Azure Cache for Redis. Key design points of the current deployment:

| Aspect | Value |
| --- | --- |
| Image | `elenaacr.azurecr.io/redis:8-alpine` (copy of `redis:8-alpine` in our ACR) |
| Pull | Managed identity `elenaacr-pull` (`AcrPull`), no password |
| Ingress | **Internal**, **TCP** transport, `targetPort` and `exposedPort` 6379 |
| Replicas | min 1 / max 1 (Redis doesn't scale out; never `minReplicas: 0`) |
| Resources | 0.25 vCPU, 0.5 Gi |
| Password | Secret `redis-conf` holding the **whole config file**, mounted as a *Secret* volume at `/mnt/secrets` and started as `redis-server /mnt/secrets/redis-conf` |
| Persistence | Ephemeral storage only: no durable data volume; quota survival across restarts/revisions is not guaranteed |
| Probes | None customised (platform defaults) |

Why the config file as a secret: the password never appears in the app's `command`/`args`/env. The secret `redis-conf` is mounted as the file `/mnt/secrets/redis-conf` (secret name = file name).

## 1. Import the image into the ACR

```bash
az acr import -n "$ACR" --source docker.io/library/redis:8-alpine --image redis:8-alpine
```

## 2. Generate the password and config

```bash
REDIS_PASSWORD=$(openssl rand -hex 32)
REDIS_CONF="requirepass ${REDIS_PASSWORD}"
```

> The deployed file contains only `requirepass`. To see the current one: `az containerapp secret show -n elena-pre-redis -g A2UIDemo --secret-name redis-conf` (it prints the password: don't paste it into logs or the repo).

## 3. Create the Container App

Use the CLI's secret-volume and TCP ingress flags directly. No YAML file
containing credentials is needed. The identity requires the `AcrPull` assignment
from step 01; allow time for a new assignment to propagate if the pull is denied.

```bash
PULL_ID_RES=$(az identity show -g "$RG" -n "$PULL_ID" --query id -o tsv)

az containerapp create -g "$RG" -n "$REDIS_APP" --environment "$ENV_NAME" \
  --image "${ACR}.azurecr.io/redis:8-alpine" \
  --user-assigned "$PULL_ID_RES" \
  --registry-server "${ACR}.azurecr.io" --registry-identity "$PULL_ID_RES" \
  --ingress internal --transport tcp --target-port 6379 --exposed-port 6379 \
  --cpu 0.25 --memory 0.5Gi --min-replicas 1 --max-replicas 1 \
  --secrets "redis-conf=${REDIS_CONF}" --secret-volume-mount /mnt/secrets \
  --command redis-server --args /mnt/secrets/redis-conf \
  --output none
```

## 4. Verify

```bash
az containerapp show -g "$RG" -n "$REDIS_APP" \
  --query "{fqdn:properties.configuration.ingress.fqdn,transport:properties.configuration.ingress.transport,running:properties.runningStatus}" -o json
az containerapp logs show -g "$RG" -n "$REDIS_APP" --tail 20
```

You should see `Ready to accept connections tcp`. To test from another app in the environment:

```bash
az containerapp exec -g "$RG" -n "$APP" --command "sh"
# inside: use a redis client against host elena-pre-redis, port 6379
```

## 5. URL for the app

Inside the environment the service is reachable by the app name (or the internal FQDN `elena-pre-redis.internal.<environment-domain>`):

```bash
export QUOTA_REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_APP}:6379"
```

It is injected into `elena-pre` as the secret `quota-redis-url` ([04-app.md](04-app.md)). If the password had special characters you would need to URL-encode it (not needed with `openssl rand -hex`).

## Notes and pitfalls

- **Internal TCP ≠ HTTP**: ingress must be `transport: tcp`; with `auto`/`http` Redis won't respond. `exposedPort` is only valid with TCP.
- Reachable only from apps in the **same environment** (`external: false`); no Internet access.
- Rotating the password: update the `redis-conf` secret (`az containerapp secret set`), create a new Redis revision, and update `quota-redis-url` in `elena-pre`.
- No persistence: fine for quotas (they reset), not for data that must be kept.
- Changes to a secret mounted as a volume need a new revision/restart to take effect.
