/**
 * App server: API and web client served by one Node process (Vite middleware in dev, `dist/` in production).
 * The API key stays on the server.
 */
import express from 'express';
import {trace} from '@opentelemetry/api';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {projectRoot} from './paths.js';
import {answer, configFromEnv, hasCredentials, parseAskBody, warmUp} from './agent.js';
import {loadProducts} from './db.js';
import {BROWSER_COOKIE, browserIdentity, createQuota} from './quota.js';

const PORT = Number(process.env.PORT ?? 8787);
const DIST_DIR = resolve(projectRoot(), 'dist');
const production = process.env.NODE_ENV === 'production';
const host = production ? '0.0.0.0' : '127.0.0.1';
const quotaUrl = process.env.QUOTA_REDIS_URL;
const quotaSecret = process.env.QUOTA_IDENTITY_SECRET;
if (production && (!quotaUrl || !quotaSecret || Buffer.byteLength(quotaSecret) < 32)) {
  throw new Error('Production requires QUOTA_REDIS_URL and a QUOTA_IDENTITY_SECRET of at least 32 bytes');
}
const quota = production ? createQuota(quotaUrl!, quotaSecret!) : null;
const products = loadProducts();
const config = configFromEnv();
warmUp(products);

const app = express();
app.use(express.json({limit: '64kb'}));
// Names the HTTP instrumentation's request span (Application Insights `requests`) after the route.
app.use((req, _res, next) => {
  const route = req.path.startsWith('/api/') ? req.path : '/*';
  trace.getActiveSpan()?.setAttribute('http.route', route).updateName(`${req.method} ${route}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: config.provider,
    model: config.model,
    products: products.length,
    apiKey: hasCredentials(config),
  });
});

app.get('/api/products', (_req, res) => {
  res.json(products);
});

// The browser SDK's connection string is not a secret: it only allows sending telemetry.
app.get('/api/telemetry', (_req, res) => {
  res.json({connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ?? ''});
});

app.post('/api/ask', async (req, res) => {
  const {question, surfaceId, history} = parseAskBody(req.body);
  if (!question) {
    res.status(400).json({error: 'question is required'});
    return;
  }
  // Stop work if the browser disconnects, including while the quota check is pending.
  const aborter = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) aborter.abort();
  });
  if (quota) {
    const identity = browserIdentity(req.headers.cookie, quotaSecret!);
    res.set('Cache-Control', 'no-store');
    if (!identity.established) {
      res.cookie(BROWSER_COOKIE, identity.token, {
        secure: true, httpOnly: true, sameSite: 'strict', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.status(428).json({error: 'Browser identity required. Enable cookies and retry.'});
      return;
    }
    try {
      const result = await quota.consume(identity.id);
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfter));
        res.status(429).json({error: 'Model query limit reached: 10 questions per hour.', retryAfter: result.retryAfter});
        return;
      }
    } catch {
      res.status(503).json({error: 'Model query quota is temporarily unavailable.'});
      return;
    }
  }
  if (aborter.signal.aborted) return;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  console.log(`[ask] ${surfaceId}: ${question}`);
  try {
    for await (const ev of answer(question, history, surfaceId, products, config, aborter.signal)) {
      send(ev.event, ev.data);
      if (ev.event === 'done') console.log(`[ask] ${surfaceId} done in ${ev.data.ms} ms (repaired=${ev.data.repaired}, fallback=${ev.data.fallback})`);
    }
  } catch (e) {
    if (aborter.signal.aborted) console.log(`[ask] ${surfaceId} cancelled: the browser disconnected`);
    else {
      console.error('[ask] failed', e);
      send('error', {message: (e as Error).message});
    }
  }
  res.end();
});

const httpServer = createServer(app);

if (production) {
  app.use('/api', (_req, res) => res.status(404).json({error: 'not found'}));
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (_req, res) => res.sendFile(resolve(DIST_DIR, 'index.html')));
} else {
  const {createServer: createViteServer} = await import('vite');
  const vite = await createViteServer({
    server: {middlewareMode: true, hmr: {server: httpServer}},
  });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, host, () => {
  console.log(`ElectroHogar API on http://${host}:${PORT} · model ${config.model} · ${products.length} products`);
  if (production) console.log('Serving the built web app from dist/');
  if (!hasCredentials(config)) console.warn('No credentials configured: set FOUNDRY_ENDPOINT (with Entra ID or FOUNDRY_API_KEY) before asking questions.');
});
