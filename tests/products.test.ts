import assert from 'node:assert/strict';
import test from 'node:test';
import type {Product} from '../shared/products.js';
import {
  energyScaleOf,
  formatList,
  formatSpec,
  specRankValue,
} from '../shared/products.js';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'WAS-001',
  category: 'lavadoras',
  type: 'lavadora',
  brand: 'Marca',
  name: 'Lavadora',
  price: 499,
  oldPrice: null,
  rating: 4.5,
  reviews: 1234,
  energyClass: 'A',
  annualKwh: 1250,
  dims: {w: 60, h: 85, d: 60},
  color: 'blanco',
  stock: 2,
  deliveryDays: 3,
  warrantyYears: 2,
  specs: {capacityKg: 8, noFrost: false},
  features: ['Eco'],
  description: 'Lavadora eficiente',
  image: '/products/WAS-001.webp',
  ...overrides,
});

test('energyScaleOf accounts for legacy-label categories and plus-rated classes', () => {
  assert.equal(energyScaleOf(product()), 'current');
  assert.equal(energyScaleOf(product({energyClass: 'A+'})), 'previous');
  assert.equal(energyScaleOf(product({category: 'hornos'})), 'previous');
});

test('specRankValue returns comparable values and skips non-comparable specs', () => {
  const item = product();

  assert.equal(specRankValue(item, 'price'), 499);
  assert.equal(specRankValue(item, 'energyClass'), 3);
  assert.equal(specRankValue(item, 'capacityKg'), 8);
  assert.equal(specRankValue(item, 'noFrost'), undefined);
  assert.equal(specRankValue(item, 'dimensions'), undefined);
});

test('formatSpec renders localized values and distinguishes absent boolean specs', () => {
  const item = product();

  assert.equal(formatSpec(item, 'annualKwh'), '1250 kWh/año');
  assert.equal(formatSpec(item, 'rating'), '4,5 ★ (1234)');
  assert.equal(formatSpec(item, 'dimensions'), '60 × 85 × 60 cm');
  assert.equal(formatSpec(item, 'noFrost'), 'No');
  assert.equal(formatSpec(product({specs: {}}), 'noFrost'), '—');
  assert.equal(formatSpec(item, 'capacityKg'), '8 kg');
});

test('formatList uses Spanish list conjunctions', () => {
  assert.equal(formatList(['lavadora', 'secadora', 'frigorífico']), 'lavadora, secadora y frigorífico');
});
