import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SITE_URL, TABS, isSiteUrl, externalUrlAllowed, pageInfo } from '../src/navigation.ts';

test('only the exact website origin stays inside the authenticated app', () => {
  assert.equal(isSiteUrl(`${SITE_URL}/signup`), true);
  assert.equal(isSiteUrl(`${SITE_URL}.attacker.example/login`), false);
  assert.equal(isSiteUrl('javascript:alert(1)'), false);
  assert.equal(isSiteUrl('not a URL'), false);
  assert.equal(externalUrlAllowed('tel:+923001234567'), true);
  assert.equal(externalUrlAllowed('javascript:alert(1)'), false);
  assert.equal(externalUrlAllowed('file:///etc/passwd'), false);
});

test('dashboard routing keeps public rider registration accessible', () => {
  for (const path of ['/rider/chats', '/admin/users', '/asm', '/seller/products']) {
    assert.equal(pageInfo(path).dashboard, true);
  }
  assert.equal(pageInfo('/rider/signup').dashboard, false);
  assert.equal(pageInfo('/sellerish').dashboard, false);
  assert.equal(pageInfo('/account?tab=history').tab, 'orders');
  assert.equal(pageInfo('/account/settings').tab, 'account');
  assert.equal(pageInfo('/restaurant/123').tab, 'food');
  assert.equal(pageInfo('/store/123').tab, 'mart');
});

test('food opens first and the shopping and reels routes select their native tabs', () => {
  assert.deepEqual(TABS.map(tab => tab.id), ['food', 'shopping', 'mart', 'reels', 'orders', 'account']);
  assert.equal(TABS[0].path, '/');
  for (const tab of TABS) assert.equal(pageInfo(tab.path).tab, tab.id);
  assert.ok(TABS.every(tab => tab.icon !== '?'));
});
