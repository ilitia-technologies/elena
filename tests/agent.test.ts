import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
