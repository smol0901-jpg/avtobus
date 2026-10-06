import { esc } from './ui.js';
import { toMin, minOf, weekend, addMin, human, DAYS } from './time.js';

const num = r => r.split(' ')[0];
const rest = r => r.split(' ').slice(1).join(' ');

export function schedule(S, r, now) {
  const di = Math.min(S.s.dir, r.dirs.length - 1), d = r.dirs[di], wk = weekend(now), nm = minOf(now);
  const byTime = (a, b) => toMin(a.t) - toMin(b.t);
  const all = d.flights.filter(f => !(f.w && wk)).sort(byTime);
  const lines = [...new Set(all.map(f => num(f.r)))];
  const fl = S.s.filter && lines.includes(S.s.filter) ? S.s.filter : '';
  const list = all.filter(f => !fl || num(f.r) === fl);
  const up = list.filter(f => toMin(f.t) >= nm), past = list.filter(f => toMin(f.t) < nm);
  const delta = f => toMin(f.t) - nm;
  const cls = f => { const m = delta(f); return m < 0 ? 'past' : m <= 1 ? 'now' : m <= 15 ? 'soon' : ''; };
  const tip = S.s.name ? esc(S.s.name) + ', ' : '';

  let hero;
  if (up[0]) {
    const f = up[0], m = delta(f), c = cls(f);
    const nx = up.slice(1, 3).map(x => `<b>${x.t}</b> (${num(x.r)}, через ${human(delta(x))})`).join(' · ');
    hero = `<section class="hero ${c}"><div class="eyebrow">Ближайший рейс</div><div class="big">${m <= 0 ? 'Сейчас' : 'через ' + human(m)}</div>
      <div class="hl"><b>${f.t}</b> · <span class="num">${num(f.r)}</span>${esc(rest(f.r))}</div>
      ${f.d ? `<div class="sub">Прибытие ${addMin(f.t, f.d)} · в пути ${f.d} мин</div>` : ''}
      ${nx ? `<div class="next">Затем: ${nx}</div>` : ''}</section>`;
  } else {
    const tm = new Date(now.getTime() + 864e5), tw = weekend(tm);
    const first = d.flights.filter(f => !(f.w && tw) && (!fl || num(f.r) === fl)).sort(byTime)[0];
    hero = `<section class="hero none"><div class="eyebrow">На сегодня всё</div><div class="big" style="font-size:1.6rem">Рейсов больше нет</div>
      ${first ? `<div class="hl">Завтра первый: <b>${first.t}</b> · <span class="num">${num(first.r)}</span>${esc(rest(first.r))}</div>` : ''}</section>`;
  }
  const row = f => `<div class="row ${cls(f)} ${S.s.pinned.includes(num(f.r)) ? 'pin' : ''}">
    <div class="time">${f.t}</div>
    <div><div class="rt"><span class="num">${num(f.r)}</span>${esc(rest(f.r))}</div>
    <div class="sub">${f.d ? 'в пути ' + f.d + ' мин · прибытие ' + addMin(f.t, f.d) : 'время в пути не указано'}${f.w ? ' · только будни' : ''}</div></div>
    <div class="bd">${delta(f) < 0 ? 'ушёл' : delta(f) <= 1 ? 'сейчас' : 'через ' + human(delta(f))}</div>
    <button class="star ${S.s.pinned.includes(num(f.r)) ? 'on' : ''}" data-act="pin" data-v="${esc(num(f.r))}" aria-label="Закрепить линию ${esc(num(f.r))}">★</button></div>`;

  const shown = S.s.past ? up.concat(past.reverse()) : up;
  return `<div class="greet">${tip}сегодня ${DAYS[now.getDay()]} · ${wk ? 'выходной график' : 'будни'}${r.price ? ' · проезд ' + r.price + ' ₽' : ''}</div>
  <div class="seg">${r.dirs.map((x, i) => `<button class="${i === di ? 'on' : ''}" data-act="dir" data-v="${i}">${esc(x.title)}</button>`).join('')}</div>
  ${hero}
  <div class="chips"><button class="chip ${fl ? '' : 'on'}" data-act="filter" data-v="">Все линии</button>
  ${lines.map(l => `<button class="chip ${fl === l ? 'on' : ''}" data-act="filter" data-v="${esc(l)}">${S.s.pinned.includes(l) ? '★ ' : ''}${esc(l)}</button>`).join('')}</div>
  <div class="bar"><span>${up.length} из ${list.length} рейсов впереди</span><button class="btn sm" data-act="past">${S.s.past ? 'Скрыть ушедшие' : 'Показать ушедшие'}</button></div>
  ${shown.length ? shown.map(row).join('') : '<div class="empty">Нет рейсов</div>'}`;
}

