// Экраны приложения. Каждая функция возвращает HTML-строку; обработчики — делегирование в app.js.
import { esc, cnt } from './ui.js';
import { toMin, minOf, addMin, human, dateLabel } from './time.js';
import { kindOf, KIND_LABEL } from './store.js';

const num = r => String(r).split(' ')[0];
const rest = r => String(r).split(' ').slice(1).join(' ');

// ---------- Рейсы ----------
export function schedule(S, r, now, ctx) {
  const di = Math.min(S.s.dir, r.dirs.length - 1);
  const d = r.dirs[di];
  const wk = !ctx.workToday;
  const nm = minOf(now);
  const train = kindOf(r) === 'train';
  const trip = train ? ['поезд', 'поезда', 'поездов'] : ['рейс', 'рейса', 'рейсов'];
  const verb = train ? 'отправление' : '';
  const byTime = (a, b) => toMin(a.t) - toMin(b.t);

  // Выбор маршрута: список для смены прямо на экране
  const picker = `<nav class="rtabs" aria-label="Маршруты">${S.routes.map(x => {
    const on = x.id === r.id;
    return `<button class="${on ? 'on' : ''}" data-act="pick" data-v="${esc(x.id)}" aria-pressed="${on}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
        kindOf(x) === 'train'
          ? '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M9 20l-2 2M15 20l2 2"/><circle cx="9" cy="13.5" r=".6" fill="currentColor"/><circle cx="15" cy="13.5" r=".6" fill="currentColor"/>'
          : '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 10h16"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/><path d="M7 17v2M17 17v2"/>'}</svg>
      <span>${esc(x.name)}</span></button>`;
  }).join('')}</nav>`;

  const all = d.flights.filter(f => !(f.w && wk)).sort(byTime);
  const lines = [...new Set(all.map(f => num(f.r)))].sort();
  const fl = S.s.filter && lines.includes(S.s.filter) ? S.s.filter : '';
  const list = all.filter(f => !fl || num(f.r) === fl);
  const up = list.filter(f => toMin(f.t) >= nm);
  const past = list.filter(f => toMin(f.t) < nm);
  const delta = f => toMin(f.t) - nm;
  const cls = f => { const m = delta(f); return m < 0 ? 'past' : m <= 1 ? 'now' : m <= 15 ? 'soon' : ''; };
  const pinCls = l => S.s.pinned.includes(l) ? ' pin' : '';
  const tip = S.s.name ? esc(S.s.name) + ', ' : '';

  // Тикующий обратный отсчёт: секунды видны только когда рейс вот-вот придёт.
  let hero;
  if (up[0]) {
    const f = up[0], m = delta(f), c = cls(f);
    const sec = 60 - now.getSeconds();
    const live = m >= 0 && m <= 1
      ? `<span class="live" data-live="${toMin(f.t) * 60 + sec}">${m <= 0 ? '<b id="liveS">' + sec + ' с</b>' : '<b id="liveS">' + (60 + sec) + ' с</b>'}</span>`
      : '';
    const nx = up.slice(1, 3).map(x => `<b>${x.t}</b> (${num(x.r)}, через ${human(delta(x))})`).join(' · ');
    hero = `<section class="hero ${c}${pinCls(num(f.r))}" aria-live="polite">
      <div class="eyebrow">Ближайший ${train ? 'поезд' : 'рейс'}${ctx.holidayToday ? ' · праздник' : wk ? ' · выходной график' : ''}</div>
      <div class="big">${m <= 0 ? 'Сейчас' : 'через ' + human(m)}${live}</div>
      <div class="hl"><b>${f.t}</b> · <span class="num">${num(f.r)}</span>${esc(rest(f.r))}</div>
      ${f.d ? `<div class="sub">Прибытие ${addMin(f.t, f.d)} · в пути ${f.d} мин</div>` : `<div class="sub">${verb || 'время отправления'}</div>`}
      ${nx ? `<div class="next">Затем: ${nx}</div>` : ''}
      <div class="btns"><button class="btn sm pri" data-act="share" data-v="${esc(JSON.stringify({ t: `${r.name}: ${d.title}, ближайший ${f.t} ${num(f.r)}`, text: `Рейс ${num(f.r)} в ${f.t}` }))}">Поделиться</button></div>
    </section>`;
  } else {
    const tm = new Date(now.getTime() + 864e5), tw = !ctx.workTomorrow;
    const first = d.flights.filter(f => !(f.w && tw) && (!fl || num(f.r) === fl)).sort(byTime)[0];
    hero = `<section class="hero none"><div class="eyebrow">На сегодня всё</div>
      <div class="big small">${train ? 'Поездов' : 'Рейсов'} больше нет</div>
      ${first ? `<div class="hl">Завтра первый: <b>${first.t}</b> · <span class="num">${num(first.r)}</span>${esc(rest(first.r))}</div>` : ''}
    </section>`;
  }

  const row = f => {
    const l = num(f.r), m = delta(f);
    return `<div class="row ${cls(f)}${pinCls(l)}${S.s.compact ? ' cmp' : ''}">
      <div class="time">${f.t}</div>
      <div class="rtwrap">
        <div class="rt"><span class="num">${l}</span>${esc(rest(f.r))}</div>
        <div class="sub">${f.d ? 'в пути ' + f.d + ' мин · прибытие ' + addMin(f.t, f.d) : 'время в пути не указано'}${f.w ? ' · только будни' : ''}</div>
      </div>
      <div class="bd">${m < 0 ? 'ушёл' : m <= 1 ? 'сейчас' : 'через ' + human(m)}</div>
      <button class="star${S.s.pinned.includes(l) ? ' on' : ''}" data-act="pin" data-v="${esc(l)}"
        aria-label="${S.s.pinned.includes(l) ? 'Открепить линию ' : 'Закрепить линию '}${esc(l)}" aria-pressed="${S.s.pinned.includes(l)}">${S.s.pinned.includes(l) ? '★' : '☆'}</button>
    </div>`;
  };

  const shown = S.s.past ? up.concat(past.slice().reverse()) : up;
  return `${picker}
  <div class="greet">${tip}${dateLabel(now)} · ${ctx.holidayToday ? 'праздничный день — выходной график' : wk ? 'выходной график' : 'будни'}${r.price ? ' · проезд ' + r.price + ' ₽' : ''}</div>
  <div class="seg" role="group" aria-label="Направление">${r.dirs.map((x, i) =>
    `<button class="${i === di ? 'on' : ''}" data-act="dir" data-v="${i}" aria-pressed="${i === di}">${esc(x.title)}</button>`).join('')}</div>
  ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
  ${hero}
  <div class="chips" role="group" aria-label="Фильтр по линиям">
    <button class="chip${fl ? '' : ' on'}" data-act="filter" data-v="" aria-pressed="${!fl}">Все линии</button>
    ${lines.map(l => `<button class="chip${fl === l ? ' on' : ''}" data-act="filter" data-v="${esc(l)}" aria-pressed="${fl === l}">${S.s.pinned.includes(l) ? '★' : ''}${esc(l)}</button>`).join('')}
  </div>
  <div class="bar"><span>${cnt(up.length, ...trip)} впереди из ${list.length}</span>
    <div class="btns" style="margin:0">
    <button class="btn sm" data-act="compact" aria-pressed="${S.s.compact}">${S.s.compact ? 'Обычный вид' : 'Компактно'}</button>
    <button class="btn sm" data-act="past" aria-pressed="${S.s.past}">${S.s.past ? 'Скрыть ушедшие' : 'Показать ушедшие'}</button></div></div>
  ${shown.length ? shown.map(row).join('') : `<div class="empty">Нет ${trip[2]} на этот день</div>`}`;
}

