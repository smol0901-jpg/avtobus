export const pad = n => String(n).padStart(2, '0');
export const toMin = s => { const [h, m] = s.split(':'); return +h * 60 + +m; };
export const minOf = d => d.getHours() * 60 + d.getMinutes();
export const weekend = d => d.getDay() === 0 || d.getDay() === 6;
export const addMin = (t, d) => { const x = (toMin(t) + d) % 1440; return pad(Math.floor(x / 60)) + ':' + pad(x % 60); };
export function human(m) {
  if (m <= 0) return 'сейчас';
  if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' ч' + (r ? ' ' + r + ' мин' : '');
}
export const DAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
