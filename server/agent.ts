/**
 * The assistant: question -> gpt-6-luna -> A2UI Express -> validated A2UI v1.0 messages.
 *
 * Configuration and conversation history are passed in; nothing is kept between requests.
 *
 * Robustness for a cheap model: deterministic fixes for two common slips, one repair round trip
 * with the validator's error text, and a fixed fallback screen. Unknown product ids are dropped.
 */
import {ExpressFormatFactory, type AgentToRendererMessage} from '@a2ui/agent';
import {DefaultAzureCredential, getBearerTokenProvider} from '@azure/identity';
import OpenAI from 'openai';
import type {Product} from '../shared/products.js';
import {HISTORY_TURNS} from '../shared/store.js';
import {createGenerator, RENDERER_CAPABILITIES} from './catalog.js';
import {endAgentSpan, endChatSpan, startAgentSpan, startChatSpan, type AgentSpan, type ChatResult, type Outcome} from './genai-telemetry.js';
import {buildSystemPrompt} from './prompt.js';

export const DEFAULT_MODEL = 'gpt-6-luna';
const TIMEOUT_MS = 60_000;
const FOUNDRY_SCOPE = 'https://ai.azure.com/.default';

/** Limit on each history answer the client sends back (the number of turns is HISTORY_TURNS). */
export const HISTORY_CHARS = 6000;

export interface AgentConfig {
  /** API key. For the Foundry provider, empty means keyless Entra ID (managed identity or `az login`). */
  apiKey: string;
  model?: string;
  effort?: OpenAI.ReasoningEffort;
  provider?: 'openai' | 'foundry';
  /** Foundry resource endpoint, e.g. https://name.openai.azure.com (the /openai/v1/ path is added). */
  foundryEndpoint?: string;
  openaiBaseUrl?: string;
}

/** Reads the model configuration from the environment (shared by the server and the CLI). */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const foundry = Boolean(env.FOUNDRY_ENDPOINT);
  return {
    apiKey: (foundry ? env.FOUNDRY_API_KEY : env.OPENAI_API_KEY) ?? '',
    provider: foundry ? 'foundry' : 'openai',
    foundryEndpoint: env.FOUNDRY_ENDPOINT,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    model: env.A2UI_DEMO_MODEL || (foundry ? env.FOUNDRY_MODEL_DEPLOYMENT : undefined) || DEFAULT_MODEL,
    effort: (env.A2UI_DEMO_EFFORT as AgentConfig['effort']) || 'low',
  };
}

/** True when requests can be authenticated: a key, or keyless Entra ID on Foundry. */
export const hasCredentials = (config: AgentConfig) => Boolean(config.apiKey) || config.provider === 'foundry';

export interface HistoryTurn {
  question: string;
  answer: string;
}

export type AgentEvent =
  | {event: 'step'; data: {text: string}}
  | {event: 'say'; data: {text: string}}
  | {event: 'a2ui'; data: {messages: AgentToRendererMessage[]; express: string; say: string}}
  | {event: 'done'; data: {ms: number; inputTokens: number; outputTokens: number; repaired: boolean; fallback: boolean; droppedIds: string[]}}
  | {event: 'error'; data: {message: string}};

const generator = createGenerator();
const clients = new Map<string, OpenAI>();
const openaiFor = (config: AgentConfig) => {
  const key = JSON.stringify([
    config.provider ?? 'openai',
    config.apiKey,
    config.foundryEndpoint ?? '',
    config.openaiBaseUrl ?? '',
  ]);
  let c = clients.get(key);
  if (!c) {
    c = config.provider === 'foundry'
      ? new OpenAI({
          apiKey: config.apiKey || getBearerTokenProvider(new DefaultAzureCredential(), FOUNDRY_SCOPE),
          baseURL: `${(config.foundryEndpoint ?? '').replace(/\/+$/, '')}/openai/v1/`,
          timeout: TIMEOUT_MS,
          maxRetries: 1,
        })
      : new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.openaiBaseUrl,
          timeout: TIMEOUT_MS,
          maxRetries: 1,
        });
    clients.set(key, c);
  }
  return c;
};

