/**
 * OpenTelemetry instrumentation of the assistant, following the GenAI semantic conventions:
 * an `invoke_agent` span per question with one `chat` child span per model call, the
 * `gen_ai.client.token.usage` and `gen_ai.client.operation.duration` histograms, and an answer
 * counter by outcome. In Application Insights the spans land in `dependencies` and the metrics in
 * `customMetrics`; the question text is recorded as `a2ui.question`.
 */
import {context, metrics, SpanKind, SpanStatusCode, trace, type Attributes, type Span} from '@opentelemetry/api';

const SCOPE = 'elena';
export const AGENT_NAME = 'Elena';
const tracer = trace.getTracer(SCOPE);
const meter = metrics.getMeter(SCOPE);

const tokenUsage = meter.createHistogram('gen_ai.client.token.usage', {
  description: 'Number of input and output tokens used',
  unit: '{token}',
  advice: {explicitBucketBoundaries: [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576]},
});
const operationDuration = meter.createHistogram('gen_ai.client.operation.duration', {
  description: 'GenAI operation duration',
  unit: 's',
  advice: {explicitBucketBoundaries: [0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24, 20.48, 40.96, 81.92]},
});
const answers = meter.createCounter('a2ui.answers', {description: 'Answers by outcome (ok, repaired, fallback, error, cancelled)'});

export type Outcome = 'ok' | 'repaired' | 'fallback' | 'error' | 'cancelled';

export interface ModelTarget {
  model: string;
  provider: 'openai' | 'foundry';
  /** Endpoint or base URL, reported as `server.address`. */
  endpoint?: string;
}

const providerName = (t: ModelTarget) => (t.provider === 'foundry' ? 'azure.ai.openai' : 'openai');
function serverAddress(endpoint: string | undefined): string {
  try {
    return new URL(endpoint || 'https://api.openai.com').hostname;
  } catch {
    return '';
  }
}
const baseAttributes = (t: ModelTarget, operation: string): Attributes => ({
  'gen_ai.operation.name': operation,
  'gen_ai.provider.name': providerName(t),
  'gen_ai.request.model': t.model,
});
export interface AgentSpan {
  span: Span;
  target: ModelTarget;
  start: number;
}

export function startAgentSpan(target: ModelTarget, question: string, surfaceId: string, historyTurns: number): AgentSpan {
  const span = tracer.startSpan(`invoke_agent ${AGENT_NAME}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      ...baseAttributes(target, 'invoke_agent'),
      'gen_ai.agent.name': AGENT_NAME,
      'a2ui.surface_id': surfaceId,
      'a2ui.history_turns': historyTurns,
      'a2ui.question': question,
    },
  });
  return {span, target, start: performance.now()};
}

export interface AnswerSummary {
  inputTokens: number;
  outputTokens: number;
  repaired: boolean;
  fallback: boolean;
  droppedIds: number;
}

export function endAgentSpan(agent: AgentSpan, outcome: Outcome, summary?: AnswerSummary, error?: unknown): void {
  const {span} = agent;
  span.setAttribute('a2ui.outcome', outcome);
  if (summary) {
    span.setAttributes({
      'gen_ai.usage.input_tokens': summary.inputTokens,
      'gen_ai.usage.output_tokens': summary.outputTokens,
      'a2ui.repaired': summary.repaired,
      'a2ui.fallback': summary.fallback,
      'a2ui.dropped_ids': summary.droppedIds,
    });
  }
  if (outcome === 'error') {
    if (error instanceof Error) span.recordException(error);
    span.setAttribute('error.type', errorType(error));
    span.setStatus({code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error)});
  }
  span.end();
  answers.add(1, {'a2ui.outcome': outcome, 'gen_ai.request.model': agent.target.model});
}

export interface ChatSpan {
  span: Span;
  attributes: Attributes;
  start: number;
}

/** A model call; `purpose` is `answer` for the streamed answer and `repair` for the repair round trip. */
export function startChatSpan(agent: AgentSpan, purpose: 'answer' | 'repair', streaming: boolean): ChatSpan {
  const attributes = {...baseAttributes(agent.target, 'chat'), 'server.address': serverAddress(agent.target.endpoint)};
  const span = tracer.startSpan(
    `chat ${agent.target.model}`,
    {kind: SpanKind.CLIENT, attributes: {...attributes, 'a2ui.purpose': purpose, 'a2ui.streaming': streaming}},
    trace.setSpan(context.active(), agent.span),
  );
  return {span, attributes, start: performance.now()};
}

export interface ChatResult {
  responseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Milliseconds until the first streamed text delta. */
  firstTokenMs?: number;
}

export function endChatSpan(chat: ChatSpan, result: ChatResult, error?: unknown): void {
  const {span, attributes} = chat;
  if (result.responseId) span.setAttribute('gen_ai.response.id', result.responseId);
  if (result.firstTokenMs !== undefined) span.setAttribute('a2ui.time_to_first_token_ms', Math.round(result.firstTokenMs));
  const metricAttributes: Attributes = {...attributes};
  if (error !== undefined) {
    const type = errorType(error);
    if (error instanceof Error) span.recordException(error);
    span.setAttribute('error.type', type);
    span.setStatus({code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error)});
    metricAttributes['error.type'] = type;
  }
  if (result.inputTokens !== undefined) {
    span.setAttribute('gen_ai.usage.input_tokens', result.inputTokens);
    tokenUsage.record(result.inputTokens, {...attributes, 'gen_ai.token.type': 'input'});
  }
  if (result.outputTokens !== undefined) {
    span.setAttribute('gen_ai.usage.output_tokens', result.outputTokens);
    tokenUsage.record(result.outputTokens, {...attributes, 'gen_ai.token.type': 'output'});
  }
  operationDuration.record((performance.now() - chat.start) / 1000, metricAttributes);
  span.end();
}

function errorType(error: unknown): string {
  if (error instanceof Error) return (error as {status?: number}).status ? String((error as {status?: number}).status) : error.name;
  return '_OTHER';
}
