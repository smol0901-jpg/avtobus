// Версию менять вместе с VERSION в js/data.js — тогда у всех обновится кэш.
const V = 'rt-2.0.0';
const FILES = ['./','index.html','offline.html','manifest.webmanifest','css/base.css','css/components.css',
  'js/app.js','js/views.js','js/store.js','js/data.js','js/time.js','js/ui.js',
  'icons/icon.svg','icons/icon-192.png','icons/icon-512.png'];
addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES))));
addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
addEventListener('message', e => { if (e.data === 'skip') skipWaiting(); });
addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit ||
    fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; })
      .catch(() => r.mode === 'navigate' ? caches.match('offline.html') : Response.error())));
});