// ---------- Маршруты ----------
export function routes(S, r, now, ctx) {
  const custom = S.routes.filter(x => !x.builtin);
  const formTitle = ctx.editing ? 'Редактирование маршрута' : 'Добавить маршрут';
  const e = ctx.editing || {};
  const dirs = e.dirs || [];
  return `<h2>Мои маршруты</h2>` +
  S.routes.map(rt => {
    const tr = kindOf(rt) === 'train';
    return `<div class="card item${rt.id === S.s.route ? ' act' : ''}">
    <div class="itemmain"><b>${esc(rt.name)}</b>
      <div class="muted">${KIND_LABEL[tr ? 'train' : 'bus']} · ${rt.dirs.map(d => cnt(d.flights.length, ...(tr ? ['поезд', 'поезда', 'поездов'] : ['рейс', 'рейса', 'рейсов']))).join(' и ')}${rt.builtin ? ' · встроенный' : ''} · обновлено ${esc(rt.updated || '—')}</div></div>
    <div class="btns" style="margin:0">
      ${rt.id === S.s.route ? '' : `<button class="btn sm pri" data-act="pick" data-v="${esc(rt.id)}">Открыть</button>`}
      ${rt.builtin ? '' : `<button class="btn sm" data-act="edit" data-v="${esc(rt.id)}">Изменить</button>
      <button class="btn sm bad" data-act="del" data-v="${esc(rt.id)}">Удалить</button>`}
    </div></div>`;
  }).join('') +
  `<h2>${formTitle}</h2><form class="card" id="add">
    ${ctx.editing ? `<input type="hidden" name="id" value="${esc(e.id)}">` : ''}
    <label class="field">Название<input name="name" placeholder="Дом — Работа" required maxlength="80" value="${esc(e.name || '')}"></label>
    <div class="grid2">
      <label class="field">Откуда<input name="from" required maxlength="60" placeholder="Большое Рейзино" value="${esc(e.from || '')}"></label>
      <label class="field">Куда<input name="to" required maxlength="60" placeholder="Гатчина" value="${esc(e.to || '')}"></label>
    </div>
    <div class="grid2">
      <label class="field">Вид транспорта<select name="kind" id="kindSel">
        <option value="bus"${e.kind === 'train' ? '' : ' selected'}>Автобус</option>
        <option value="train"${e.kind === 'train' ? ' selected' : ''}>Электричка</option>
      </select></label>
      <label class="field">Цена, ₽ (необязательно)<input name="price" inputmode="numeric" maxlength="5" placeholder="51" value="${e.price ? e.price : ''}"></label>
    </div>
    <label class="field">Рейсы «туда» — по строке: время, номер и название, минуты в пути
      <textarea name="a" required placeholder="${esc(ctx.example)}">${esc(dirs[0] ? ctx.fmt(dirs[0].flights) : '')}</textarea></label>
    <label class="field">Рейсы «обратно» (необязательно)<textarea name="b" placeholder="${esc(ctx.exampleB)}">${esc(dirs[1] ? ctx.fmt(dirs[1].flights) : '')}</textarea></label>
    <div class="btns"><button class="btn pri">${ctx.editing ? 'Сохранить изменения' : 'Сохранить маршрут'}</button>
    ${ctx.editing ? '<button class="btn" data-act="cancelEdit" type="button">Отмена</button>' : ''}</div>
    <p class="muted">Расписание хранится только на вашем устройстве. Слово «будни» в конце строки скрывает рейс в выходные и праздники.</p>
  </form>
  ${custom.length ? '' : '<p class="muted">Своих маршрутов пока нет. Экспортируйте свои данные в JSON, чтобы перенести их на другое устройство.</p>'}`;
}

