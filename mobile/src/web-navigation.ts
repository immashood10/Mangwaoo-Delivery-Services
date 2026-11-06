export type NavigationMessage = { mode: 'push' | 'replace' | 'pop'; url: string };

export function parseNavigationMessage(raw: string, senderUrl: string, origin: string): NavigationMessage | null {
  try {
    if (raw.length > 4096 || new URL(senderUrl).origin !== origin) return null;
    const data = JSON.parse(raw);
    if (data?.type !== 'mangwaoo:navigation' || !['push', 'replace', 'pop'].includes(data.mode) || typeof data.url !== 'string') return null;
    const url = new URL(data.url);
    return url.origin === origin ? { mode: data.mode, url: url.href } : null;
  } catch { return null; }
}

// Next.js client links use the History API without loading a new document.
// Report only actual URL changes; document load events never write history.
export const WEB_NAVIGATION_SCRIPT = `
(function () {
  if (window.__mangwaooNavigationInstalled) return;
  window.__mangwaooNavigationInstalled = true;
  var lastUrl = window.location.href;
  function report(mode) {
    var url = window.location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mangwaoo:navigation', mode: mode, url: url }));
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = window.history[name];
    window.history[name] = function () {
      var result = original.apply(this, arguments);
      report(name === 'pushState' ? 'push' : 'replace');
      return result;
    };
  });
  window.addEventListener('popstate', function () { report('pop'); });
})();
true;
`;
