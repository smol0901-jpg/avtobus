// Точка входа: состояние вкладки, рендер, обработчики событий, уведомления.
import { S, save, route, addRoute, updRoute, delRoute, parseLines, flightsToText, resetAll, importJSON, exportJSON, workday, isHoliday, ymd, kindOf, fetchTemplate } from './store.js';
import * as V from './views.js';
import { $, toast, confirmBox, vibrate, EXAMPLE_A, EXAMPLE_TRAIN } from './ui.js';
import { VERSION } from './data.js';
import { toMin, minOf } from './time.js';
import { openVkMessage, copyText, MSG_BUS, MSG_TRAIN, MSG_BOTH } from './vk.js';

const TABS = ['sched', 'routes', 'profile', 'about'];
const pages = { sched: V.schedule, routes: V.routes, profile: V.profile, about: V.about };
const KEY = 'rt.tab';

let deferred = null;
let lastKey = '';
let storageInfo = '—';
let editingId = null; // id маршрута, который редактируется во вкладке «Маршруты»

// ---- Выбор вкладки: hash (#/sched) + сохранение последней ----
function currentTab() {
  const h = location.hash.replace(/^#\/?/, '');
  if (TABS.includes(h)) return h;
  const saved = localStorage.getItem(KEY);
  return TABS.includes(saved) ? saved : 'sched';
}
let tab = currentTab();
addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (TABS.includes(h) && h !== tab) { tab = h; render(true); }
});

// ---- Рендер ----
const view = $('#view');

function editingData() {
  if (!editingId) return null;
  const rt = S.routes.find(x => x.id === editingId && !x.builtin);
  if (!rt) { editingId = null; return null; }
  const split = (rt.name || '').split(/\s*(?:↔|—|-{2,})\s*/);
  return {
    id: rt.id, name: rt.name, price: rt.price || 0, kind: kindOf(rt),
    from: split[0] || '', to: split[1] || '', dirs: rt.dirs
  };
}

function ctx() {
  const now = new Date(), tmr = new Date(now.getTime() + 864e5);
  return {
    VERSION,
    workToday: workday(now),
    workTomorrow: workday(tmr),
    holidayToday: isHoliday(ymd(now)),
    canInstall: !!deferred,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    notifySupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    storageUsed: storageInfo,
    example: EXAMPLE_A,
    exampleB: EXAMPLE_TRAIN,
    editing: editingData(),
    fmt: flightsToText
  };
}

// Оценка объёма данных — асинхронно, результат подставляется в следующий рендер
if (navigator.storage?.estimate) {
  navigator.storage.estimate().then(({ usage }) => {
    storageInfo = usage ? Math.max(1, Math.round(usage / 1024)) + ' КБ' : '—';
  }).catch(() => {});
}

function render(force) {
  document.documentElement.dataset.theme = S.s.theme;
  const now = new Date(), r = route();
  const c = ctx();
  // Если направление вне диапазона маршрута — сбросить (защита после смены маршрута)
  if (S.s.dir >= r.dirs.length) { S.s.dir = 0; save(); }

  const key = JSON.stringify([tab, r.id, S.s.dir, S.s.filter, S.s.past, S.s.compact, S.s.pinned, S.s.name, S.s.theme,
    S.s.alerts, S.s.holidays.length, now.getHours(), now.getMinutes(), c.canInstall, c.standalone, storageInfo, editingId]);
  if (!force && key === lastKey) return; // ничего не изменилось — не трогаем DOM
  lastKey = key;

  const y = scrollY, active = document.activeElement, aid = active && active.id;
  view.innerHTML = pages[tab](S, r, now, c);
  document.querySelectorAll('.tabbar button').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  const n = $('#net');
  n.textContent = navigator.onLine ? 'онлайн' : 'офлайн';
  n.classList.toggle('off', !navigator.onLine);
  if (aid && aid !== 'name' && aid !== 'hol') {
    const el = document.getElementById(aid);
    if (el) el.focus();
  }
  scrollTo(0, y);
  tickLive();
}

