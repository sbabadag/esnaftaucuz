import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePriceCoordinates, parseLatLng } from './price-coordinates.ts';

test('parseLatLng reads PostgreSQL POINT (lng,lat) strings', () => {
  assert.deepEqual(parseLatLng('(32.4564377,37.8756726)'), {
    lat: 37.8756726,
    lng: 32.4564377,
  });
});

test('parseLatLng reads {lat,lng} objects', () => {
  assert.deepEqual(parseLatLng({ lat: 37.8, lng: 32.4 }), { lat: 37.8, lng: 32.4 });
});

test('parseLatLng reads {x,y} point objects as lng/lat', () => {
  assert.deepEqual(parseLatLng({ x: 32.4, y: 37.8 }), { lat: 37.8, lng: 32.4 });
});

test('parseLatLng returns null for invalid input', () => {
  assert.equal(parseLatLng(null), null);
  assert.equal(parseLatLng(''), null);
  assert.equal(parseLatLng('(a,b)'), null);
});

test('normalizePriceCoordinates adds lat/lng from price.coordinates', () => {
  const row = normalizePriceCoordinates({
    id: '1',
    coordinates: '(32.4564377,37.8756726)',
  });
  assert.equal(row.lat, 37.8756726);
  assert.equal(row.lng, 32.4564377);
});

test('normalizePriceCoordinates falls back to location.coordinates', () => {
  const row = normalizePriceCoordinates({
    id: '1',
    coordinates: null,
    location: { coordinates: '(32.1,37.2)' },
  });
  assert.equal(row.lat, 37.2);
  assert.equal(row.lng, 32.1);
});
