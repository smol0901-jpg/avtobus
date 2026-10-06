// Хранилище: состояние приложения в localStorage + разбор текста расписания.
import { SEED, HOLIDAYS_DEFAULT } from './data.js';
import { pad, toMin } from './time.js';

const K = 'rt.v3';
const LEGACY = ['rt.v2'];

const def = () => ({
  routes: [SEED],
  s: {
    theme: 'auto', route: SEED.id, dir: 0, pinned: [], past: false, filter: '',
    name: '', alerts: true, holidays: [...HOLIDAYS_DEFAULT]
  }
});

function validRoute(r) {
  return r && typeof r.id === 'string' && typeof r.name === 'string'
    && Array.isArray(r.dirs) && r.dirs.every(d => d && typeof d.title === 'string' && Array.isArray(d.flights));
}

function normalize(x) {
  const base = def();
  if (!x || !Array.isArray(x.routes)) return base;
  const routes = x.routes.filter(validRoute);
  const s = { ...base.s, ...(x.s || {}) };
  s.pinned = Array.isArray(s.pinned) ? s.pinned.map(String) : [];
  s.holidays = Array.isArray(s.holidays) ? s.holidays.filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h)).sort() : [...HOLIDAYS_DEFAULT];
  s.theme = ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto';
  s.dir = +s.dir || 0;
  if (!routes.length) routes.push(SEED);
  if (!routes.some(r => r.id === s.route)) s.route = routes[0].id;
  return { routes, s };
}

function load() {
  try {
    let raw = localStorage.getItem(K);
    let key = K;
    if (!raw) {
      for (const lk of LEGACY) {
        const v = localStorage.getItem(lk);
        if (v) { raw = v; key = lk; break; }
      }
    }
    if (raw) {
      const norm = normalize(JSON.parse(raw));
      if (key !== K) { localStorage.setItem(K, JSON.stringify(norm)); localStorage.removeItem(key); }
      return norm;
    }
  } catch (e) {}
  return def();
}

export let S = load();

export const save = () => {
  try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {}
};

export const route = () => S.routes.find(r => r.id === S.s.route) || S.routes[0];

export function addRoute(r) {
  S.routes = S.routes.filter(x => x.id !== r.id).concat(r);
  S.s.route = r.id; S.s.dir = 0; S.s.filter = '';
  save();
}

export function delRoute(id) {
  S.routes = S.routes.filter(r => r.id !== id);
  if (!S.routes.length) S.routes = [SEED];
  if (S.s.route === id) { S.s.route = S.routes[0].id; S.s.dir = 0; S.s.filter = ''; }
  save();
}

export function resetAll() {
  S = def();
  save();
}

export const isHoliday = dateStr => S.s.holidays.includes(dateStr);

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Рабочий ли день: не сб/вс и не праздник
export const workday = d => !((d.getDay() === 0 || d.getDay() === 6) || isHoliday(ymd(d)));

// ---- Разбор текстового расписания ----
// Формат строки: «07:15 518 Терволово — Гатчина [6 мин] [будни|выходные]»
const RE_LINE = /^(\d{1,2})[:.](\d{2})\s+(.+)$/i;
const RE_TAIL = /\s+(\d{1,3})\s*м(?:ин|.)?\s*(будни?|выходные?)?\s*$/i;
const RE_TAIL2 = /\s+(будни?|выходные?)\s*$/i;

export function parseLines(txt) {
  const out = [];
  for (const l of String(txt || '').split('\n')) {
    const m = l.trim().match(RE_LINE);
    if (!m || +m[1] > 23 || +m[2] > 59) continue;
    let r = m[3].trim(), d = 0, w = false;
    let t = r.match(RE_TAIL); // «... 6 мин будни» / «... 6 мин.»
    if (t && t[1]) {
      d = +t[1] || 0;
      w = !!t[2] && !/выход/i.test(t[2]);
      r = r.slice(0, t.index).trim();
    } else {
      t = r.match(RE_TAIL2); // «... будни» без минут
      if (t) {
        w = !/выход/i.test(t[1]);
        r = r.slice(0, t.index).trim();
      }
    }
    if (!r) continue;
    out.push({ t: pad(+m[1]) + ':' + m[2], r, d, w });
  }
  out.sort((a, b) => toMin(a.t) - toMin(b.t));
  return out;
}

// ---- Импорт/экспорт ----
// Экспортируются только пользовательские маршруты: встроенные приходят с приложением.
export const exportJSON = () => JSON.stringify({
  app: 'reyzino-transit', kind: 'routes', version: 1, exported: new Date().toISOString(),
  routes: S.routes.filter(r => !r.builtin)
}, null, 1);

export function importJSON(txt) {
  const x = JSON.parse(txt);
  const list = Array.isArray(x) ? x : x && Array.isArray(x.routes) ? x.routes : [];
  const ok = list.filter(validRoute);
  if (!ok.length) throw new Error('no routes');
  ok.forEach(r => {
    r.builtin = false;
    S.routes = S.routes.filter(q => q.id !== r.id).concat(r);
  });
  save();
  return ok.length;
}
