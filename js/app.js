import { S, save, route, addRoute, delRoute, parseLines, resetAll, importJSON, exportJSON } from './store.js';
import * as V from './views.js';
import { $, toast } from './ui.js';
import { VERSION } from './data.js';

let tab = 'sched', deferred = null;
const view = $('#view');
const pages = { sched: V.schedule, routes: V.routes, profile: V.profile, about: V.about };

function render() {
  document.documentElement.dataset.theme = S.s.theme;
  const y = scrollY;
  view.innerHTML = pages[tab](S, route(), new Date(), { VERSION, canInstall: !!deferred });
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const n = $('#net'); n.textContent = navigator.onLine ? 'онлайн' : 'офлайн'; n.classList.toggle('off', !navigator.onLine);
  scrollTo(0, y);
}

async function update() {
  if (!('serviceWorker' in navigator)) return location.reload();
  toast('Проверяю обновления…');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return location.reload();
  try { await reg.update(); } catch (e) { return toast('Нет сети — проверить не удалось'); }
  const go = () => reg.waiting && reg.waiting.postMessage('skip');
  if (reg.waiting) go();
  else if (reg.installing) reg.installing.addEventListener('statechange', go);
  else toast('У вас последняя версия ' + VERSION);
}

const A = {
  dir: v => { S.s.dir = +v; S.s.filter = ''; },
  filter: v => { S.s.filter = v; },
  pin: v => { const p = S.s.pinned, i = p.indexOf(v); i < 0 ? p.push(v) : p.splice(i, 1); },
  past: () => { S.s.past = !S.s.past; },
  pick: v => { S.s.route = v; S.s.dir = 0; S.s.filter = ''; tab = 'sched'; },
  del: v => { if (confirm('Удалить маршрут?')) delRoute(v); },
  theme: v => { S.s.theme = v; },
  update: () => { update(); return 1; },
  install: () => { deferred.prompt(); deferred = null; },
  import: () => { $('#file').click(); return 1; },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    a.download = 'reyzino-transit.json'; a.click(); return 1;
  },
  reset: () => { if (confirm('Удалить все данные и вернуть исходные?')) { resetAll(); toast('Данные сброшены'); } }
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; scrollTo(0, 0); return render(); }
  const skip = A[t.dataset.act](t.dataset.v);
  if (!skip) { save(); render(); }
});
document.addEventListener('input', e => { if (e.target.id === 'name') { S.s.name = e.target.value.trim(); save(); } });
document.addEventListener('submit', e => {
  e.preventDefault();
  const el = e.target.elements, g = n => el[n].value.trim();
  const a = parseLines(g('a')), b = parseLines(g('b'));
  if (!a.length) return toast('Не распознано ни одной строки расписания');
  const dirs = [{ title: g('from') + ' → ' + g('to'), flights: a }];
  if (b.length) dirs.push({ title: g('to') + ' → ' + g('from'), flights: b });
  addRoute({ id: 'r' + Date.now().toString(36), name: g('name'), price: +g('price') || 0, updated: new Date().toISOString().slice(0, 10), dirs });
  tab = 'sched'; toast('Маршрут добавлен'); render();
});
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { toast('Импортировано маршрутов: ' + importJSON(await f.text())); } catch (er) { toast('Файл не подходит'); }
  e.target.value = ''; render();
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (tab === 'profile') render(); });
addEventListener('online', render); addEventListener('offline', render);
setInterval(() => { if (tab === 'sched' && !document.hidden) render(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && tab === 'sched') render(); });

if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js');
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
}
render();
