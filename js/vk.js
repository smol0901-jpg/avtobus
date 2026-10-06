// Связь с автором через ВКонтакте.
// Ограничение: статический сайт (GitHub Pages) не может отправить личное сообщение
// без OAuth-авторизации пользователя и сервера-посредника. Поэтому кнопка открывает
// диалог с автором с ЗАРАНЕЕ ВСТАВЛЕННЫМ текстом — пользователю остаётся нажать «Отправить».
export const VK = {
  screenName: 'smolyaninovchef', // страница автора: vk.com/smolyaninovchef
};

// Готовые тексты запросов на обновление расписания
export const MSG_BUS = 'Здравствуйте! Обновите, пожалуйста, расписание автобусов Большое Рейзино — Гатчина (518, 533, 537): данные актуальны на 06.10.2026, нужно зимнее расписание.';
export const MSG_TRAIN = 'Здравствуйте! Обновите, пожалуйста, расписание электричек Гатчина-Варшавская — Балтийский вокзал в приложении Рейзино Транзит.';
export const MSG_BOTH = 'Здравствуйте! Обновите, пожалуйста, расписание автобусов (518/533/537 Большое Рейзино — Гатчина) и электричек Гатчина — Балтийский в приложении Рейзино Транзит.';

// Диалог с предзаполненным сообщением: для страниц вида id<N> используется sel=N,
// для именных (vk.com/name) — ссылка на страницу с msg_text (VK подставит текст в поле).
export function dialogLink(text) {
  const t = encodeURIComponent(text);
  return /^id\d+$/i.test(VK.screenName)
    ? `https://vk.com/im?sel=${VK.screenName.slice(2)}&text=${t}`
    : `https://vk.com/${VK.screenName}?msg_text=${t}`;
}

// Резервная ссылка — просто страница автора.
export function profileLink() {
  return `https://vk.com/${VK.screenName}`;
}

// Копирование текста запроса в буфер (на случай, если ссылка не открылась).
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { return false; }
}

// Открывает диалог VK с готовым текстом.
export function openVkMessage(text) {
  window.open(dialogLink(text), '_blank', 'noopener');
}
