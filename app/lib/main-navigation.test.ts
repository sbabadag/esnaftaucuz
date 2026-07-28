import assert from 'node:assert/strict';
import test from 'node:test';
import { getMainTabConfigs } from './main-navigation.ts';

test('main navigation exposes favorites as a first-class button for every user role', () => {
  for (const isMerchant of [false, true]) {
    const tabs = getMainTabConfigs(isMerchant);
    const favorites = tabs.find((tab) => tab.path === 'favorites');

    assert.ok(favorites);
    assert.equal(favorites.labelKey, 'LIKED_PRODUCTS');
    assert.equal(favorites.icon, 'heart');
  }
});
