import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractCollectApiProductNames,
  extractPexelsImageUrl,
} from '../lib/external-api-response.js';

test('extractPexelsImageUrl returns the first valid medium image URL', () => {
  assert.equal(
    extractPexelsImageUrl({ photos: [{ src: { medium: 'https://images.pexels.com/photos/1.jpeg' } }] }),
    'https://images.pexels.com/photos/1.jpeg',
  );
});

test('extractPexelsImageUrl rejects malformed API payloads', () => {
  assert.equal(extractPexelsImageUrl(null), null);
  assert.equal(extractPexelsImageUrl({ photos: [null, { src: { medium: 42 } }] }), null);
  assert.equal(extractPexelsImageUrl({ photos: [{ src: { medium: 'not a URL' } }] }), null);
  assert.equal(extractPexelsImageUrl({ photos: [{ src: { medium: 'http://images.pexels.com/1.jpg' } }] }), null);
});

test('extractCollectApiProductNames accepts known response shapes and ignores malformed items', () => {
  assert.deepEqual(
    extractCollectApiProductNames({
      result: [null, { urunAdi: '  Sivri   Biber  ' }, { name: 12 }, { title: 'Domates' }],
    }),
    ['Sivri Biber', 'Domates'],
  );
  assert.deepEqual(extractCollectApiProductNames({ data: [{ product: 'Patates' }] }), ['Patates']);
  assert.deepEqual(extractCollectApiProductNames({ products: [{ name: 'Soğan' }] }), ['Soğan']);
  assert.deepEqual(extractCollectApiProductNames('unexpected'), []);
});
