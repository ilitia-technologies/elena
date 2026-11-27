import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {loadProducts, validateProducts} from '../server/db.js';

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'WAS-001',
  category: 'lavadoras',
  type: 'lavadora',
  brand: 'Marca',
  name: 'Lavadora',
  price: 499,
  oldPrice: null,
  rating: 4.5,
  reviews: 10,
  energyClass: 'A',
  annualKwh: 100,
  dims: {w: 60, h: 85, d: 60},
  color: 'blanco',
  stock: 2,
  deliveryDays: 3,
  warrantyYears: 2,
  specs: {capacityKg: 8},
  features: ['Eco'],
  description: 'Lavadora eficiente',
  ...overrides,
});

test('validateProducts trims fields and rejects duplicate ids after normalization', () => {
  const parsed = validateProducts([product({id: ' WAS-001 ', name: ' Lavadora '})]);
  assert.equal(parsed[0].id, 'WAS-001');
  assert.equal(parsed[0].name, 'Lavadora');

  assert.throws(
    () => validateProducts([product(), product({id: ' WAS-001 '})]),
    /Duplicate product id: WAS-001/,
  );
});

test('validateProducts rejects malformed products', () => {
  assert.throws(() => validateProducts([product({price: Number.NaN})]));
  assert.throws(() => validateProducts([{...product(), dims: {w: 60, h: 85}}]));
});

test('loadProducts removes image prompts and sorts by category then price', () => {
  const dir = mkdtempSync(join(tmpdir(), 'elena-products-'));
  const file = join(dir, 'products.json');
  try {
    writeFileSync(file, JSON.stringify([
      product({id: 'B', category: 'secadoras', price: 200, imagePrompt: 'private prompt'}),
      product({id: 'C', price: 600, imagePrompt: 'private prompt'}),
      product({id: 'A', price: 400, imagePrompt: 'private prompt'}),
    ]));

    const products = loadProducts(file);

    assert.deepEqual(products.map(({id}) => id), ['A', 'C', 'B']);
    assert.equal(products[0].image, '/products/A.webp');
    assert.equal('imagePrompt' in products[0], false);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