// The system prompt depends only on the catalog and the products, so it is built once.
let cachedInstructions: {products: Product[]; text: string} | undefined;
function instructionsFor(products: Product[]): string {
  if (cachedInstructions?.products !== products) {
    const snippet = generator.createProcessor(RENDERER_CAPABILITIES, new ExpressFormatFactory({surfaceId: 'prompt'})).promptSnippet;
    cachedInstructions = {products, text: buildSystemPrompt(products, snippet)};
  }
  return cachedInstructions.text;
}

/**
 * Builds the system prompt and runs one parse so the schemas are compiled before the first request.
 */
export function warmUp(products: Product[]): void {
  instructionsFor(products);
  const p = generator.createProcessor(RENDERER_CAPABILITIES, new ExpressFormatFactory({surfaceId: 'warm-up'}));
  const id = products[0]?.id ?? 'X';
  p.parseResponse(
    `Hola.\n<a2ui>\nh = Headline(title="x")\ng = ProductGrid(items=[{productId: "${id}"}])\nc = ComparisonTable(productIds=["${id}"])\nt = Tip(title="x", text="x")\nr = Row([g, t])\nroot = Column([h, r, c])\n</a2ui>`,
  );
}

/** Reads a POST /api/ask body. */
export function parseAskBody(body: unknown): {question: string; surfaceId: string; history: unknown} {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    question: String(b.question ?? '').slice(0, 500).trim(),
    surfaceId: String(b.surfaceId ?? '').replace(/[^\w-]/g, '').slice(0, 40) || `turn-${Date.now()}`,
    history: b.history,
  };
}

/** Keeps the last turns the client sent, within size limits. */
export function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-HISTORY_TURNS)
    .filter((h): h is HistoryTurn => typeof h?.question === 'string' && typeof h?.answer === 'string')
    .map((h) => ({question: h.question.slice(0, 500), answer: h.answer.slice(0, HISTORY_CHARS)}));
}

/** Fixes two slips the model makes: a `surface(...)` command and `root = someVariable`. */
export function normalizeExpress(text: string): string {
  let out = text.replace(/^[ \t]*surface\([^)]*\)[ \t]*$/gm, '');
  const alias = out.match(/^[ \t]*root[ \t]*=[ \t]*([A-Za-z_]\w*)[ \t]*$/m);
  if (alias && alias[1] !== 'root') {
    const name = alias[1];
    const assign = new RegExp(`^([ \\t]*)${name}([ \\t]*=)`, 'm');
    if (assign.test(out)) {
      out = out.replace(alias[0], '');
      out = out.replace(assign, '$1root$2');
    }
  }
  return out;
}

/**
 * Text the model wrote before its A2UI block (Elena's one-liner). While streaming, the tail may
 * hold the first characters of the tag ("<a2", "<a2ui"), which must not reach the bubble.
 */
