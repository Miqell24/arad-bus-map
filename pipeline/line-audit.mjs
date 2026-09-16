#!/usr/bin/env node
// Audyt każdej linii z osobna — to, co widać po włączeniu podglądu jednej
// trasy: ogonki i zawrotki w środku biegu, słupki po złej stronie jezdni,
// słupki poza kolejnością wzdłuż rysunku, słupki daleko od linii.
//
//   node pipeline/line-audit.mjs            wszystkie linie
//   node pipeline/line-audit.mjs 48 60      wybrane
//
// Źródła: data/out/route.geojson (narysowany przebieg kierunku) i data/gtfs
// (kolejność słupków najdłuższego kursu tego kierunku). Ruch prawostronny:
// słupek autobusowy powinien leżeć po PRAWEJ stronie kierunku jazdy; wyjątki
// (pętle uliczne, jezdnie jednokierunkowe, przystanki tramwajowe w osi
// jezdni) trzeba obejrzeć — narzędzie je wymienia, nie ocenia.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = process.argv.slice(2);
const K = 111320;
const xy = ([lon, lat]) => [lon * K * Math.cos(lat * Math.PI / 180), lat * K];
const ll = ([x, y]) => `${(y / K).toFixed(5)},${(x / (K * Math.cos(y / K * Math.PI / 180))).toFixed(5)}`;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const csv = (f) => {
  const [h, ...rows] = readFileSync(join(ROOT, 'data/gtfs', f), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
    .map((l) => { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; });
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
};
const stops = new Map(csv('stops.txt').map((s) => [s.stop_id, { id: s.stop_id, name: s.stop_name, p: xy([+s.stop_lon, +s.stop_lat]) }]));
const routes = new Map(csv('routes.txt').map((r) => [r.route_id, r.route_short_name]));
const trips = csv('trips.txt');
const byTrip = new Map();
for (const r of csv('stop_times.txt')) { if (!byTrip.has(r.trip_id)) byTrip.set(r.trip_id, []); byTrip.get(r.trip_id).push(r); }
for (const a of byTrip.values()) a.sort((x, y) => +x.stop_sequence - +y.stop_sequence);

// najdłuższy wzorzec kierunku (przy remisie: najczęstszy)
const seqOf = (label, dir) => {
  const pats = new Map();
  for (const t of trips) {
    if (routes.get(t.route_id) !== label || t.direction_id !== dir) continue;
    const ids = (byTrip.get(t.trip_id) ?? []).map((r) => r.stop_id);
    const k = ids.join('|');
    if (!pats.has(k)) pats.set(k, { ids, n: 0 });
    pats.get(k).n++;
  }
  return [...pats.values()].sort((a, b) => b.ids.length - a.ids.length || b.n - a.n)[0]?.ids ?? [];
};

// rzut punktu na łamaną: odległość, pozycja wzdłuż, strona (+1 lewa, -1 prawa).
// Słupki rzutuje się po kolei i najpierw szuka miejsca NIE WCZEŚNIEJ niż
// poprzedni (minus 30 m) — na pętlach i odcinkach „tam i z powrotem" (49 do
// Armoniei, pętla 18b) globalnie najbliższy kawałek bywa tym z drugiej
// gałęzi, a wtedy strona i kolejność wychodzą fałszywie źle. Gdy w oknie nie
// ma nic bliżej niż 60 m, liczy się rzut globalny.
const project = (line, cum, p, minAlong = -Infinity) => {
  let best = { d: Infinity }, ahead = { d: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const L2 = vx * vx + vy * vy; if (!L2) continue;
    let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2; t = Math.max(0, Math.min(1, t));
    const q = [a[0] + t * vx, a[1] + t * vy];
    const d = dist(p, q);
    const along = cum[i - 1] + t * Math.sqrt(L2);
    const cross = vx * (p[1] - a[1]) - vy * (p[0] - a[0]);
    const cand = { d, along, side: cross > 0 ? 1 : -1 };
    if (d < best.d) best = cand;
    // w oknie: najbliższe miejsce, ale z lekką karą za odległość W PRZÓD
    // (1 m na 50 m) — ulica przejeżdżana dwa razy (Uzina Electrică na pętli
    // 7A) ma słupek przy obu przejazdach i kolejność przystanków mówi, który
    // przejazd jest ten; sama „najwcześniejsza pozycja" brała za to koniec
    // poprzedniego odcinka 55 m przed słupkiem
    const score = d + 0.02 * Math.max(0, along - Math.max(minAlong, 0));
    if (along >= minAlong && d <= 60 && score < (ahead.score ?? Infinity)) ahead = { ...cand, score };
  }
  return ahead.d <= 60 ? ahead : best;
};

// zawrotki: kąt > 150° i przebieg wracający po sobie (≤ 8 m) — długość powrotu
const reversals = (line, cum) => {
  const out = [];
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1], b = line[i], c = line[i + 1];
    const ab = dist(a, b), bc = dist(b, c); if (ab < 0.5 || bc < 0.5) continue;
    const cos = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (ab * bc);
    if (cos < 0.866) continue;                       // kąt między ramionami < 30° → zawrotka
    // jak daleko obie gałęzie biegną razem
    let back = 0, f = i, g = i, step = 5;
    const at = (k, s) => { // punkt s metrów od wierzchołka k w stronę (s<0: wstecz, s>0: naprzód)
      let rem = Math.abs(s), j = k;
      while (rem > 0) {
        const n = s < 0 ? j - 1 : j + 1; if (n < 0 || n >= line.length) return null;
        const L = dist(line[j], line[n]);
        if (L >= rem) { const t = rem / L; return [line[j][0] + (line[n][0] - line[j][0]) * t, line[j][1] + (line[n][1] - line[j][1]) * t]; }
        rem -= L; j = n;
      }
      return line[j];
    };
    for (let s = step; s < 1500; s += step) {
      const p = at(i, -s), q = at(i, s);
      if (!p || !q || dist(p, q) > 8) break;
      back = s;
    }
    if (back >= 15) out.push({ i, p: b, back });
  }
  // sąsiednie zawrotki tej samej gałęzi zgłaszane raz
  const merged = [];
  for (const r of out) { const m = merged[merged.length - 1]; if (m && dist(m.p, r.p) < 30) { if (r.back > m.back) Object.assign(m, r); } else merged.push({ ...r }); }
  return merged;
};

