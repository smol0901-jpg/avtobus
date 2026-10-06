import { SEED } from './data.js';
import { pad } from './time.js';
const K = 'rt.v2';
const def = () => ({ routes: [SEED], s: { theme: 'auto', route: SEED.id, dir: 0, pinned: [], past: false, filter: '', name: '' } });
function load() { try { const x = JSON.parse(localStorage[K]); if (x && x.routes && x.routes.length) return x; } catch (e) {} return def(); }
export let S = load();
export const save = () => { try { localStorage[K] = JSON.stringify(S); } catch (e) {} };
export const route = () => S.routes.find(r => r.id === S.s.route) || S.routes[0];
export function addRoute(r) { S.routes = S.routes.filter(x => x.id !== r.id).concat(r); S.s.route = r.id; S.s.dir = 0; S.s.filter = ''; save(); }
export function delRoute(id) {
  S.routes = S.routes.filter(r => r.id !== id);
  if (!S.routes.length) S.routes = [SEED];
  S.s.route = S.routes[0].id; S.s.dir = 0; save();
}
export function resetAll() { S = def(); save(); }
export function parseLines(txt) {
  const out = [];
  for (const l of txt.split('\n')) {
    const m = l.trim().match(/^(\d{1,2})[:.](\d{2})\s+(.+?)(?:\s+(\d+)\s*мин)?(\s+будни)?$/i);
    if (!m || +m[1] > 23 || +m[2] > 59) continue;
    out.push({ t: pad(+m[1]) + ':' + m[2], r: m[3].trim(), d: +m[4] || 0, w: !!m[5] });
  }
  return out;
}
export function importJSON(txt) {
  const x = JSON.parse(txt), list = Array.isArray(x.routes) ? x.routes : [];
  const ok = list.filter(r => r && r.id && r.name && Array.isArray(r.dirs) && r.dirs.every(d => Array.isArray(d.flights)));
  ok.forEach(r => { S.routes = S.routes.filter(q => q.id !== r.id).concat(r); });
  save(); return ok.length;
}
export const exportJSON = () => JSON.stringify({ app: 'reyzino-transit', routes: S.routes }, null, 1);
