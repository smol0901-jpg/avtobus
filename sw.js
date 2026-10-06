// Рейзино Транзит — Service Worker.
// Версия должна совпадать с VERSION в js/data.js (с префиксом rt-): тогда у всех обновится кэш.
const V = 'rt-2.7.0';
const FILES = [
  './', 'index.html', 'offline.html', 'manifest.webmanifest',
  'css/base.css', 'css/components.css',
  'js/app.js', 'js/views.js', 'js/dash.js', 'js/store.js', 'js/data.js', 'js/time.js', 'js/ui.js', 'js/geo.js', 'js/vk.js',
  'data/template-bus.json', 'data/template-electric.json', 'data/template-electric-multi.json', 'data/template-route.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Обновление по требованию кнопки «Обновить приложение»
self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  let u;
  try { u = new URL(r.url); } catch (err) { return; }
  if (u.origin !== location.origin) return;

  // Навигация: сеть в приоритете, чтобы свежая версия подхватывалась сразу; при офлайне — кэш/offline.html
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then(res => {
          const c = res.clone();
          caches.open(V).then(x => x.put('./', c));
          return res;
        })
        .catch(() => caches.match('./').then(hit => hit || caches.match('offline.html')))
    );
    return;
  }

  // Статика приложения: кэш в приоритете, новые файлы докатываются в кэш по ходу
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(hit => hit ||
      fetch(r).then(res => {
        if (res.ok && u.pathname.startsWith(location.pathname.replace(/[^/]*$/, ''))) {
          const c = res.clone();
          caches.open(V).then(x => x.put(r, c));
        }
        return res;
      }).catch(() => Response.error())
    )
  );
});
