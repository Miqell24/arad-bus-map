// Kontrola rysunku względem danych — cztery testy, najgorsze miejsca pierwsze.
//
//   1. KSZTAŁT POZA RYSUNKIEM  — punkt kształtu z GTFS-a (co 15 m) dalej niż
//      PROG od narysowanej sieci tej linii: mapa nie idzie po danych.
//   2. RYSUNEK POZA KSZTAŁTEM  — punkt narysowanego przebiegu (paths.geojson,
//      osobno linia i kierunek) dalej niż PROG od kształtu tej linii: objazd,
//      ślepa odnoga, zła równoległa ulica.
//   3. ZAWROTKI                — miejsce, gdzie przebieg zawraca po własnym
//      śladzie (kąt między kolejnymi krokami > 150°): pętelka, kikut, ogonek.
//      Zawrotka na końcu trasy (pętla) nie jest błędem — liczone są tylko
//      te w środku biegu.
//   4. URWANE ODCINKI          — przebieg scalony (route.geojson) krótszy niż
//      MIN_RUN, którego jeden koniec nie dotyka żadnego innego przebiegu.
//
//   node pipeline/shape-check.mjs [prog m = 25]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROG = Number(process.argv[2] ?? 25);
const STEP = 15, MIN_RUN = 45, HAIRPIN_DEG = 150;

const K = Math.PI / 180 * 6371008.8;
const xy = ([lon, lat]) => [lon * K * Math.cos(lat * Math.PI / 180), lat * K];
const ll = ([x, y]) => `${(y / K).toFixed(5)},${(x / (K * Math.cos(y / K * Math.PI / 180))).toFixed(5)}`;
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function segDist(p, a, b) {
  const l2 = d2(a, b);
  if (!l2) return Math.sqrt(d2(p, a));
  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(d2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]));
}
function sample(coords) {
  const out = [];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = xy(coords[i - 1]), b = xy(coords[i]);
    const L = Math.sqrt(d2(a, b));
    let s = carry;
    while (s <= L) { const t = L ? s / L : 0; out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); s += STEP; }
    carry = s - L;
  }
  return out;
}
function index(lines) {
  const cell = 200, g = new Map(), segs = [];
  for (const c of lines) {
    for (let i = 1; i < c.length; i++) {
      const a = xy(c[i - 1]), b = xy(c[i]);
      const id = segs.push([a, b]) - 1;
      for (let x = Math.floor(Math.min(a[0], b[0]) / cell); x <= Math.floor(Math.max(a[0], b[0]) / cell); x++)
        for (let y = Math.floor(Math.min(a[1], b[1]) / cell); y <= Math.floor(Math.max(a[1], b[1]) / cell); y++) {
          const k = x + ',' + y;
          if (!g.has(k)) g.set(k, []);
          g.get(k).push(id);
        }
    }
  }
  return (p) => {
    let best = Infinity;
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++)
      for (const id of g.get(x + ',' + y) ?? []) { const d = segDist(p, segs[id][0], segs[id][1]); if (d < best) best = d; }
    return best;
  };
}
// odcinki próbek poza progiem → [{n, max, centre}]
function offStretches(pts, near) {
  const bad = [];
  let cur = null;
  pts.forEach((p) => {
    const d = near(p);
    if (d > PROG) {
      if (!cur) cur = { n: 0, max: 0, sx: 0, sy: 0 };
      cur.n++; cur.max = Math.max(cur.max, d); cur.sx += p[0]; cur.sy += p[1];
    } else if (cur) { bad.push(cur); cur = null; }
  });
  if (cur) bad.push(cur);
  return bad.map((b) => ({ m: b.n * STEP, max: b.max, at: ll([b.sx / b.n, b.sy / b.n]) }));
}
const gj = (f) => JSON.parse(readFileSync(join(ROOT, 'data/out', f), 'utf8')).features;
const lineOf = (f) => f.properties.line ?? f.properties.lines?.[0];

const stopsAll = gj('stops.geojson');
const stopsOfLine = (l) => stopsAll.filter((s) => (s.properties.arr ?? []).includes(l)).map((s) => xy(s.geometry.coordinates));
const shapes = gj('gtfs-shape.geojson');
const paths = existsSync(join(ROOT, 'data/out/paths.geojson')) ? gj('paths.geojson') : [];
const runs = gj('route.geojson');
const byLineDrawn = new Map();
for (const f of paths) {
  const l = lineOf(f);
  if (!byLineDrawn.has(l)) byLineDrawn.set(l, []);
  byLineDrawn.get(l).push(f.geometry.coordinates);
}
const byLineShape = new Map();
for (const f of shapes) {
  const l = lineOf(f);
  if (!byLineShape.has(l)) byLineShape.set(l, []);
  byLineShape.get(l).push(f.geometry.coordinates);
}
let problems = 0;
const show = (rows, title) => {
  console.log(`\n== ${title} ==`);
  if (!rows.length) { console.log('   nic'); return; }
  for (const r of rows) console.log('   ' + r);
  problems += rows.length;
};

