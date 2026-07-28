import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCatalogProduct } from './product-name.ts';

test('resolveCatalogProduct creates a missing typed product for future searches', async () => {
  const createdNames: string[] = [];

  const result = await resolveCatalogProduct({
    productId: '',
    productName: '  Organik   Kırmızı Elma  ',
    products: [{ id: 'existing', name: 'Domates' }],
    defaultUnit: 'kg',
    createProduct: async (name, category, defaultUnit) => {
      createdNames.push(`${name}|${category}|${defaultUnit}`);
      return { id: 'new-product-id', name };
    },
  });

  assert.deepEqual(result, {
    id: 'new-product-id',
    name: 'Organik Kırmızı Elma',
    created: true,
  });
  assert.deepEqual(createdNames, ['Organik Kırmızı Elma|Diğer|kg']);
});

test('resolveCatalogProduct reuses a case-insensitive exact catalog match', async () => {
  let createCalled = false;

  const result = await resolveCatalogProduct({
    productId: '',
    productName: '  kırmızı   elma ',
    products: [{ id: 'apple-id', name: 'Kırmızı Elma' }],
    defaultUnit: 'kg',
    createProduct: async () => {
      createCalled = true;
      return { id: 'unexpected' };
    },
  });

  assert.deepEqual(result, { id: 'apple-id', name: 'Kırmızı Elma', created: false });
  assert.equal(createCalled, false);
});

test('resolveCatalogProduct rejects an empty product name', async () => {
  await assert.rejects(
    resolveCatalogProduct({
      productId: '',
      productName: '   ',
      products: [],
      defaultUnit: 'adet',
      createProduct: async () => ({ id: 'unexpected' }),
    }),
    /ürün adı girin/i
  );
});
