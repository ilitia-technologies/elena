# Elena - A2UI Retail Demo

Elena is a Spanish-language appliance-shopping assistant built to demonstrate **generative UI (GenUI)** with [A2UI](https://a2ui.org/). Instead of returning a conventional chat answer, the assistant generates a new, interactive shopping screen tailored to each question.

## What the demo shows

- **Natural language to UI:** Ask for a recommendation, comparison, appliance that fits a space, kitchen bundle, energy-cost estimate, financing options, or an explanation. The model chooses and composes an A2UI screen for that intent.
- **A2UI v1.0 generation and rendering:** The server generates A2UI Express, parses and validates it against the demo catalog, and streams the resulting A2UI messages to the React client for rendering.
- **A domain-specific component catalog:** Alongside basic layout components, the UI includes product cards and grids, comparison tables, energy-cost and financing views, fit checks, bundles, spec highlights, energy labels, tips, and follow-up suggestions.
- **Grounded product details:** Generated screens refer to product IDs; the app renders names, prices, specifications, and photos from its bundled catalog rather than asking the model to invent them.
- **Live, inspectable responses:** The assistant's short introduction streams while the screen is being generated. Use **Ver A2UI** on a response to inspect the A2UI Express and validated protocol messages.

The demo is a local appliance retailer experience, not a general-purpose shopping service. Product data and store rules are in [`data/products.json`](data/products.json) and [`shared/store.ts`](shared/store.ts).

## Run locally

Requirements: Node.js 24 or later and npm.

```sh
npm ci
cp env.example .env
```

Add credentials to `.env`, then start the app:

```sh
npm run dev
```

Open [http://localhost:8787](http://localhost:8787). The interface and API are served by the same Node process. Without model credentials, the app can start and display its catalog, but it cannot generate answers.

### Model configuration

Choose one provider and set its values in `.env`:

| Variable | Purpose |
| --- | --- |
| `FOUNDRY_ENDPOINT` | Microsoft Foundry endpoint; setting this selects the Foundry provider. |
| `FOUNDRY_MODEL_DEPLOYMENT` | Foundry deployment name; defaults to `gpt-6-luna` if unset. |
| `FOUNDRY_API_KEY` | Optional Foundry API key. If omitted, the app uses Azure Identity credentials (for example, `az login` locally). |
| `OPENAI_API_KEY` | OpenAI API key, used when `FOUNDRY_ENDPOINT` is not set. |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible base URL. |

### Optional telemetry

Set `APPLICATIONINSIGHTS_CONNECTION_STRING` to export server and browser telemetry to Azure Monitor / Application Insights. Without it, telemetry is not exported. `OTEL_SERVICE_NAME` overrides the service name (default `elena`).

## Production build

For the Azure CLI deployment and Redis setup, see [the deployment guide](docs/deploy/README.md).

`npm run build` (run it on the host before `docker build`) bundles the client into `dist/` and bundles the server (esbuild) into `dist-server/`. `npm start` runs the compiled server with plain `node` (`tsx` is only used by `npm run dev`). Build and type-check with:

```sh
npm test
npm run typecheck
npm run build
```

To serve the production build with `npm start` (run `npm run build` first), set `NODE_ENV=production`. The included [`Dockerfile`](Dockerfile) builds and runs this configuration. Production mode requires Redis-backed query quotas:

- `QUOTA_REDIS_URL` — Redis connection URL.
- `QUOTA_IDENTITY_SECRET` — secret of at least 32 bytes, used to sign browser identities.

Production requests are limited to 10 model questions per browser per hour. These quota settings are not required for local development.

### Run the production setup with Docker Compose

[`compose.yaml`](compose.yaml) runs the production image together with Redis. It reads the model and telemetry settings from `.env` (see [Model configuration](#model-configuration)) and sets `QUOTA_REDIS_URL` and a local `QUOTA_IDENTITY_SECRET` itself.

```sh
npm ci
npm run build          # the image only packages dist/, dist-server/ and data/
docker compose up --build
```

Open http://localhost:8787. Stop it with `docker compose down`. Rerun `npm run build` before `docker compose up --build` after any code change. The browser identity cookie is `Secure`, which browsers accept on `localhost` but `curl` does not send back automatically.

## Project layout

- [`web/`](web/) — React client, A2UI renderer, custom components, and styles.
- [`server/`](server/) — Express API, model integration, A2UI generation/validation, and optional telemetry.
- [`shared/`](shared/) — Product types, A2UI catalog definitions, and store rules shared by the client and server.
- [`data/products.json`](data/products.json) — Demo appliance catalog; product images are in `web/public/products/`.

## Checks

```sh
npm test
npm run typecheck
npm run build
```
