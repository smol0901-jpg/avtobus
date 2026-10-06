// Дашборд: быстрая сводка по всем маршрутам на одном экране.
// Открыл приложение — сразу видно ближайший автобус и ближайшую электричку,
// пересадку, актуальность данных и режим дня. Детали — во вкладке «Рейсы».
import { esc, cnt } from './ui.js';
import { toMin, minOf, addMin, human, dateLabel } from './time.js';
import { kindOf, season, freshness, linkTo, upcoming } from './store.js';

const ICO_BUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 10h16"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/><path d="M7 17v2M17 17v2"/></svg>';
const ICO_TRAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M9 20l-2 2M15 20l2 2"/><circle cx="9" cy="13.5" r=".6" fill="currentColor"/><circle cx="15" cy="13.5" r=".6" fill="currentColor"/></svg>';
const ico = k => (k === 'train' ? ICO_TRAIN : ICO_BUS);
const num = r => String(r).split(' ')[0];
const rest = r => String(r).split(' ').slice(1).join(' ');

// Ближайший рейс направления с учётом режима дня
function nextIn(dir, now, workToday) {
  const up = upcoming(dir, now, workToday);
  return up[0] || null;
}

// Карточка одного вида транспорта: ближайшее направление + первые рейсы
function kindCard(S, kind, now, ctx) {
  const nm = minOf(now);
  let best = null; // { route, dirIndex, dir, flight }
  for (const rt of S.routes) {
    if (kindOf(rt) !== kind) continue;
    rt.dirs.forEach((d, i) => {
      const f = nextIn(d, now, ctx.workToday);
      if (!f) return;
      const m = toMin(f.t) - nm;
      if (!best || m < toMin(best.flight.t) - nm) best = { route: rt, dirIndex: i, dir: d, flight: f };
    });
  }
  const label = kind === 'train' ? 'Электрички' : 'Автобусы';
  if (!best) {
    const any = S.routes.find(x => kindOf(x) === kind);
    return `<div class="tile ${kind}">
      <div class="tilehead">${ico(kind)}<b>${label}</b></div>
      <div class="empty sm">На сегодня рейсов нет</div>
      ${any ? `<div class="tbtns"><button class="btn sm pri" data-act="openRoute" data-v="${esc(JSON.stringify({ id: any.id, dir: 0 }))}">Открыть расписание</button></div>` : ''}
    </div>`;
  }
  const m = toMin(best.flight.t) - nm;
  const hot = m <= 15;
  const upAll = upcoming(best.dir, now, ctx.workToday).slice(0, 3);
  return `<div class="tile ${kind}${hot ? ' hot' : ''}" role="group" aria-label="${label}: ближайший рейс">
    <div class="tilehead">${ico(kind)}<b>${label}</b><span class="tsub">${esc(best.route.name)}</span></div>
    <div class="tbig${hot ? ' soon' : ''}">${m <= 0 ? 'Сейчас' : 'через ' + human(m)}</div>
    <div class="troute">${esc(best.dir.title)}</div>
    <div class="trow"><b>${best.flight.t}</b> · <span class="num">${num(best.flight.r)}</span>${esc(rest(best.flight.r))}
      ${best.flight.d ? `<span class="tarr">прибытие ${addMin(best.flight.t, best.flight.d)}</span>` : ''}</div>
    ${upAll.length > 1 ? `<div class="tnext">Затем: ${upAll.slice(1).map(x => `<b>${x.t}</b>`).join(' · ')}</div>` : ''}
    <div class="tbtns">
      <button class="btn sm pri" data-act="openRoute" data-v="${esc(JSON.stringify({ id: best.route.id, dir: best.dirIndex }))}">Все рейсы</button>
    </div>
  </div>`;
}

// Строка связки «пересадка»: ближайший рейс другого вида в том же направлении
function crossLine(S, r, di, now, ctx) {
  const lk = linkTo(S, r, di, now, ctx.workToday);
  if (!lk) return '';
  const otherTrain = kindOf(lk.route) === 'train';
  const lm = toMin(lk.flight.t) - minOf(now);
  return `<div class="dashcross${lm <= 15 ? ' hot' : ''}">
    ${ico(otherTrain ? 'train' : 'bus')}
    <span>Пересадка для «${esc(r.name)}»:</span>
    <b>${otherTrain ? 'электричка' : 'автобус'} ${lk.flight.t}</b>
    <span>· ${esc(num(lk.flight.r))} · через ${human(lm)}</span>
    <button class="btn sm" data-act="openRoute" data-v="${esc(JSON.stringify({ id: lk.route.id, dir: lk.dirIndex }))}">Открыть</button>
  </div>`;
}

export function dashboard(S, r, now, ctx) {
  const s = season(now);
  const busFresh = freshness(S.routes.find(x => kindOf(x) === 'bus') || r, now);
  const trainFresh = freshness(S.routes.find(x => kindOf(x) === 'train') || r, now);
  const dayMode = ctx.holidayToday ? 'праздник — выходной график' : !ctx.workToday ? 'выходной график' : 'будни';
  const greet = S.s.name;
  const activeCross = crossLine(S, r, Math.min(S.s.dir, r.dirs.length - 1), now, ctx);

  return `<section class="dashhead">
    <div class="dashtitle"><h2>${greet ? esc(greet) + ', ' : ''}сводка</h2>
      <div class="muted">${dateLabel(now)} · ${dayMode}${r.price ? ' · проезд ' + r.price + ' ₽' : ''}</div></div>
    <div class="statuschips">
      <span class="schip">${navigator.onLine ? 'онлайн' : 'офлайн'}</span>
      <span class="schip">${s.name} график</span>
      <span class="schip${busFresh.stale ? ' warn' : ''}">автобусы: ${esc((S.routes.find(x => kindOf(x) === 'bus') || {}).updated || '—')}</span>
      <span class="schip${trainFresh.stale ? ' warn' : ''}">электрички: ${esc((S.routes.find(x => kindOf(x) === 'train') || {}).updated || '—')}</span>
    </div>
  </section>

  <div class="tiles">
    ${kindCard(S, 'bus', now, ctx)}
    ${kindCard(S, 'train', now, ctx)}
  </div>

  ${activeCross ? `<div class="dashsec">${activeCross}</div>` : ''}

  <div class="card dashquick">
    <b>Быстрые действия</b>
    <div class="btns">
      <button class="btn sm" data-act="tabgo" data-v="sched">Полное расписание</button>
      <button class="btn sm" data-act="tabgo" data-v="routes">Маршруты и шаблоны JSON</button>
      <button class="btn sm" data-act="tabgo" data-v="profile">Оповещения и тема</button>
      <button class="btn sm vk" data-act="vkupd" data-v="both">Сообщить об изменении</button>
    </div>
    ${(busFresh.stale || trainFresh.stale)
      ? `<div class="warn-t">Данные одного из видов транспорта старше текущего (${s.name}) сезона — проверьте актуальность или напишите автору.</div>`
      : `<div class="muted">До смены графика (переход на ${s.name === 'летнее' ? 'зимний' : 'летний'}): ${cnt(freshness(r, now).days, 'день', 'дня', 'дней')}. Точное время отправления проверяйте у перевозчика.</div>`}
  </div>`;
}