// 1) kształt poza rysunkiem
{
  const rows = [];
  for (const f of shapes) {
    const drawn = byLineDrawn.get(lineOf(f));
    if (!drawn) { rows.push(`${lineOf(f)}/${f.properties.dir}: linia bez przebiegu`); continue; }
    const near = index(drawn);
    for (const b of offStretches(sample(f.geometry.coordinates), near).sort((a, c) => c.m - a.m))
      rows.push(`${lineOf(f)}/${f.properties.dir}: ${b.m} m kształtu ≥${PROG} m od rysunku (max ${b.max.toFixed(0)} m) @ ${b.at}`);
  }
  show(rows.sort((a, b) => Number(b.split(': ')[1]) - Number(a.split(': ')[1])), `1. KSZTAŁT POZA RYSUNKIEM (>${PROG} m)`);
}
// 2) rysunek poza kształtem
{
  const rows = [];
  for (const f of paths) {
    const shp = byLineShape.get(lineOf(f));
    if (!shp) continue;                       // linia bez kształtu (13): nie ma do czego porównać
    const near = index(shp);
    for (const b of offStretches(sample(f.geometry.coordinates), near).sort((a, c) => c.m - a.m))
      rows.push(`${lineOf(f)}/${f.properties.dir}: ${b.m} m rysunku ≥${PROG} m od kształtu (max ${b.max.toFixed(0)} m) @ ${b.at}`);
  }
  show(rows.sort((a, b) => Number(b.split(': ')[1]) - Number(a.split(': ')[1])), `2. RYSUNEK POZA KSZTAŁTEM (>${PROG} m)`);
}
// 3) zawrotki w środku biegu
{
  const rows = [], sharp = [];
  for (const f of paths) {
    const c = f.geometry.coordinates.map(xy);
    const total = c.reduce((a, p, i) => (i ? a + Math.sqrt(d2(p, c[i - 1])) : 0), 0);
    let run = 0;
    for (let i = 1; i < c.length - 1; i++) {
      const a = c[i - 1], b = c[i], e = c[i + 1];
      run += Math.sqrt(d2(a, b));
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [e[0] - b[0], e[1] - b[1]];
      const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2);
      if (n1 < 0.5 || n2 < 0.5) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))) * 180 / Math.PI;
      if (ang < HAIRPIN_DEG) continue;
      if (run < 40 || total - run < 40) continue;   // zawrotka na pętli końcowej
      // koniec dojazdu do przystanku (zatoka, ślepa uliczka) — zawrotka jest tam z natury
      if (stopsOfLine(lineOf(f)).some((s) => Math.hypot(s[0] - b[0], s[1] - b[1]) < 25)) continue;
      // długość ogonka: jak daleko stąd przebieg wraca w pobliże (≤6 m) wcześniejszego punktu
      let back = 0;
      for (let j = i + 1; j < c.length; j++) {
        back += Math.sqrt(d2(c[j], c[j - 1]));
        if (segDist(c[j], c[Math.max(0, i - 3)], c[i - 1]) < 6) break;
      }
      // ostry zakręt, po którym przebieg NIE wraca po swoim śladzie, to
      // zwykłe ostre skrzyżowanie — informacja, nie błąd
      (back <= 150 ? rows : sharp).push(`${lineOf(f)}/${f.properties.dir}: ${back <= 150 ? 'zawrotka' : 'ostry zakręt'} ${ang.toFixed(0)}° @ ${ll(b)}${back <= 150 ? ` (ogonek ~${Math.round(back)} m)` : ''}`);
    }
  }
  show(rows, `3. ZAWROTKI W ŚRODKU BIEGU (kąt > ${HAIRPIN_DEG}°, przebieg wraca po sobie w ≤150 m)`);
  if (sharp.length) { console.log(`
   (ostre zakręty bez powrotu, do wiadomości: ${sharp.length})`); for (const r of sharp) console.log('   ' + r); }
}
// 4) krótkie urwane przebiegi scalone
{
  const ends = [];
  const all = [];
  for (const f of runs) {
    const cs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const c of cs) { if (c.length > 1) { all.push(c); ends.push([xy(c[0]), xy(c[c.length - 1]), c, f.properties]); } }
  }
  const near = index(all);
  const rows = [];
  for (const [a, b, c, p] of ends) {
    const len = c.reduce((s, q, i) => (i ? s + Math.sqrt(d2(xy(q), xy(c[i - 1]))) : 0), 0);
    if (len >= MIN_RUN) continue;
    // czy koniec dotyka innego przebiegu? (odległość < 3 m od czegokolwiek poza sobą — przybliżenie: sprawdzamy sąsiedztwo pomijając własne odcinki)
    const others = index(all.filter((o) => o !== c));
    const loose = [a, b].filter((e) => others(e) > 3).length;
    if (loose) rows.push(`${p.lines ?? p.arr?.join(', ') ?? '?'}: przebieg ${Math.round(len)} m z ${loose} luźnym końcem @ ${ll(a)}`);
  }
  show(rows, `4. KRÓTKIE PRZEBIEGI Z LUŹNYM KOŃCEM (<${MIN_RUN} m)`);
}
console.log(`\nRAZEM: ${problems} miejsc do obejrzenia`);
