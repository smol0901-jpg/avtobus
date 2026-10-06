// Утилиты времени. Базовая единица — минуты от полуночи (0..1439).
export const DAY = 1440;

export const pad = n => String(n).padStart(2, '0');

export const toMin = s => {
  const [h, m] = String(s).split(':');
  return +h * 60 + +m;
};

export const minOf = d => d.getHours() * 60 + d.getMinutes();

export const weekend = d => d.getDay() === 0 || d.getDay() === 6;

// «07:15» + 20 -> «07:35» (переход через полночь разрешён)
export const addMin = (t, d) => {
  const x = (toMin(t) + d) % DAY;
  return pad(Math.floor(x / 60)) + ':' + pad(x % 60);
};

export function human(m) {
  if (m <= 0) return 'сейчас';
  if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' ч' + (r ? ' ' + r + ' мин' : '');
}

// Русская плюрализация: plural(2, 'минута', 'минуты', 'минут') -> 'минуты'
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return (a > 10 && a < 20) || b === 0 || b > 4 ? many : b === 1 ? one : few;
};

export const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Дата в формате «понедельник, 6 октября»
export const dateLabel = d => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
