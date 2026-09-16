// Słupki: czy każdy kierunek ma własny słupek tam, gdzie Anexa daje dwa, i czy
// żaden nie stoi daleko od narysowanej linii.   node pipeline/stops-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const csv = (f) => {
  const L = readFileSync(join(ROOT, 'data/gtfs', f), 'utf8').split(/\r?\n/).filter(Boolean);
  const h = L[0].split(',');
  return L.slice(1).map((l) => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { c.push(cur); cur = ''; continue; } cur += ch; } c.push(cur); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ''])); });
};
const baseOf = (s) => s.toLowerCase().replace(/\s+\d+$/, '');
const stops = csv('stops.txt');
const byName = new Map();
for (const s of stops) { const k = baseOf(s.stop_name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s.stop_id); }
const trips = csv('trips.txt'), st = csv('stop_times.txt');
const tripDir = new Map(trips.map((t) => [t.trip_id, t.route_id + '|' + t.direction_id]));
const used = new Map();   // route|dir → Map(name → Set(pole))
for (const r of st) {
  const k = tripDir.get(r.trip_id); if (!k) continue;
  const s = stops.find((x) => x.stop_id === r.stop_id); if (!s) continue;
  if (!used.has(k)) used.set(k, new Map());
  const m = used.get(k); const n = baseOf(s.stop_name);
  if (!m.has(n)) m.set(n, new Set()); m.get(n).add(s.stop_id);
}
console.log('== ten sam słupek w obu kierunkach, choć Anexa ma dwa ==');
let n = 0;
const routes = [...new Set([...used.keys()].map((k) => k.split('|')[0]))];
for (const r of routes) {
  const d0 = used.get(r + '|0'), d1 = used.get(r + '|1');
  if (!d0 || !d1) continue;
  // pętle (pierwszy/ostatni przystanek kierunku) wolno dzielić — autobus stoi tam na jednym słupku
  const ends = new Set();
  for (const t of trips) { const a = st.filter((x) => x.trip_id === t.trip_id); if (!a.length) continue; a.sort((x, y) => +x.stop_sequence - +y.stop_sequence); for (const e of [a[0], a[a.length - 1]]) { const sname = stops.find((x) => x.stop_id === e.stop_id); if (sname) ends.add(t.route_id + '|' + baseOf(sname.stop_name)); } }
  for (const [name, p0] of d0) {
    const p1 = d1.get(name); if (!p1) continue;
    if (ends.has(r + '|' + name)) continue;
    const shared = [...p0].filter((x) => p1.has(x));
    if (shared.length && (byName.get(name) ?? []).length >= 2 && p0.size === 1 && p1.size === 1) { console.log(`   ${r.replace(/^L/, '')} ${name}: oba kierunki na ${shared.join(',')} (dostępne: ${byName.get(name).join(',')})`); n++; }
  }
}
if (!n) console.log('   nic');
console.log('\n== słupki >30 m od narysowanej linii (stops.geojson snapDist) ==');
const gj = JSON.parse(readFileSync(join(ROOT, 'data/out/stops.geojson'), 'utf8')).features;
const far = gj.filter((f) => (f.properties.snapDist ?? 0) > 30).sort((a, b) => b.properties.snapDist - a.properties.snapDist);
for (const f of far) console.log(`   ${f.properties.sid} ${f.properties.name} [${f.properties.lines}] ${f.properties.snapDist} m @ ${f.geometry.coordinates[1].toFixed(5)},${f.geometry.coordinates[0].toFixed(5)}`);
if (!far.length) console.log('   nic');
console.log(`\nsłupków w feedzie: ${stops.length}, na mapie: ${gj.length}`);
