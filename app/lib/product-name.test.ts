import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeProductName, resolveCatalogProduct } from './product-name.ts';

test('normalizeProductName trims and collapses spaces', () => {
  assert.equal(normalizeProductName('  Domates  Salçası  '), 'Domates Salçası');
});

test('resolveCatalogProduct reuses an existing case-insensitive match', async () => {
  const resolved = await resolveCatalogProduct({
    productId: '',
    productName: 'domates',
    products: [{ id: 'p1', name: 'Domates' }],
    defaultUnit: 'kg',
    createProduct: async () => {
      throw new Error('should not create');
    },
  });
  assert.equal(resolved.id, 'p1');
  assert.equal(resolved.created, false);
});

test('resolveCatalogProduct creates when name is missing from catalog', async () => {
  const resolved = await resolveCatalogProduct({
    productId: '',
    productName: 'Yeni Ürün X',
    products: [{ id: 'p1', name: 'Domates' }],
    defaultUnit: 'adet',
    createProduct: async (name, category, unit) => {
      assert.equal(name, 'Yeni Ürün X');
      assert.equal(category, 'Diğer');
      assert.equal(unit, 'adet');
      return { id: 'new-1', name };
    },
  });
  assert.equal(resolved.id, 'new-1');
  assert.equal(resolved.created, true);
});