export function routes(S) {
  return `<h2>Мои маршруты</h2>` + S.routes.map(r => `<div class="card item ${r.id === S.s.route ? 'act' : ''}">
    <div><b>${esc(r.name)}</b><div class="muted">${r.dirs.map(d => d.flights.length).join(' + ')} рейсов · обновлено ${esc(r.updated || '—')}</div></div>
    <div class="btns" style="margin:0">${r.id === S.s.route ? '' : `<button class="btn sm pri" data-act="pick" data-v="${esc(r.id)}">Открыть</button>`}
    <button class="btn sm bad" data-act="del" data-v="${esc(r.id)}">Удалить</button></div></div>`).join('') +
  `<h2>Добавить маршрут</h2><form class="card" id="add">
  <label class="field">Название<input name="name" placeholder="Дом → Работа" required></label>
  <label class="field">Откуда<input name="from" required></label><label class="field">Куда<input name="to" required></label>
  <label class="field">Цена, ₽ (необязательно)<input name="price" inputmode="numeric"></label>
  <label class="field">Рейсы «туда» — по строке: время, линия и название, минуты<textarea name="a" placeholder="07:00 518 Терволово — Гатчина 6 мин&#10;07:15 518 Терволово — Гатчина 6 мин будни" required></textarea></label>
  <label class="field">Рейсы «обратно» (необязательно)<textarea name="b"></textarea></label>
  <div class="btns"><button class="btn pri">Сохранить маршрут</button></div>
  <p class="muted">Расписание хранится только на вашем устройстве. Слово «будни» в конце строки скрывает рейс в сб и вс.</p></form>`;
}

export function profile(S, r, now, x) {
  const th = (v, t) => `<button class="${S.s.theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${t}</button>`;
  return `<h2>Профиль</h2><div class="card"><label class="field" style="margin:0">Как к вам обращаться
  <input id="name" value="${esc(S.s.name)}" maxlength="30" placeholder="Имя"></label></div>
  <div class="card"><b>Тема</b><div class="seg" style="margin:8px 0 0">${th('auto', 'Авто')}${th('light', 'Светлая')}${th('dark', 'Тёмная')}</div></div>
  <div class="card"><b>Закреплённые линии</b><div class="muted">${S.s.pinned.length ? S.s.pinned.map(esc).join(', ') : 'Нажмите ★ у рейса, чтобы выделить линию.'}</div></div>
  <div class="card"><b>Приложение</b><div class="muted">Версия ${x.VERSION} · ${navigator.onLine ? 'онлайн' : 'офлайн'}</div>
  <div class="btns"><button class="btn pri" data-act="update">⟳ Обновить приложение</button>${x.canInstall ? '<button class="btn" data-act="install">Установить</button>' : ''}</div></div>
  <div class="card"><b>Данные</b><div class="btns"><button class="btn" data-act="export">Экспорт JSON</button><button class="btn" data-act="import">Импорт JSON</button>
  <button class="btn bad" data-act="reset">Сбросить всё</button></div></div>`;
}

export function about(S, r, now, x) {
  return `<h2>О проекте</h2><div class="card"><b>Рейзино Транзит</b> v${x.VERSION}<p class="muted">Офлайн-расписание автобусов Большое Рейзино ↔ Гатчина. Данные работают без интернета и хранятся на устройстве. Всегда сверяйтесь с перевозчиком — график может измениться.</p></div>
  <div class="card links"><b>Связь с автором</b><div class="muted">Смольянинов Александр Вячеславович</div>
  <a href="https://vk.com/smolyaninovchef" target="_blank" rel="noopener">VK · smolyaninovchef</a>
  <a href="https://dzen.ru/asv_prod" target="_blank" rel="noopener">Дзен · asv_prod</a>
  <a href="https://t.me/asv_prod" target="_blank" rel="noopener">Telegram · asv_prod</a></div>
  <div class="card links"><b>Источник данных</b>
  <a href="https://rasp.yandex.ru/all-transport/krasnoarmeyskiy-prospekt-ulitsa-nesterova--bolshoe-reyzino" target="_blank" rel="noopener">Яндекс Расписания — эта остановка</a>
  <a href="https://rasp.yandex.ru/all-transport" target="_blank" rel="noopener">Яндекс Расписания — весь транспорт</a></div>`;
}
