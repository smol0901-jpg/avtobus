// Мини-библиотека DOM: экранирование, тосты, модальные окна, вибрация.
import { plural } from './time.js';

export const $ = s => document.querySelector(s);

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export const vibrate = p => { try { navigator.vibrate?.(p); } catch (e) {} };

// Модальное окно на <dialog>. resolve(true) при подтверждении, иначе false.
export function confirmBox({ title, text = '', ok = 'ОК', cancel = 'Отмена', danger = false }) {
  return new Promise(resolve => {
    const prev = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg' + (danger ? ' danger' : '');
    dlg.innerHTML = `<form method="dialog" class="dlgbox">
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dlgbtns">
        <button value="no" class="btn">${esc(cancel)}</button>
        <button value="yes" class="btn ${danger ? 'bad pri' : 'pri'}">${esc(ok)}</button>
      </div></form>`;
    document.body.appendChild(dlg);
    const done = () => {
      dlg.close();
      dlg.remove();
      try { prev?.focus(); } catch (e) {}
    };
    dlg.addEventListener('click', e => { if (e.target === dlg) { done(); resolve(false); } });
    dlg.addEventListener('close', () => {
      const yes = dlg.returnValue === 'yes';
      done();
      resolve(yes);
    }, { once: true });
    dlg.showModal();
  });
}

// Подсказки формата расписания для формы добавления маршрута.
export const EXAMPLE_A = '07:00 518 Терволово — Гатчина 6 мин\n07:15 518 Терволово — Гатчина 6 мин будни';

// Пример для электричек (время — прибытие на станцию, минуты в пути необязательны)
export const EXAMPLE_TRAIN = '07:32 6830 Гатчина-Варшавская — СПб-Балтийский 72 мин\n10:20 6842 Гатчина-Варшавская — СПб-Балтийский';

// «5 рейсов», «1 автобус» и т.п.
export const cnt = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