// Плавный тик обратного отсчёта в hero без перерисовки всего экрана
function tickLive() {
  const el = $('.live');
  clearInterval(tickLive._t);
  if (!el) return;
  let left = Math.max(0, +el.dataset.live - Math.floor(Date.now() / 1000) % 86400);
  tickLive._t = setInterval(() => {
    if (document.hidden) return;
    left--;
    const b = el.querySelector('#liveS');
    if (!b) { clearInterval(tickLive._t); return; }
    if (left <= 0) {
      b.textContent = 'сейчас';
      clearInterval(tickLive._t);
      setTimeout(() => render(true), 1200);
      return;
    }
    b.textContent = left + ' с';
  }, 1000);
}

// ---- Обновление приложения через Service Worker ----
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

// ---- Уведомления о ближайшем рейсе ----
let notifSeen = new Set();
async function checkNotify() {
  if (!S.s.alerts || !('Notification' in window) || Notification.permission !== 'granted' || document.hidden) return;
  const r = route(), di = Math.min(S.s.dir, r.dirs.length - 1);
  const now = new Date(), nm = minOf(now);
  const wk = !workday(now);
  const f = r.dirs[di].flights
    .filter(x => !(x.w && wk) && toMin(x.t) >= nm)
    .sort((a, b) => toMin(a.t) - toMin(b.t))[0];
  if (!f) return;
  const m = toMin(f.t) - nm;
  const id = r.id + di + f.t;
  if (m > 0 && m <= 5 && !notifSeen.has(id)) {
    notifSeen.add(id);
    try {
      new Notification('Автобус через ' + m + ' мин', {
        body: `${f.t} ${String(f.r).split(' ')[0]} · ${r.name}`,
        tag: 'rt-' + id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', silent: false
      });
      vibrate([80, 60, 80]);
    } catch (e) {}
  }
  if (m < 0 || m > 10) notifSeen.delete(id);
}

// ---- Действия (data-act) ----
const A = {
  dir: v => { S.s.dir = +v; S.s.filter = ''; },
  filter: v => { S.s.filter = v; },
  pin: v => { const p = S.s.pinned, i = p.indexOf(v); i < 0 ? p.push(v) : p.splice(i, 1); vibrate(10); },
  past: () => { S.s.past = !S.s.past; },
  compact: () => { S.s.compact = !S.s.compact; },
  pick: v => { S.s.route = v; S.s.dir = 0; S.s.filter = ''; editingId = null; setTab('sched'); },
  edit: v => { editingId = v; scrollTo(0, 0); },
  cancelEdit: () => { editingId = null; },
  theme: v => { S.s.theme = v; },
  alerts: async () => {
    if (!S.s.alerts && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
    S.s.alerts = !S.s.alerts;
    toast(S.s.alerts ? 'Оповещения включены' : 'Оповещения выключены');
  },
  notif: async () => {
    try {
      const p = await Notification.requestPermission();
      toast(p === 'granted' ? 'Уведомления разрешены' : 'Браузер не разрешил уведомления');
    } catch (e) { toast('Не удалось запросить разрешения'); }
  },
  share: async v => {
    const { t, text } = JSON.parse(v);
    const full = t + '\n' + text + '\n' + location.href;
    try {
      if (navigator.share) await navigator.share({ title: t, text, url: location.href });
      else { await navigator.clipboard.writeText(full); toast('Скопировано в буфер обмена'); }
    } catch (e) { /* пользователь закрыл окно */ }
    return 1;
  },
  addHol: () => {
    const el = $('#hol'), v = el && el.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return toast('Сначала выберите дату');
    if (!S.s.holidays.includes(v)) { S.s.holidays.push(v); S.s.holidays.sort(); toast('Добавлено: ' + v); }
    else toast('Эта дата уже в списке');
    return 1;
  },
  delHol: v => { S.s.holidays = S.s.holidays.filter(h => h !== v); },
  clearHol: async () => {
    if (await confirmBox({ title: 'Очистить праздники?', text: 'Список будет пуст, будни определяются только по дням недели.', ok: 'Очистить', danger: true })) {
      S.s.holidays = [];
      render(true);
    }
    return 1;
  },
  del: async v => {
    const r = S.routes.find(x => x.id === v);
    if (r && await confirmBox({ title: 'Удалить маршрут?', text: `«${r.name}» будет удалён с этого устройства.`, ok: 'Удалить', danger: true })) {
      delRoute(v); toast('Маршрут удалён');
    }
    return 1;
  },
  reset: async () => {
    if (await confirmBox({ title: 'Сбросить всё?', text: 'Ваши маршруты, настройки и имя будут удалены.', ok: 'Сбросить', danger: true })) {
      resetAll(); tab = 'sched'; setTab('sched'); toast('Данные сброшены'); render(true);
    }
    return 1;
  },
  update: () => { update(); return 1; },
  install: async () => {
    if (!deferred) return toast('Кнопка появится, когда браузер предложит установку');
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (outcome === 'accepted') { deferred = null; toast('Приложение установлено'); }
    return 1;
  },
  import: () => { $('#file').click(); return 1; },
  vkupd: async v => {
    const text = v === 'train' ? MSG_TRAIN : v === 'both' ? MSG_BOTH : MSG_BUS;
    const ok = copyText(text); // текст уже в буфере — на случай, если окно не откроется
    openVkMessage(text);
    if (await ok) toast('Текст скопирован. В VK нажмите «Отправить»');
    return 1;
  },
  dlTpl: v => {
    const a = document.createElement('a');
    a.href = new URL(v, document.baseURI).href;
    a.download = v.split('/').pop();
    a.click();
    toast('Шаблон скачан');
    return 1;
  },
  loadTpl: async v => {
    try {
      const n = importJSON(await fetchTemplate(v));
      toast(`Загружено маршрутов: ${n}`);
      setTab('sched');
      render(true);
    } catch (e) { toast('Не удалось загрузить шаблон' + (navigator.onLine ? '' : ' — нет сети')); }
    return 1;
  },
  export: () => {
    const data = exportJSON();
    if (!JSON.parse(data).routes.length) return toast('Нечего экспортировать — своих маршрутов нет');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'reyzino-transit.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('Файл сохранён');
    return 1;
  }
};

function setTab(t) {
  tab = t;
  localStorage.setItem(KEY, t);
  history.replaceState(null, '', '#/' + t);
}

// ---- Обработчики событий ----
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.tab) { setTab(t.dataset.tab); scrollTo(0, 0); return render(true); }
  const fn = A[t.dataset.act];
  if (!fn) return;
  const out = fn(t.dataset.v);
  if (out instanceof Promise) out.then(r => { if (r !== 1) { save(); render(true); } });
  else if (out !== 1) { save(); render(true); }
});

