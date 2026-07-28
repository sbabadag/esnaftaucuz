import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildShoppingComparison,
  extractPriceCoordinates,
} from './shopping-list.ts';

test('extractPriceCoordinates reads PostgreSQL point coordinates', () => {
  assert.deepEqual(
    extractPriceCoordinates({ coordinates: '(32.50,37.90)' }),
    { lat: 37.9, lng: 32.5 },
  );
});

test('buildShoppingComparison selects the cheapest compatible price inside the radius', () => {
  const items = [
    {
      product: { id: 'tomato', name: 'Domates', default_unit: 'kg' },
      quantity: 2,
    },
  ];
  const prices = [
    { id: 'far', product_id: 'tomato', price: 20, unit: 'kg', lat: 38.2, lng: 32.5 },
    { id: 'wrong-unit', product_id: 'tomato', price: 25, unit: 'adet', lat: 37.9, lng: 32.5 },
    { id: 'near-expensive', product_id: 'tomato', price: 40, unit: 'kg', lat: 37.91, lng: 32.5 },
    { id: 'near-cheap', product_id: 'tomato', price: 30, unit: 'kg', lat: 37.905, lng: 32.5 },
  ];

  const comparison = buildShoppingComparison(items, prices, { lat: 37.9, lng: 32.5 }, 5);

  assert.equal(comparison.results[0].cheapest?.id, 'near-cheap');
  assert.equal(comparison.results[0].lineTotal, 60);
  assert.equal(comparison.total, 60);
  assert.equal(comparison.missingCount, 0);
});

test('buildShoppingComparison reports products without a price in range', () => {
  const comparison = buildShoppingComparison(
    [{ product: { id: 'milk', name: 'Süt', default_unit: 'lt' }, quantity: 1 }],
    [{ id: 'far', product_id: 'milk', price: 30, unit: 'lt', lat: 39, lng: 32.5 }],
    { lat: 37.9, lng: 32.5 },
    3,
  );

  assert.equal(comparison.results[0].cheapest, null);
  assert.equal(comparison.results[0].lineTotal, null);
  assert.equal(comparison.total, 0);
  assert.equal(comparison.missingCount, 1);
});