const route = JSON.parse(readFileSync(join(ROOT, 'data/out/route.geojson'), 'utf8')).features;
let total = 0;
for (const f of route) {
  const { line: label, dir, headsign, mode } = f.properties;
  if (ONLY.length && !ONLY.includes(label)) continue;
  const line = f.geometry.coordinates.map(xy);
  const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + dist(line[i - 1], line[i]));
  const ids = seqOf(label, dir);
  const rows = [];
  // rzuty po kolei: każdy słupek szuka miejsca od poprzedniego w przód
  const proj = [];
  let lastAlong = -Infinity;
  for (const id of ids) {
    const s = stops.get(id);
    if (!s) { proj.push(null); continue; }
    const q = { s, ...project(line, cum, s.p, lastAlong - 30) };
    if (q.d <= 60) lastAlong = Math.max(lastAlong, q.along);
    proj.push(q);
  }
  // 1) daleko od rysunku, 2) kolejność, 3) strona
  let prevAlong = -1e9;
  proj.forEach((q, k) => {
    if (!q) return;
    const tag = `${q.s.id} ${q.s.name}`;
    if (q.d > 30) rows.push(`   słupek ${tag}: ${Math.round(q.d)} m od rysunku @ ${ll(q.s.p)}`);
    if (q.along < prevAlong - 30) rows.push(`   słupek ${tag}: poza kolejnością wzdłuż rysunku (${Math.round(q.along)} m po ${Math.round(prevAlong)} m) @ ${ll(q.s.p)}`);
    prevAlong = Math.max(prevAlong, q.along);
    const terminal = k === 0 || k === proj.length - 1;
    if (mode !== 'tram' && q.side > 0 && q.d > 4 && q.d <= 30 && !terminal) rows.push(`   słupek ${tag}: po LEWEJ stronie kierunku jazdy (${Math.round(q.d)} m) @ ${ll(q.s.p)}`);
  });
  // 4) zawrotki w środku biegu
  const stopPts = proj.filter(Boolean).map((q) => q.s);
  const ends = [line[0], line[line.length - 1]];
  for (const r of reversals(line, cum)) {
    const nearEnd = ends.some((e) => dist(e, r.p) < 120);
    const st = stopPts.find((s) => dist(s.p, r.p) < 30);
    const kind = nearEnd ? 'pętla końcowa' : st ? `zawrotka przy przystanku ${st.name}` : 'OGONEK';
    if (nearEnd) continue;
    rows.push(`   ${kind}: ${r.back} m tam i z powrotem @ ${ll(r.p)}`);
  }
  console.log(`${label}/${dir} → ${headsign} (${ids.length} słupków, ${(cum[cum.length - 1] / 1000).toFixed(2)} km)${rows.length ? '' : ' — czysto'}`);
  for (const r of rows) console.log(r);
  total += rows.length;
}
console.log(`\nRAZEM: ${total} uwag`);
