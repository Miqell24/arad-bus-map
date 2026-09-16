// Tabliczki odjazdów: data/gtfs → data/out/timetables.json.
//
// Feed ma prawdziwe godziny (arad-feed.mjs odtwarza kursy z rozkładów CTP), więc
// mapa może pokazać przy każdym słupku to, co wisi na nim w mieście: linia,
// kierunek, minuty w siatce godzin, osobno dni robocze, soboty i niedziele.
//
//   { "T091": { "name": "Primărie",
//               "boards": [ { "line": "1", "to": "Făt Frumos",
//                             "L": { "5": [30], "6": [12, 42], … }, "S": {…}, "D": {…} }, … ] }, … }
//
// Ostatni przystanek kursu jest pomijany — to przyjazd, którego BusMan nie
// drukuje i który feed doliczył po tempie kursu; na tabliczce ma być wyłącznie
// to, co opublikował operator. Serwis SD (dni świąteczne) wchodzi do soboty
// i niedzieli, S i D tylko do swojego dnia.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');
const t0 = Date.now();
const log = (m) => console.log(`[timetables ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

function csv(file) {
  const lines = readFileSync(join(GD, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const cells = [];
    let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; continue; }
      if (ch === ',' && !q) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((k, i) => [k, cells[i] ?? '']));
  });
}

const stops = new Map(csv('stops.txt').map((s) => [s.stop_id, s.stop_name]));
const routes = new Map(csv('routes.txt').map((r) => [r.route_id, r.route_short_name]));
const trips = new Map(csv('trips.txt').map((t) => [t.trip_id, t]));
const cal = new Map(csv('calendar.txt').map((c) => [c.service_id, c]));
const DAYS = { L: ['L'], S: ['S'], D: ['D'] };   // dzień tabliczki → serwisy, które w nim jeżdżą
for (const [sid, c] of cal) {
  if (c.saturday === '1' && !DAYS.S.includes(sid)) DAYS.S.push(sid);
  if (c.sunday === '1' && !DAYS.D.includes(sid)) DAYS.D.push(sid);
  if (c.monday === '1' && !DAYS.L.includes(sid)) DAYS.L.push(sid);
}

const st = csv('stop_times.txt');
const byTrip = new Map();
for (const row of st) {
  let a = byTrip.get(row.trip_id);
  if (!a) byTrip.set(row.trip_id, (a = []));
  a.push(row);
}
// stop → "linia|kierunek" → dzień → minuty doby (posortowane, bez powtórzeń)
const boards = new Map();
let rows = 0, skippedLast = 0;
for (const [tripId, a] of byTrip) {
  a.sort((x, y) => Number(x.stop_sequence) - Number(y.stop_sequence));
  const t = trips.get(tripId);
  if (!t) continue;
  const line = routes.get(t.route_id) ?? t.route_id;
  const to = t.trip_headsign || '';
  const days = Object.keys(DAYS).filter((d) => DAYS[d].includes(t.service_id));
  a.forEach((row, i) => {
    if (i === a.length - 1) { skippedLast++; return; }      // przyjazd na koniec kursu
    if (row.timepoint === '0') { skippedLast++; return; }   // czas interpolowany — nie z rozkładu operatora
    const [hh, mm] = row.departure_time.split(':').map(Number);
    let stop = boards.get(row.stop_id);
    if (!stop) boards.set(row.stop_id, (stop = new Map()));
    const key = line + '|' + to;
    let b = stop.get(key);
    if (!b) stop.set(key, (b = { line, to, L: new Set(), S: new Set(), D: new Set() }));
    for (const d of days) b[d].add(hh * 60 + mm);
    rows++;
  });
}

const numSort = (a, b) => {
  const na = parseInt(a, 10), nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
  return a.localeCompare(b);
};
const grid = (set) => {
  const out = {};
  for (const m of [...set].sort((x, y) => x - y)) {
    const h = Math.floor(m / 60);
    (out[h] ??= []).push(m % 60);
  }
  return out;
};
const json = {};
for (const [stopId, m] of boards) {
  json[stopId] = {
    name: stops.get(stopId) ?? stopId,
    boards: [...m.values()].sort((x, y) => numSort(x.line, y.line) || x.to.localeCompare(y.to))
      .map((b) => ({ line: b.line, to: b.to, L: grid(b.L), S: grid(b.S), D: grid(b.D) })),
  };
}
mkdirSync(join(ROOT, 'data/out'), { recursive: true });
writeFileSync(join(ROOT, 'data/out/timetables.json'), JSON.stringify(json), 'utf8');
const nBoards = Object.values(json).reduce((a, s) => a + s.boards.length, 0);
log(`tabliczki: ${Object.keys(json).length} słupków, ${nBoards} tablic linia+kierunek, ${rows} odjazdów ` +
  `(${skippedLast} pozycji pominiętych: przyjazdy na końcach kursów i czasy interpolowane) → data/out/timetables.json`);
