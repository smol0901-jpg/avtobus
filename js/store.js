// Хранилище: состояние приложения в localStorage + разбор текста расписания.
import { SEED, SEED_ELECTRIC, HUB, HOLIDAYS_DEFAULT } from './data.js';
import { pad, toMin, minOf } from './time.js';
import { dirPair } from './geo.js';

const K = 'rt.v6';
const LEGACY = ['rt.v5', 'rt.v4', 'rt.v3', 'rt.v2'];

const def = () => ({
  routes: [SEED, SEED_ELECTRIC],
  s: {
    theme: 'auto', route: SEED.id, dir: 0, pinned: [], past: false, filter: '',
    name: '', alerts: true, holidays: [...HOLIDAYS_DEFAULT], compact: false, link: true
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
  s.compact = !!s.compact;
  s.link = s.link !== false;
  s.dir = +s.dir || 0;
  // Встроенные маршруты всегда актуальнее сохранённых копий: берём их из data.js
  for (const seed of [SEED, SEED_ELECTRIC]) {
    const i = routes.findIndex(r => r.id === seed.id);
    if (i >= 0) routes[i] = seed; else routes.unshift(seed);
  }
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
  if (!S.routes.length) S.routes = [SEED, SEED_ELECTRIC];
  if (S.s.route === id) { S.s.route = S.routes[0].id; S.s.dir = 0; S.s.filter = ''; }
  save();
}

// Обновление пользовательского маршрута (редактирование)
export function updRoute(r) {
  const i = S.routes.findIndex(x => x.id === r.id);
  if (i >= 0) S.routes[i] = r; else S.routes.push(r);
  S.s.route = r.id; S.s.dir = 0; S.s.filter = '';
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

// Обратное преобразование рейсов в текст для редактирования маршрута
export const flightsToText = fl => fl.map(f =>
  `${f.t} ${f.r}${f.d ? ' ' + f.d + ' мин' : ''}${f.w ? ' будни' : ''}`).join('\n');

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

// ---- Тип транспорта и подписи ----
export const kindOf = r => r.kind || (/электр|поезд|ржд|сапсан/i.test(r.name || '') ? 'train' : 'bus');

export const KIND_LABEL = { bus: 'Автобус', train: 'Электричка' };

// ---- Связка «автобус ↔ электричка» ----
// Работает по узлам сети (js/geo.js): приложение определяет, КАКУДА движется
// текущее направление (например, в сторону СПб), и подбирает ближайший рейс
// ДРУГОГО вида транспорта, который едет в ту же сторону. Поэтому:
//   * на экране автобуса «Большое Рейзино → Гатчина» показывается ближайшая
//     электричка «Гатчина-Варшавская → СПб»;
//   * на экране электрички «СПб → Гатчина» показывается ближайший автобус
//     «Гатчина → Большое Рейзино».
// Свойства match у маршрутов больше не нужны — всё считается по названиям.

// Ближайший (и все последующие) рейсы направления на сегодня.
export function upcoming(dir, now, workToday) {
  const nm = minOf(now);
  return dir.flights
    .filter(f => !(f.w && !workToday) && toMin(f.t) >= nm)
    .sort((a, b) => toMin(a.t) - toMin(b.t));
}

const nextFlight = (dir, now, workToday) => upcoming(dir, now, workToday)[0] || null;

// Все направления всех маршрутов нужного вида, у которых определена пара узлов.
function linkedDirs(routes, wantKind) {
  const out = [];
  for (const x of routes) {
    if (kindOf(x) !== wantKind) continue;
    x.dirs.forEach((d, i) => {
      const p = dirPair(d.title);
      if (p) out.push({ route: x, dirIndex: i, dir: d, pair: p });
    });
  }
  return out;
}

// Главная связка: для текущего маршрута и направления подбирает ближайший
// рейс ДРУГОГО вида транспорта в том же направлении. Возвращает
// { route, dirIndex, flight, pair } или null, если подходящей связки нет.
// Направления «рейсовозных» маршрутов (Гатчина → СПб) могут не иметь пары
// узлов — тогда направление выводится из текста первого рейса («6822
// Гатчина-Варшавская — СПб-Балтийский»).
export function linkTo(S, r, di, now, workToday) {
  if (!S.s.link) return null;
  const cur = r.dirs[di];
  if (!cur) return null;
  let pair = dirPair(cur.title);
  if (!pair && cur.flights && cur.flights.length) pair = dirPair(String(cur.flights[0].r || ''));
  if (!pair) return null;
  const want = kindOf(r) === 'train' ? 'bus' : 'train';
  const cands = [];
  for (const x of S.routes) {
    if (x.id === r.id || kindOf(x) !== want) continue;
    x.dirs.forEach((d, i) => {
      let p = dirPair(d.title);
      if (!p && d.flights && d.flights.length) p = dirPair(String(d.flights[0].r || ''));
      if (p) cands.push({ route: x, dirIndex: i, dir: d, pair: p });
    });
  }
  const matched = cands.filter(m => m.pair[0] === pair[0] && m.pair[1] === pair[1]);
  // Если точного совпадения узлов нет, допускаем связку через общий узел
  // назначения (электричка до СПб считается продолжением пути в ту же сторону).
  const pool = matched.length ? matched : cands.filter(m => m.pair[1] === pair[1]);
  for (const m of pool) {
    const f = nextFlight(m.dir, now, workToday);
    if (f) return { route: m.route, dirIndex: m.dirIndex, flight: f, pair };
  }
  return null;
}

// ---- Актуальность данных: сезонное расписание ----
// Сезон меняется ориентировочно в первую субботу апреля (летнее) и октября (зимнее).
const firstSat = (y, m) => { const d = new Date(y, m, 1); return new Date(y, m, 1 + ((6 - d.getDay()) + 7) % 7); };
export function season(now = new Date()) {
  const y = now.getFullYear(), summer = firstSat(y, 3), winter = firstSat(y, 9);
  if (now >= winter) return { name: 'зимнее', switchDate: firstSat(y + 1, 3) };
  if (now >= summer) return { name: 'летнее', switchDate: winter };
  return { name: 'зимнее', switchDate: summer };
}

// Дней до смены сезона; если данные старше начала текущего сезона — пора обновлять.
export function freshness(r, now = new Date()) {
  const s = season(now);
  const days = Math.ceil((s.switchDate - now) / 864e5);
  let stale = false;
  if (r.updated) {
    const upd = new Date(r.updated + 'T00:00:00');
    // Начало текущего сезона: для летнего — апрель этого года, для зимнего — октябрь этого или прошлого года
    const curStart = s.name === 'летнее' ? firstSat(now.getFullYear(), 3)
      : (now.getMonth() >= 9 ? firstSat(now.getFullYear(), 9) : firstSat(now.getFullYear() - 1, 9));
    stale = upd < curStart;
  }
  return { days, stale };
}

// ---- Шаблоны JSON (папка data/ в репозитории) ----
export const TEMPLATES = [
  { file: 'data/template-electric.json', title: 'Электрички: Гатчина-Варшавская ↔ Балтийский вокзал', desc: 'Готовый пример маршрута вида «Электричка» с временем в пути. Отредактируйте под своё направление и загрузите.' },
  { file: 'data/template-electric-multi.json', title: 'Электрички: несколько направлений', desc: 'Шаблон с 4 направлениями: Гатчина-Варшавская и СПб (Балтийский) в обе стороны. Заполните времена рейсов.' },
  { file: 'data/template-bus.json', title: 'Автобусы: Большое Рейзино ↔ Гатчина', desc: 'Расписание на 2026-10-06 (летнее). Замените рейсы на зимние и импортируйте.' },
  { file: 'data/template-route.json', title: 'Пустой каркас маршрута', desc: 'Заполните поля своими данными и импортируйте одним файлом.' }
];

export async function fetchTemplate(file) {
  const base = document.baseURI || location.href;
  const res = await fetch(new URL(file, base));
  if (!res.ok) throw new Error('http ' + res.status);
  return res.text();
}

// Слово «рейс» в зависимости от вида транспорта
export const tripWord = (r, one, few, many) => kindOf(r) === 'train'
  ? { one: 'поезд', few: 'поезда', many: 'поездов' }[{ one, few, many }] || many
  : { one, few, many }[{ one, few, many }];

