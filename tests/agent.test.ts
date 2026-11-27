import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configFromEnv,
  fallbackMessages,
  hasCredentials,
  normalizeExpress,
  parseAskBody,
  sanitizeHistory,
  sanitizeProductIds,
  sayOf,
} from '../server/agent.js';

test('parseAskBody trims and limits input and removes unsafe surface id characters', () => {
  const parsed = parseAskBody({
    question: `  ${'a'.repeat(510)}  `,
    surfaceId: 'turn/one ?',
    history: [{question: 'previous', answer: 'response'}],
  });

  assert.equal(parsed.question, 'a'.repeat(498));
  assert.equal(parsed.surfaceId, 'turnone');
  assert.deepEqual(parsed.history, [{question: 'previous', answer: 'response'}]);
});

test('parseAskBody uses a generated surface id when none is usable', () => {
  const parsed = parseAskBody({question: null, surfaceId: ' /? '});

  assert.equal(parsed.question, '');
  assert.match(parsed.surfaceId, /^turn-\d+$/);
  assert.equal(parsed.history, undefined);
});

test('sanitizeHistory keeps only valid recent turns and enforces field limits', () => {
  const history = sanitizeHistory([
    {question: 'old', answer: 'old'},
    null,
    {question: 'a'.repeat(510), answer: 'b'.repeat(6100)},
    {question: 'recent', answer: 'answer'},
  ]);

  assert.deepEqual(history, [
    {question: 'a'.repeat(500), answer: 'b'.repeat(6000)},
    {question: 'recent', answer: 'answer'},
  ]);
});

test('sanitizeHistory keeps only the last three well-formed turns', () => {
  assert.deepEqual(sanitizeHistory([
    {question: 'one', answer: 'one'},
    {question: 'two', answer: 'two'},
    {question: 3, answer: 'invalid'},
    {question: 'three', answer: 'three'},
    {question: 'four', answer: 'four'},
    {question: 'five', answer: 'five'},
  ]), [
    {question: 'three', answer: 'three'},
    {question: 'four', answer: 'four'},
    {question: 'five', answer: 'five'},
  ]);
});

test('configFromEnv selects Foundry settings and credentials correctly', () => {
  const config = configFromEnv({
    FOUNDRY_ENDPOINT: 'https://foundry.example/',
    FOUNDRY_MODEL_DEPLOYMENT: 'deployment',
    A2UI_DEMO_EFFORT: 'high',
  });

  assert.equal(config.provider, 'foundry');
  assert.equal(config.foundryEndpoint, 'https://foundry.example/');
  assert.equal(config.model, 'deployment');
  assert.equal(config.effort, 'high');
  assert.equal(hasCredentials(config), true);
  assert.equal(hasCredentials({...config, provider: 'openai'}), false);
  assert.equal(hasCredentials({...config, provider: 'openai', apiKey: 'key'}), true);
});

test('normalizeExpress removes surface declarations and promotes the root alias', () => {
  const input = [
    'surface(id="screen")',
    'card = ProductCard(productId="WAS-001")',
    'root = card',
  ].join('\n');

  assert.equal(normalizeExpress(input).trim(), 'root = ProductCard(productId="WAS-001")');
});

test('sayOf excludes complete and partial A2UI tags from streamed text', () => {
  assert.equal(sayOf('Hola.\n<a2ui>\nroot = Column([])\n</a2ui>'), 'Hola.');
  assert.equal(sayOf('Hola <a2'), 'Hola');
  assert.equal(sayOf('Hola.\n```'), 'Hola.');
});

test('sanitizeProductIds removes unknown and duplicate ids, preserving bundle duplicates', () => {
  const components = [
    {
      id: 'grid',
      component: 'ProductGrid',
      items: [{productId: 'A'}, {productId: 'missing'}, {productId: 'A'}],
    },
    {
      id: 'comparison',
      component: 'ComparisonTable',
      productIds: ['A', 'A', 'missing', 'B'],
      winnerId: 'missing',
    },
    {id: 'bundle', component: 'Bundle', productIds: ['A', 'A', 'missing']},
    {id: 'card', component: 'ProductCard', productId: 'missing'},
  ];
  const messages = [{createSurface: {components}}] as Parameters<typeof sanitizeProductIds>[0];

  assert.deepEqual(sanitizeProductIds(messages, new Set(['A', 'B'])), [
    'missing',
    'missing',
    'missing',
    'missing',
  ]);
  assert.deepEqual(components[0].items, [{productId: 'A'}]);
  assert.deepEqual(components[1].productIds, ['A', 'B']);
  assert.equal('winnerId' in components[1], false);
  assert.deepEqual(components[2].productIds, ['A', 'A']);
});

test('fallbackMessages builds a complete screen for the requested surface and catalog', () => {
  const [message] = fallbackMessages('turn-42', 'catalog-id');

  assert.ok(message && 'createSurface' in message);
  const surface = message.createSurface;
  assert.ok(surface);
  assert.equal(message.version, '1.0');
  assert.equal(surface.surfaceId, 'turn-42');
  assert.equal(surface.catalogId, 'catalog-id');
  assert.deepEqual(
    surface.components?.find((component) => component.id === 'root')?.children,
    ['h', 't', 's'],
  );
  assert.ok(surface.components?.some((component) => component.component === 'Suggestions'));
});