export function sayOf(text: string): string {
  const i = text.indexOf('<a2ui>');
  let say = i >= 0 ? text.slice(0, i) : text;
  const lt = say.lastIndexOf('<');
  if (lt >= 0 && '<a2ui>'.startsWith(say.slice(lt))) say = say.slice(0, lt);
  return say.replace(/```[a-z]*\s*$/i, '').trim();
}

function expressOf(text: string): string {
  const m = text.match(/<a2ui>([\s\S]*?)(<\/a2ui>|$)/);
  return m ? m[1].trim() : '';
}

/**
 * Removes ids that are not in the catalog, and repeated ids (except in a Bundle, where two of the
 * same product can be intended); returns the unknown ids it dropped.
 */
export function sanitizeProductIds(messages: AgentToRendererMessage[], valid: ReadonlySet<string>): string[] {
  const dropped: string[] = [];
  const keep = (id: unknown) => {
    const ok = typeof id === 'string' && valid.has(id);
    if (!ok) dropped.push(String(id));
    return ok;
  };
  const firstOf = (id: unknown, i: number, all: unknown[]) => all.indexOf(id) === i;
  for (const msg of messages as Array<Record<string, any>>) {
    const comps = msg.createSurface?.components ?? msg.updateComponents?.components ?? [];
    for (const c of comps as Array<Record<string, any>>) {
      if (Array.isArray(c.productIds)) {
        c.productIds = c.productIds.filter(keep);
        if (c.component !== 'Bundle') c.productIds = c.productIds.filter(firstOf);
      }
      if (Array.isArray(c.items)) {
        c.items = c.items.filter((it: Record<string, unknown>) => keep(it?.productId));
        c.items = c.items.filter((it: Record<string, unknown>, i: number, all: Array<Record<string, unknown>>) => all.findIndex((o) => o.productId === it.productId) === i);
      }
      if (typeof c.productId === 'string' && !valid.has(c.productId)) dropped.push(c.productId);
      if (typeof c.winnerId === 'string' && !valid.has(c.winnerId)) delete c.winnerId;
    }
  }
  return dropped;
}

export function fallbackMessages(surfaceId: string, catalogId: string): AgentToRendererMessage[] {
  return [
    {
      version: '1.0',
      createSurface: {
        surfaceId,
        catalogId,
        components: [
          {id: 'root', component: 'Column', children: ['h', 't', 's']},
          {id: 'h', component: 'Headline', eyebrow: 'ElectroHogar', title: 'Vamos a intentarlo de otra forma'},
          {
            id: 't',
            component: 'Tip',
            tone: 'warning',
            title: 'No he podido preparar esta pantalla',
            text: 'Prueba a reformular la pregunta o elige una de las sugerencias.',
          },
          {
            id: 's',
            component: 'Suggestions',
            suggestions: ['Enséñame las lavadoras más vendidas', 'Compara frigoríficos combi', '¿Qué robot aspirador me recomiendas?'],
          },
        ],
      },
    } as unknown as AgentToRendererMessage,
  ];
}

export async function* answer(
  question: string,
  history: unknown,
  surfaceId: string,
  products: Product[],
  config: AgentConfig,
  /** Aborts the OpenAI requests, e.g. when the browser disconnects. */
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const turns = sanitizeHistory(history);
  const agent = startAgentSpan(
    {
      model: config.model ?? DEFAULT_MODEL,
      provider: config.provider ?? 'openai',
      endpoint: config.provider === 'foundry' ? config.foundryEndpoint : config.openaiBaseUrl,
    },
    question,
    surfaceId,
    turns.length,
  );
  let outcome: Outcome = 'cancelled';
  let summary: Extract<AgentEvent, {event: 'done'}>['data'] | undefined;
  let error: unknown;
  try {
      for await (const ev of run(question, turns, surfaceId, products, config, agent, signal)) {
        if (ev.event === 'done') {
          summary = ev.data;
          outcome = ev.data.fallback ? 'fallback' : ev.data.repaired ? 'repaired' : 'ok';
        }
        yield ev;
      }
  } catch (e) {
    error = e;
    outcome = signal?.aborted ? 'cancelled' : 'error';
    throw e;
  } finally {
    endAgentSpan(agent, outcome, summary && {...summary, droppedIds: summary.droppedIds.length}, error);
  }
}

async function* run(
  question: string,
  turns: HistoryTurn[],
  surfaceId: string,
  products: Product[],
  config: AgentConfig,
  agent: AgentSpan,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const MODEL = config.model ?? DEFAULT_MODEL;
  const EFFORT = config.effort ?? 'low';
  const openai = () => openaiFor(config);
  const processor = generator.createProcessor(RENDERER_CAPABILITIES, new ExpressFormatFactory({surfaceId}));
  const catalogId = processor.catalogs[0].id;
  const instructions = instructionsFor(products);
  const input: OpenAI.Responses.ResponseInput = [
    ...turns.flatMap((h) => [
      {role: 'user' as const, content: h.question},
      {role: 'assistant' as const, content: h.answer},
    ]),
    {role: 'user', content: question},
  ];
  let inputTokens = 0;
  let outputTokens = 0;

  yield {event: 'step', data: {text: `Buscando en el catálogo de ${products.length} productos…`}};

  // 1. Streamed generation: Elena's sentence is forwarded while the A2UI block is written.
  let text = '';
  let lastSay = '';
  let announcedDesign = false;
  const chat = startChatSpan(agent, 'answer', true);
  const result: ChatResult = {};
  let chatError: unknown;
  try {
  const stream = await openai().responses.create({model: MODEL, instructions, input, reasoning: {effort: EFFORT}, stream: true}, {signal});
  for await (const ev of stream) {
    if (ev.type === 'response.output_text.delta') {
      result.firstTokenMs ??= performance.now() - chat.start;
      text += ev.delta;
      const say = sayOf(text);
      if (say && say !== lastSay && !text.includes('<a2ui>')) {
        lastSay = say;
        yield {event: 'say', data: {text: say}};
      }
      if (!announcedDesign && text.includes('<a2ui>')) {
        announcedDesign = true;
        yield {event: 'step', data: {text: 'Diseñando tu pantalla…'}};
      }
    } else if (ev.type === 'response.completed') {
      result.responseId = ev.response.id;
      result.inputTokens = ev.response.usage?.input_tokens ?? 0;
      result.outputTokens = ev.response.usage?.output_tokens ?? 0;
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
    }
  }
  // The SDK ends an aborted stream silently: stop here rather than validate (and repair) a partial answer.
  signal?.throwIfAborted();
  } catch (e) {
    chatError = e;
    throw e;
  } finally {
    endChatSpan(chat, result, chatError);
  }
  // Always settle the bubble on the final value, even when it is empty (no sentence written).
  const finalSay = sayOf(text);
  if (finalSay !== lastSay) yield {event: 'say', data: {text: finalSay}};

  // 2. Validate; one repair round trip with the validator's message; then the fallback screen.
  const valid = new Set(products.map((p) => p.id));
  let repaired = false;
  let fallback = false;
  let messages: AgentToRendererMessage[] | undefined;
  let candidate = normalizeExpress(text);
  for (let attempt = 0; attempt < 2 && !messages; attempt++) {
    try {
      messages = processor
        .parseResponse(candidate)
        .flatMap((part) => (part.type === 'a2ui' ? (part.a2ui as AgentToRendererMessage[]) : []));
      if (!messages.length) throw new Error('La respuesta no contiene un bloque <a2ui>.');
    } catch (e) {
      messages = undefined;
      const reason = e instanceof Error ? e.message : String(e);
      console.warn(`[agent] invalid A2UI (attempt ${attempt + 1}): ${reason}`);
      if (attempt === 1) break;
      yield {event: 'step', data: {text: 'Ajustando el diseño…'}};
      repaired = true;
      let fix: OpenAI.Responses.Response;
      const repairChat = startChatSpan(agent, 'repair', false);
      try {
        fix = await openai().responses.create({
          model: MODEL,
          instructions,
          reasoning: {effort: EFFORT},
          input: [
            ...input,
            {role: 'assistant', content: text},
            {
              role: 'user',
              content: `El bloque A2UI anterior no es válido: ${reason}\nVuelve a escribir la respuesta completa corregida (frase corta + bloque <a2ui>). Recuerda: asigna el componente raíz directamente a root, sin surface().`,
            },
          ],
        }, {signal});
      } catch (err) {
        endChatSpan(repairChat, {}, err);
        if (signal?.aborted) throw err;
        // A failed repair request (timeout, network) ends in the fallback screen, not in an error.
        console.warn(`[agent] repair request failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
      endChatSpan(repairChat, {responseId: fix.id, inputTokens: fix.usage?.input_tokens ?? 0, outputTokens: fix.usage?.output_tokens ?? 0});
      inputTokens += fix.usage?.input_tokens ?? 0;
      outputTokens += fix.usage?.output_tokens ?? 0;
      text = fix.output_text;
      candidate = normalizeExpress(text);
    }
  }
  if (!messages) {
    fallback = true;
    messages = fallbackMessages(surfaceId, catalogId);
  }
  const droppedIds = sanitizeProductIds(messages, valid);
  if (droppedIds.length) console.warn(`[agent] dropped unknown product ids: ${droppedIds.join(', ')}`);

  // The bubble shows the sentence of the screen actually shown: the repaired one, or none with the
  // fallback screen (which explains itself).
  const screenSay = fallback ? '' : sayOf(candidate);
  if (screenSay !== finalSay) yield {event: 'say', data: {text: screenSay}};

  // `say` + `express` let the client send this turn back as history on the next question.
  yield {event: 'a2ui', data: {messages, express: fallback ? '' : expressOf(candidate), say: screenSay}};
  yield {event: 'done', data: {ms: Date.now() - t0, inputTokens, outputTokens, repaired, fallback, droppedIds}};
}