document.addEventListener('input', e => {
  if (e.target.id === 'name') { S.s.name = e.target.value.trim(); save(); }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const el = e.target.elements, g = n => el[n].value.trim();
  const a = parseLines(g('a')), b = parseLines(g('b'));
  if (!a.length) return toast('В строке «туда» не распознано ни одного рейса');
  const dirs = [{ title: g('from') + ' → ' + g('to'), flights: a }];
  if (b.length) dirs.push({ title: g('to') + ' → ' + g('from'), flights: b });
  const kind = el.kind.value === 'train' ? 'train' : 'bus';
  const id = el.id && el.id.value || 'r' + Date.now().toString(36);
  updRoute({
    id, name: g('name'), price: +g('price') || 0, kind,
    updated: ymd(new Date()), builtin: false, dirs
  });
  editingId = null;
  setTab('sched');
  toast(`Маршрут сохранён: ${a.length + b.length} рейсов`);
  render(true);
});

$('#file').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 2e6) throw new Error('too big');
    const n = importJSON(await f.text());
    toast(`Импортировано маршрутов: ${n}`);
  } catch (er) { toast('Файл не подходит: нужен JSON из «Экспорт JSON»'); }
  e.target.value = '';
  render(true);
});

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
  if (tab === 'profile') render(true);
});
addEventListener('appinstalled', () => { deferred = null; toast('Приложение установлено'); render(true); });

addEventListener('online', () => render(true));
addEventListener('offline', () => render(true));

// Раз в секунду — уведомления; раз в минуту — перерисовка списка рейсов
setInterval(() => { if (!document.hidden) checkNotify(); }, 1000);
setInterval(() => { if (tab === 'sched' && !document.hidden) render(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(true); });

// ---- Service Worker ----
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (had && !window.__reloaded) { window.__reloaded = true; location.reload(); }
  });
}

render(true);
