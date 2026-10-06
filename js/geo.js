// Георафики станций и привязка направлений маршрутов к узлам.
// Используется для связки «автобус ↔ электричка»: приложение само определяет,
// в каком направлении движется рейс, и подбирает ближайший поезд/автобус туда же.

export const STATIONS = {
  reyzino: { label: 'Большое Рейзино' },
  varsh:   { label: 'Гатчина-Варшавская' },
  spb:     { label: 'СПб, Балтийский вокзал' }
};

// Какие узлы упоминаются в тексте — в порядке появления.
// «Гатчина» без уточнения считается узлом varsh (Варшавский вокзал — хаб линии).
const NODE_RX = [
  ['spb',     /балт|спб|петербург|питер/i],
  ['varsh',   /варш|гатчин/i],
  ['reyzino', /рейзин|красноармейск|нестеров|терволово|кипень|тайц|ивановк/i]
];

export function nodesIn(text) {
  const s = String(text || '');
  const res = [];
  for (const [node, rx] of NODE_RX) {
    const m = s.match(rx);
    if (m) res.push({ node, at: m.index });
  }
  return res.sort((a, b) => a.at - b.at).map(x => x.node);
}

// Пара узлов направления [откуда, куда]: первый и последний встреченный узел.
export function dirPair(title) {
  const ns = nodesIn(title);
  if (ns.length >= 2 && ns[0] !== ns[ns.length - 1]) return [ns[0], ns[ns.length - 1]];
  return null;
}

// Направление рейса f внутри направления d: пара [откуда, куда] или null.
export function flightPair(d, f) {
  const p = dirPair(d.title) || dirPair(f.r);
  if (p) return p;
  const rn = nodesIn(f.r);
  if (rn.length >= 2 && rn[0] !== rn[rn.length - 1]) return [rn[0], rn[rn.length - 1]];
  return null;
}

export const stationLabel = n => (STATIONS[n] && STATIONS[n].label) || '';
