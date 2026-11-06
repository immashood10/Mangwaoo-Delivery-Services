import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseNavigationMessage, WEB_NAVIGATION_SCRIPT } from '../src/web-navigation.ts';

test('only validated navigation messages from the website are accepted', () => {
  const origin = 'https://mangwaoo.example';
  const raw = JSON.stringify({ type: 'mangwaoo:navigation', mode: 'push', url: `${origin}/mart` });
  assert.deepEqual(parseNavigationMessage(raw, `${origin}/`, origin), { mode: 'push', url: `${origin}/mart` });
  assert.equal(parseNavigationMessage(raw, 'https://attacker.example/', origin), null);
  assert.equal(parseNavigationMessage('not JSON', `${origin}/`, origin), null);
  assert.equal(parseNavigationMessage(JSON.stringify({ type: 'mangwaoo:navigation', mode: 'push', url: 'javascript:alert(1)' }), `${origin}/`, origin), null);
  assert.equal(parseNavigationMessage(JSON.stringify({ type: 'mangwaoo:navigation', mode: 'delete', url: origin }), `${origin}/`, origin), null);
});

test('the injected bridge preserves History calls and reports only real URL changes', () => {
  const messages = [];
  const listeners = {};
  const window = {
    location: { href: 'https://mangwaoo.example/' },
    ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) },
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  window.history = {
    pushState(state, title, url) { window.location.href = new URL(url, window.location.href).href; return 'preserved'; },
    replaceState(state, title, url) { window.location.href = new URL(url, window.location.href).href; },
  };
  const styles = new Map();
  const document = {
    head: { appendChild(node) { styles.set(node.id, node); } },
    documentElement: { appendChild(node) { styles.set(node.id, node); } },
    getElementById(id) { return styles.get(id) ?? null; },
    createElement() { return { id: '', textContent: '' }; },
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(WEB_NAVIGATION_SCRIPT, context);
  vm.runInContext(WEB_NAVIGATION_SCRIPT, context); // idempotent across repeated injection
  assert.equal(messages.length, 0);
  assert.equal(styles.get('mangwaoo-native-app-style').textContent, 'footer{display:none!important}');
  assert.equal(styles.size, 1);
  assert.equal(window.history.pushState({}, '', '/mart'), 'preserved');
  window.history.replaceState({}, '', '/mart?category=1');
  window.history.replaceState({}, '', '/mart?category=1');
  window.location.href = 'https://mangwaoo.example/';
  listeners.popstate();
  assert.deepEqual(messages.map(({ mode }) => mode), ['push', 'replace', 'pop']);
  assert.equal(messages[0].url, 'https://mangwaoo.example/mart');
});