// ---------- Профиль ----------
export function profile(S, r, now, x) {
  const th = (v, t) => `<button class="${S.s.theme === v ? 'on' : ''}" data-act="theme" data-v="${v}" aria-pressed="${S.s.theme === v}">${t}</button>`;
  const hol = S.s.holidays.slice(-14).reverse();
  return `<h2>Профиль</h2>
  <div class="card"><label class="field" style="margin:0">Как к вам обращаться
    <input id="name" value="${esc(S.s.name)}" maxlength="30" placeholder="Имя" autocomplete="given-name"></label></div>

  <div class="card"><b>Тема оформления</b>
    <div class="seg" style="margin:8px 0 0" role="group" aria-label="Тема">${th('auto', 'Авто')}${th('light', 'Светлая')}${th('dark', 'Тёмная')}</div></div>

  <div class="card"><b>Оповещения о ближайшем рейсе</b>
    <div class="muted">${x.notifySupported ? 'Уведомление придёт за 5 минут до рейса, когда приложение открыто или установлено.' : 'Браузер не поддерживает уведомления — оповещения недоступны.'}</div>
    <div class="btns"><button class="btn${S.s.alerts ? ' pri' : ''}" data-act="alerts" aria-pressed="${S.s.alerts}">${S.s.alerts ? 'Включены' : 'Выключены'}</button>
    ${x.notifySupported && x.permission !== 'granted' ? '<button class="btn" data-act="notif">Разрешить уведомления</button>' : ''}</div></div>

  <div class="card"><b>Закреплённые линии</b>
    <div class="muted">${S.s.pinned.length
      ? S.s.pinned.map(l => `<button class="chip on" data-act="pin" data-v="${esc(l)}">★ ${esc(l)}</button>`).join(' ')
      : 'Нажмите ☆ у рейса, чтобы закрепить линию — она будет подсвечена в списке.'}</div></div>

  <div class="card"><b>Праздничные дни</b>
    <div class="muted">В эти даты показывается выходной график. По умолчанию — нерабочие праздничные дни РФ.</div>
    <label class="field">Добавить дату<input id="hol" type="date" style="margin-top:4px"></label>
    <div class="btns"><button class="btn sm" data-act="addHol">Добавить день</button>
      ${hol.length ? '<button class="btn sm bad" data-act="clearHol">Очистить список</button>' : ''}</div>
    ${hol.length ? `<div class="muted hol-list">${hol.map(h => `<span class="tag">${esc(h)}<button data-act="delHol" data-v="${esc(h)}" aria-label="Удалить ${esc(h)}">×</button></span>`).join('')}</div>` : ''}</div>

  <div class="card"><b>Приложение</b>
    <div class="muted">Версия ${x.VERSION} · ${navigator.onLine ? 'онлайн' : 'офлайн'} · данных в памяти: ${x.storageUsed}</div>
    <div class="btns"><button class="btn pri" data-act="update">Обновить приложение</button>
    ${x.canInstall ? '<button class="btn" data-act="install">Установить приложение</button>' : ''}
    ${x.standalone ? '<span class="pill">Установлено</span>' : ''}</div></div>

  <div class="card"><b>Данные</b>
    <div class="muted">Экспорт включает только ваши маршруты (без встроенных).</div>
    <div class="btns"><button class="btn" data-act="export">Экспорт JSON</button>
      <button class="btn" data-act="import">Импорт JSON</button>
      <button class="btn bad" data-act="reset">Сбросить всё</button></div></div>`;
}

