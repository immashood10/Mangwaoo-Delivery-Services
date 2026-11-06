import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppHistory } from '../src/history.ts';

test('two consecutive Back presses return Mart -> Food -> Home', () => {
  const history = new AppHistory('https://mangwaoo.example');
  history.visit('/gulplaza');
  history.visit('/mart');
  assert.equal(history.back(), 'https://mangwaoo.example/gulplaza');
  assert.equal(history.back(), 'https://mangwaoo.example/');
  assert.equal(history.back(), null);
});

test('duplicate tab taps and reloads do not create extra Back entries', () => {
  const history = new AppHistory('https://mangwaoo.example/');
  history.visit('/');
  history.visit('/gulplaza');
  history.visit('/gulplaza');
  history.visit('/mart');
  history.visit('/mart');
  assert.equal(history.back(), 'https://mangwaoo.example/gulplaza');
  assert.equal(history.back(), 'https://mangwaoo.example/');
  assert.equal(history.back(), null);
});

test('website replace navigation keeps login redirects in one history entry', () => {
  const history = new AppHistory('https://mangwaoo.example/');
  history.visit('/account');
  history.replace('/login?next=%2Faccount');
  assert.equal(history.back(), 'https://mangwaoo.example/');
});

test('website product links and browser popstate share the native history', () => {
  const history = new AppHistory('https://mangwaoo.example/');
  history.visit('/mart');
  history.visit('/mart/product-123');
  history.restore('/mart');
  assert.equal(history.back(), 'https://mangwaoo.example/');
});

test('external URLs and invalid URLs cannot enter the app history', () => {
  const history = new AppHistory('https://mangwaoo.example/');
  history.visit('https://attacker.example');
  history.replace('javascript:alert(1)');
  history.restore('https://attacker.example');
  assert.equal(history.back(), null);
});
