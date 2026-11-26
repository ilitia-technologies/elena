# Copilot instructions

Elena is a Spanish-language appliance-store assistant ("ElectroHogar") demoing generative UI with A2UI v1.0: the LLM answers each question by writing a UI screen, not chat text. Node ≥ 24, TypeScript (ESM), React 19, Express 5, Vite.

## Commands

- `npm ci` — install. Copy `env.example` to `.env` for model credentials (never commit it).
- `npm run dev` — Express + Vite middleware on http://localhost:8787 (loads `.env`, one process serves API and client).
- `npm run typecheck` — `tsc --noEmit`; the only static check (CI runs it, then `npm run build`).
- `npm run build` — `vite build` into `dist/`.
- `npm start` with `NODE_ENV=production` — serves `dist/`; requires `QUOTA_REDIS_URL` and `QUOTA_IDENTITY_SECRET` (≥ 32 bytes).
- There is no test runner or linter.

## Architecture

Request flow (`POST /api/ask`, streamed as SSE: `step`, say text, A2UI messages, `done`, `error`):

1. `server/index.ts` — Express app; in production enforces a per-browser Redis quota (`server/quota.ts`, signed cookie identity) before calling the agent; aborts work if the client disconnects.
2. `server/agent.ts` `answer()` → `run()` — builds the system prompt (`server/prompt.ts`: persona rules in Spanish, store rules, compact product table, A2UI catalog instructions), calls the OpenAI Responses API (OpenAI or Microsoft Foundry, chosen by `FOUNDRY_ENDPOINT`; Foundry without key uses Entra ID via `DefaultAzureCredential`), and streams. The model emits one short sentence followed by an `<a2ui>` block in **A2UI Express** format.
3. The Express text is parsed/validated against the agent catalog (`server/catalog.ts`, built with `@a2ui/agent`) into A2UI v1.0 messages. Robustness pipeline for a cheap model: deterministic fixes (`normalizeExpress`), one repair round trip with the validator's error text, then a fixed fallback screen (`fallbackMessages`). Unknown product ids are dropped (`sanitizeProductIds`).
4. The React client (`web/src/App.tsx`, renderer in `web/src/a2ui/`) renders messages with `@a2ui/react` using `clientCatalog` (`web/src/a2ui/catalog.ts` = all basic components + custom React components from `components.tsx`).

Catalog is defined in two halves that must stay in sync:
- `shared/catalog-apis.ts` — zod schemas/descriptions for custom components (ProductCard, ProductGrid, ComparisonTable, …), `BASIC_COMPONENTS_KEPT`, `CATALOG_INSTRUCTIONS`, `CATALOG_ID`. Used by the server (prompt + validation) and client.
- `web/src/a2ui/components.tsx` — the React implementations. Adding/renaming a component or prop means updating both, plus prompt guidance if needed.
- `shared/a2ui-basic-catalog.v1_0.json` is a copy of the v1.0 basic catalog so the server runs in Node without a DOM (the SDK's `basicCatalog` implementations are Lit elements). The agent uses only our own instructions because the basic catalog's Direct-JSON examples conflict with Express.

Data: `data/products.json` is loaded and zod-validated by `server/db.ts` (which strips `imagePrompt`). Images live in `web/public/products/<ID>.webp`. Store constants (kWh price, financing, bundle discount, history limits) are in `shared/store.ts`; the prompt text is generated from these same values so components and prompt agree.

## Conventions

- The model only references **product ids**; names, prices, specs, and photos are always rendered by components from the catalog. Never have prompts/components rely on model-written product facts.
- User-facing text, prompts, and model instructions are in Spanish (Spain), prices in euros.
- Stateless server: conversation history is sent by the client on each request and sanitized (`sanitizeHistory`, limited by `HISTORY_TURNS` / `HISTORY_CHARS`).
- Server/shared code imports local modules with `.js` extensions (`'./agent.js'`); web code imports without extensions.
- Telemetry (`server/telemetry.ts`, `server/genai-telemetry.ts`, `web/src/telemetry.ts`) is optional and only active with `APPLICATIONINSIGHTS_CONNECTION_STRING`; `server/telemetry.ts` is preloaded via `--import` in the `dev`/`start` scripts.
- Model config env vars: `FOUNDRY_ENDPOINT`/`FOUNDRY_MODEL_DEPLOYMENT`/`FOUNDRY_API_KEY`, or `OPENAI_API_KEY`/`OPENAI_BASE_URL`; override with `A2UI_DEMO_MODEL`, `A2UI_DEMO_EFFORT` (default model `gpt-6-luna`, effort `low`).