// ---------- О проекте ----------
export function about(S, r, now, x) {
  return `<h2>О проекте</h2>
  <div class="card"><b>Рейзино Транзит</b> v${x.VERSION}
    <p class="muted">Офлайн-расписание автобусов и электричек Большое Рейзино ↔ Гатчина ↔ Санкт-Петербург. Данные работают без интернета и хранятся
    только на устройстве. Всегда сверяйтесь с перевозчиком — график может измениться.</p></div>

  <div class="card"><b>Как пользоваться</b>
    <ol class="howto">
      <li>Откройте вкладку «Рейсы» — сверху крупно показано, сколько ждать ближайший рейс.</li>
      <li>Меняйте маршрут вверху экрана, переключайте направление, фильтруйте по линии, закрепляйте нужные звёздочкой.</li>
      <li>Электрички добавлены как отдельный маршрут; свои расписания поездов можно добавлять так же, выбрав вид «Электричка».</li>
      <li>В профиле включите оповещения: напоминание придёт за 5 минут до ближайшего рейса.</li>
      <li>Добавьте свои маршруты во вкладке «Маршруты» или импортируйте готовый JSON.</li>
      <li>Установите приложение на телефон: профиль → «Установить приложение». Оно работает офлайн.</li>
    </ol></div>

  <div class="card links"><b>Связь с автором</b>
    <div class="muted">Смольянинов Александр Вячеславович</div>
    <a href="https://vk.com/smolyaninovchef" target="_blank" rel="noopener">VK · smolyaninovchef</a>
    <a href="https://dzen.ru/asv_prod" target="_blank" rel="noopener">Дзен · asv_prod</a>
    <a href="https://t.me/asv_prod" target="_blank" rel="noopener">Telegram · asv_prod</a></div>

  <div class="card links"><b>Источник данных</b>
    <a href="https://rasp.yandex.ru/all-transport/krasnoarmeyskiy-prospekt-ulitsa-nesterova--bolshoe-reyzino" target="_blank" rel="noopener">Яндекс Расписания — автобусы</a>
    <a href="https://rasp.yandex.ru/station/10134" target="_blank" rel="noopener">Яндекс Расписания — станция Гатчинь-Варшавский-Балтийский</a>
    <a href="https://www.rzd.ru/" target="_blank" rel="noopener">РЖД — официальное расписание</a></div>

  <div class="card"><b>Технологии</b>
    <p class="muted">Vanilla JS, PWA (Service Worker + Manifest), без сборки и внешних зависимостей.
    Размещается статически на GitHub Pages. Код открыт, лицензия MIT.</p></div>`;
}
