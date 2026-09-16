// Składa PEŁNY GTFS Aradu z trzech źródeł leżących w data/src.
//
// 1. arkusze zamawiającego (data/src/*.xlsx) — szkielet sieci:
//      Anexa 17  = 323 słupki z nazwą, adresem, kierunkiem i współrzędnymi
//                  (tramwaj miejski 126, tramwaj podmiejski 21, autobus 176);
//      TRASEE URBANE = listy przystanków 25 linii miejskich, kolumna na linię,
//                  oba kierunki jeden pod drugim.
// 2. rozkłady CTP Arad (data/src/programe, eksport BusMana) — godziny: dla
//    każdej linii, kierunku i przystanku siatka „godzina → minuty" osobno dla
//    dni roboczych, sobót, niedziel i świąt, z literowymi odsyłaczami kursów
//    skróconych („A - Spre: Piata U.T.A."). Listy przystanków w tych rozkładach
//    zgadzają się z arkuszem co do sztuki — arkusz jest przepisem z tego samego
//    źródła, więc jedno weryfikuje drugie.
// 3. planner pasażerski CTP na platformie Telelink City (data/src/telelink) —
//    współrzędne słupków, których w Anexie nie ma (linia 52, Selgros, La Cocoș,
//    Via Carmina…), cztery ucięte na skanie długości geograficzne oraz
//    POLILINIE wzorców, czyli shapes.txt.
//
// Kursy są odtwarzane z siatek: odjazd z pierwszego przystanku jest ścigany
// wzdłuż trasy (najbliższy nieskonsumowany późniejszy odjazd na kolejnym
// słupku), więc trips.txt/stop_times.txt zawierają prawdziwe godziny operatora,
// a nie częstotliwości. Jedyna liczba, której nie ma w źródłach, to godzina
// przyjazdu na pętlę — BusMan nie drukuje rozkładu przystanku końcowego, więc
// dolicza się tam czas przejazdu ostatniego odcinka po tempie danego kursu.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readXlsx, readDocxTables } from './lib/xlsx.mjs';

import { readFileSync as readFileSyncOsm } from 'node:fs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data/src');
const GD = join(ROOT, 'data/gtfs');

const t0 = Date.now();
const log = (m) => console.log(`[feed ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const warns = [];
const warn = (m) => { warns.push(m); console.log(`[feed ${((Date.now() - t0) / 1000).toFixed(1)}s] UWAGA: ${m}`); };

const AGENCY_ID = 'CTPARAD';
const AGENCY_NAME = 'Compania de Transport Public Arad';
const AGENCY_URL = 'https://ctparad.ro';
const MAXHOP = 32;          // minut — najdłuższy sensowny przeskok między kolejnymi słupkami
const SAME_POLE = 150;      // m — do tylu metrów słupek plannera i Anexy to ten sam słupek

// ---------------------------------------------------------------- narzędzia
const q = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = (header, rows) => header.join(',') + '\n' + rows.map((r) => r.map(q).join(',')).join('\n') + '\n';
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const norm = (s) => clean(s).toLowerCase()
  .replace(/[șşŝ]/g, 's').replace(/[țţ]/g, 't').replace(/[ăâ]/g, 'a').replace(/î/g, 'i')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\./g, '').replace(/[-_,`'’]/g, ' ').replace(/\s+/g, ' ').trim();
// nazwa bez końcowego numeru słupka: „Piața U.T.A. 3" → „piata uta"
const baseOf = (s) => norm(s).replace(/\s+(\d+|i{1,3}|iv|v)$/, '').trim();

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function dist(a, b) {
  const p1 = rad(a[0]), p2 = rad(b[0]);
  const dp = p2 - p1, dl = rad(b[1] - a[1]);
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;

// polilinia Google, precyzja 5 (planner Telelinku)
function decodePolyline(str) {
  const pts = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    let shift = 0, result = 0, b;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push([lat / 1e5, lon / 1e5]);
  }
  return pts;
}

// ------------------------------------------------- 1) Anexa 17: słupki
// Arkusz „Info" sam ostrzega, że w dwóch wierszach współrzędne wyglądają na
// zamienione — i tak jest: „UM 2" dostało punkt w Micălaca (czyli Universitate),
// a „Universitate 1" punkt na Calea Aurel Vlaicu przy jednostce wojskowej.
// Planner potwierdza obie prawidłowe pozycje, więc wiersze wracają na miejsce.
// Ta sama pomyłka, tyle że w arkuszu nieodnotowana: „RAR" i „Piața Auto" mają
// wpisane nawzajem swoje punkty. Widać to po samej kolejności linii 1b
// (Băile Termale → RAR → UM → Piața Auto → Platforma Vest biegnie na zachód,
// a ze współrzędnymi z arkusza skakałaby w tę i z powrotem); planner stawia
// oba słupki dokładnie odwrotnie niż arkusz.
const SWAP = [['UM 2', 'Universitate 1'], ['RAR 1', 'Piața Auto 1'], ['RAR 2', 'Piața Auto 2']];
const SHEETS = [['Tramwaj miejski', 'T', 'tram'], ['Tramwaj podmiejski', 'S', 'tram-sub'], ['Autobus miejski', 'B', 'bus']];
const anexa = readXlsx(join(SRC, 'anexa17-statii.xlsx'));
const poles = [];
for (const [sheet, pfx, kind] of SHEETS) {
  const rows = anexa[sheet];
  if (!rows) throw new Error(`brak arkusza „${sheet}" w anexa17-statii.xlsx`);
  for (const r of rows.slice(4)) {
    const [nr, name, addr, sens, lat, lon] = r;
    if (!clean(name)) continue;
    poles.push({
      id: pfx + String(nr ?? poles.length).padStart(3, '0'), name: clean(name), addr: clean(addr),
      sens: clean(sens), kind, lat: typeof lat === 'number' ? lat : null, lon: typeof lon === 'number' ? lon : null,
      src: 'anexa17',
    });
  }
}
for (const [a, b] of SWAP) {
  const pa = poles.find((p) => p.name === a), pb = poles.find((p) => p.name === b);
  if (!pa || !pb) continue;
  [pa.lat, pb.lat] = [pb.lat, pa.lat];
  [pa.lon, pb.lon] = [pb.lon, pa.lon];
  pa.src = pb.src = 'anexa17 (współrzędne odwrócone — patrz komentarz przy SWAP)';
  log(`Anexa 17: „${a}" i „${b}" mają w skanie zamienione współrzędne — przywrócone`);
}
log(`Anexa 17: ${poles.length} słupków (${SHEETS.map(([, , k]) => `${k} ${poles.filter((p) => p.kind === k).length}`).join(', ')})`);

// Czwarty plik od zamawiającego: „coordonate GPS.docx" — cztery słupki, którym
// skan uciął długość geograficzną, tym razem odczytane z oryginału. To dane
// zamawiającego, więc mają pierwszeństwo przed dopełnieniem z plannera niżej.
{
  const f = join(SRC, 'coordonate-gps.docx');
  let n = 0;
  if (existsSync(f)) {
    for (const row of readDocxTables(f).flat()) {
      const [name, addr, sens, lat, lon] = row;
      const la = Number(String(lat ?? '').replace(',', '.')), lo = Number(String(lon ?? '').replace(',', '.'));
      if (!clean(name) || !Number.isFinite(la) || !Number.isFinite(lo)) continue;
      const p = poles.find((x) => x.name === clean(name) && (x.sens === clean(sens) || !clean(sens)) && (x.lat === null || x.lon === null))
        ?? poles.find((x) => x.name === clean(name) && x.addr === clean(addr));
      if (!p) { warn(`coordonate GPS.docx: nie ma w Anexie słupka „${name}" (${sens})`); continue; }
      p.lat = la; p.lon = lo; p.src = 'anexa17 + coordonate GPS.docx'; n++;
    }
  }
  log(`coordonate GPS.docx: ${n} współrzędne uzupełnione z pliku zamawiającego`);
}

// Trzy przystanki rozkładów nie występują ani w Anexie, ani w plannerze.
// Posadzone po geometrii OSM (Overpass, 16.09.2026) i opisane w README.
// Nazwa kanoniczna przystanku: bez numeru słupka i po aliasach. Autobusowy
// „U.T.A." i tramwajowa „Piața U.T.A." to jedno miejsce — rozkłady autobusów
// 19/46/49b/60 piszą „Piata U.T.A.", a stają na słupku „U.T.A." z arkusza
// autobusowego; planner mówi o nim „UTA".
const ALIAS = new Map(Object.entries({
  // „Indagrara" to dawna nazwa pary słupków, którą Anexa 17 nazywa już „Galleria 1/2"
  // (OSM nadal ma tam węzeł Indagrara) — para przy rondzie to „Galleria 3/4"
  indagrara: 'galleria', 'piata obor': 'piata obor fac', dn7: 'dn 7', 'gara a nou': 'gara aradul nou',
  'mihai eminescu': 'eminescu', atrium1: 'atrium', sanpaulo: 'cartier san paolo',
  'campia turzii': 'c turzii', 'anton pan': 'anton pann', 'renasterii 52': 'renasterii',
  uta: 'piata uta', caraiman: 'caraimanul',
}));
const canon = (name) => { const b = baseOf(name); return ALIAS.get(b) ?? b; };
const centroid = (base) => {
  const ps = poles.filter((p) => canon(p.name) === base && p.lat !== null && p.lon !== null);
  return ps.length ? [ps.reduce((a, p) => a + p.lat, 0) / ps.length, ps.reduce((a, p) => a + p.lon, 0) / ps.length] : null;
};
// Vezuviului leży w rozkładzie 31 między Râșnov a Rândunicii; środek ulicy
// Vezuviu z OSM wypadał 200 m od trasy, więc słupek staje w połowie drogi
// między sąsiadami — na tej ulicy, którą autobus naprawdę jedzie
const vez = (() => { const a = centroid('rasnov'), b = centroid('randunicii'); return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : [46.19860, 21.32550]; })();
const EXTRA = [
  { id: 'X001', name: 'Vezuviului', addr: 'str. Vezuviu', why: 'w połowie drogi między Râșnov a Rândunicii (linia 31)', lat: vez[0], lon: vez[1] },
  { id: 'X002', name: 'Calea Timișorii', addr: 'Calea Timișorii', why: 'środek Calea Timișorii w OSM (linia 49 między Caraiman a Ogorului)', lat: 46.14816, lon: 21.32145 },
  { id: 'X003', name: 'Horia', addr: 'Horia, jud. Arad', why: 'węzeł place=village Horia w OSM (pętla linii 13)', lat: 46.20847, lon: 21.46285 },
];
for (const e of EXTRA) poles.push({ ...e, sens: '', kind: 'osm', src: 'osm' });

// ------------------------------------------------- 2) planner Telelink
const tlStops = JSON.parse(readFileSync(join(SRC, 'telelink/stops.json'), 'utf8'));
const tlRoutes = JSON.parse(readFileSync(join(SRC, 'telelink/routes.json'), 'utf8'));
// pisownia z Anexy dla słupków, których Anexa nie ma (planner pisze bez diakrytyków)
const NAME_FIX = new Map(Object.entries({
  'Anton Pan': 'Anton Pann', Sanpaolo: 'Cartier San Paolo', 'Manastirea Gal': 'Mănăstire Gai',
  'Sanicolau Mic': 'Sânicolaul Mic', 'Gradina Postei': 'Grădina Poștei', Razboieni: 'Războieni',
  Visinului: 'Vișinului', Papadiei: 'Păpădiei', 'I.B. Deleanu': 'Budai Deleanu', Vantului1: 'Vântului',
  Bujac1: 'Bujac', 'La Cocos': 'La Cocoș', Marului: 'Mărului', 'Gara Aradului Nou': 'Gara Aradul Nou',
  Santoma: 'Șântoma', UTA: 'U.T.A.', 'Profi Micalaca': 'Profi Micălaca', Euromedica: 'Euromedic',
  Calarasilor: 'Călărașilor', Flacara: 'Flacăra', Randunicii: 'Rândunicii', Rasnov: 'Râșnov',
  'Banu Maracine': 'Banu Mărăcine', 'Simion Barnutiu': 'Simion Bărnuțiu', 'Piata Romana': 'Piața Romană',
  Constitutiei: 'Constituției', 'Vama Gradiste': 'Vama Grădiște', 'Vama Micalaca': 'Vama Micălaca',
  'Uzina Electrica': 'Uzina Electrică', Gradinita: 'Grădinița', Pasunii: 'Pășunii', Miorita: 'Miorița',
  Renasterii: 'Renașterii', 'Fat Frumos': 'Făt Frumos', Crisan: 'Crișan', 'Baile Termale': 'Băile Termale',
  'Andrei Saguna': 'Andrei Șaguna', Confectii: 'Confecții', Brancoveanu: 'Brâncoveanu', Brancusi: 'Brâncuși',
  'Ana Ipatescu': 'Ana Ipătescu', 'Biserica Sarbeasca': 'Biserica Sârbească', Hodos: 'Hodoș',
  'Faleza Sud': 'Faleză Sud', Scoala: 'Școala', Caraimanul: 'Caraimanul', Mandruloc: 'Mândruloc',
  Sambateni: 'Sâmbăteni', 'Aurel Crisan': 'Aurel Crișan', 'Ion Ratiu': 'Ion Rațiu',
}));
const fixName = (n) => {
  const c = clean(n);
  const m = /^(.*?)\s*(\d+)$/.exec(c);
  if (m && NAME_FIX.has(m[1])) return `${NAME_FIX.get(m[1])} ${m[2]}`;
  return NAME_FIX.get(c) ?? c.replace(/^Piata UTA (\d)$/, 'Piața U.T.A. $1').replace(/^Primariei (\d)$/, 'Primărie $1');
};

const byBase = new Map();
const indexPole = (p) => {
  const k = canon(p.name);
  if (!byBase.has(k)) byBase.set(k, []);
  byBase.get(k).push(p);
};
poles.forEach(indexPole);

const tlToPole = new Map();
const claimed = new Set();     // słupki Anexy już przypisane do słupka plannera
let added = 0, fixedCoord = 0;
const farApart = [];
for (const t of tlStops) {
  const name = fixName(t.name);
  const cands = byBase.get(canon(name)) ?? [];
  // pełna nazwa przed kanoniczną: „Electrometal 1" plannera to tramwajowy
  // T045, a nie stojący 30 m dalej autobusowy „Electrometal"
  const exact = cands.filter((c) => c.name === name && c.lat !== null && c.lon !== null);
  const placed = exact.length ? exact : cands.filter((c) => c.lat !== null && c.lon !== null);
  // najbliższy wolny słupek; zajęty tylko wtedy, gdy wolnego nie ma w zasięgu
  // (Gorunului 1 i 2 mają w Anexie te same współrzędne — bez tego oba
  // kierunki plannera trafiałyby na Gorunului 1)
  let best = null, bestD = Infinity;
  for (const c of placed) {
    const d = dist([t.latitude, t.longitude], [c.lat, c.lon]) + (claimed.has(c) ? 40 : 0);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) bestD -= claimed.has(best) ? 40 : 0;
  // słupek z Anexy, któremu skan uciął długość geograficzną — planner ją zna
  const blank = cands.find((c) => c.lat === null || c.lon === null);
  if (blank && (!best || bestD > SAME_POLE)) {
    blank.lat = t.latitude; blank.lon = t.longitude; blank.src = 'anexa17 + współrzędne z plannera';
    tlToPole.set(t.id, blank); fixedCoord++;
    continue;
  }
  if (best && bestD <= SAME_POLE) {
    tlToPole.set(t.id, best); claimed.add(best);
    if (bestD > 60) farApart.push([Math.round(bestD), t.name, best.name]);
    continue;
  }
  const p = { id: 'P' + t.id, name, addr: '', sens: '', kind: 'planner', lat: t.latitude, lon: t.longitude, src: 'planner CTP' };
  poles.push(p); indexPole(p); tlToPole.set(t.id, p); added++;
}
if (farApart.length) {
  farApart.sort((a, b) => b[0] - a[0]);
  warn(`${farApart.length} słupków stoi w Anexie i w plannerze w innym miejscu (>60 m), najdalsze: ` +
    farApart.slice(0, 5).map(([d, a, b]) => `${a}/${b} ${d} m`).join(', '));
}
// Trzecia klasa błędów skanu: przekręcona JEDNA cyfra współrzędnej. Jeżeli w
// miejscu wpisanym w Anexie planner nie ma przystanku tej nazwy, ma go za to
// równo o 0,01 stopnia dalej (≈1 km) przy niezmienionej drugiej współrzędnej,
// to przepisujący pomylił się o jedną pozycję dziesiętną — „Primărie 2" ma
// 46.16679 zamiast 46.17679 i ląduje na Piaței Romane, „Simion Bărnuțiu"
// 21.32008 zamiast 21.31008. Warunek jednej cyfry jest istotny: bez niego
// reguła ruszyłaby też słupki Sâmbăteni, które po prostu stoją przy DN7 gdzie
// indziej niż zatrzymuje się dzisiejszy autobus.
// Dowolna pozycja dziesiętna: podmiana jednej cyfry szerokości ALBO długości
// ma sprowadzić słupek na ≤40 m od słupka tej nazwy w plannerze, przy drugiej
// współrzędnej nietkniętej. „Primărie 2" 46.16679→46.17679, „Simion Bărnuțiu"
// 21.32008→21.31008, „Aris 1" 21.30035→21.30335 (arkusz stawiał go 232 m od
// jego własnego adresu Cocorilor 48, przy którym stoi autobusowy słupek Aris).
const oneDigitFix = (v, target) => {
  const str = v.toFixed(5), dot = str.indexOf('.');
  let best = null;
  for (let k = dot + 1; k < str.length; k++) for (let d = 0; d <= 9; d++) {
    if (str[k] === String(d)) continue;
    const cand = +(str.slice(0, k) + d + str.slice(k + 1));
    if (best === null || Math.abs(cand - target) < Math.abs(best - target)) best = cand;
  }
  return best;
};
const addrKey = (a) => norm(a).replace(/\s+/g, '');   // „nr.48" i „nr. 48" to ten sam adres
for (const p of poles.filter((x) => x.src.startsWith('anexa17') && x.lat !== null && x.lon !== null)) {
  const twins = poles.filter((o) => o !== p && baseOf(o.name) === baseOf(p.name) && o.lat !== null && o.lon !== null);
  // świadkowie: (a) słupek plannera tej nazwy, którego nie zajmuje żaden bliźniak
  // z Anexy (≤15 m), (b) słupek Anexy tej nazwy pod TYM SAMYM adresem
  const witnesses = [];
  const nearestSame = Math.min(Infinity, ...tlStops
    .filter((t) => baseOf(fixName(t.name)) === baseOf(p.name))
    .map((t) => dist([p.lat, p.lon], [t.latitude, t.longitude])));
  if (nearestSame > 100) {                              // planner nie potwierdza tego punktu
    for (const t of tlStops.filter((t) => clean(fixName(t.name)) === p.name)) {
      const free = twins.length ? Math.min(...twins.map((o) => dist([o.lat, o.lon], [t.latitude, t.longitude]))) : Infinity;
      if (free > 15) witnesses.push({ lat: t.latitude, lon: t.longitude, why: 'wg plannera', snap: true });
    }
  }
  for (const o of twins) {
    if (p.addr && o.addr && addrKey(p.addr) === addrKey(o.addr) && dist([p.lat, p.lon], [o.lat, o.lon]) > 100) {
      witnesses.push({ lat: o.lat, lon: o.lon, why: `wg słupka „${o.name}" pod tym samym adresem`, snap: false });
    }
  }
  if (!witnesses.length) continue;
  let hit = null;
  for (const w of witnesses) {
    for (const c of [[oneDigitFix(p.lat, w.lat), p.lon], [p.lat, oneDigitFix(p.lon, w.lon)]]) {
      const d = dist(c, [w.lat, w.lon]);
      if (d <= 60 && (!hit || d < hit.d)) hit = { d, c, w };
    }
  }
  if (!hit) {
    const w = witnesses[0];
    warn(`„${p.name}" stoi w Anexie ${Math.round(dist([p.lat, p.lon], [w.lat, w.lon]))} m od słupka tej nazwy ${w.why} — zostawiam punkt z arkusza`);
    continue;
  }
  const to = hit.w.snap ? [hit.w.lat, hit.w.lon] : hit.c;
  warn(`„${p.name}": w arkuszu przekręcona jedna cyfra (${p.lat.toFixed(5)},${p.lon.toFixed(5)} → ${to[0].toFixed(5)},${to[1].toFixed(5)}) — poprawione ${hit.w.why}`);
  p.lat = to[0]; p.lon = to[1]; p.src = `anexa17 (jedna cyfra poprawiona ${hit.w.why})`;
}

// Czwarta klasa błędów skanu: punkt leży przy INNEJ ulicy niż adres słupka.
// „Caraiman, Calea Timișorii nr.38" stoi w arkuszu 100 m na zachód od Calea
// Timișorii, przy Constituției; planner ma oba słupki Caraiman na samej Calea
// Timișorii. Słupek autobusowy: gdy planner ma WOLNY słupek tej nazwy (żaden
// inny słupek Anexy tej nazwy bliżej niż 20 m — inaczej Liviu Rebreanu lądował
// na bliźniaku B091, a Podgoria B110 na tramwajowym T087) do 200 m przy ulicy
// z adresu, a punkt z arkusza przy niej nie leży — punkt z plannera. Słupek
// tramwajowy: punkt z arkusza dalej niż 40 m od toru, słupek plannera na torze
// (Electrometal 1 47 m, Fortuna 2 45 m, Galleria 4 62 m od toru; Aris 1 232 m
// od własnego adresu). Sâmbăteni (adres „DN 7", punkt na DN 7) zostają.
const streetCore = (x) => norm(x).replace(/\b(str|strada|calea|b dul|bdul|bulevardul|bd|piata|p ta|aleea|splaiul|soseaua|drumul)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const addrStreet = (addr) => streetCore(String(addr ?? '').split(/,|\bnr\b|\bbl\b|colt|vis-a-vis|langa|\bfn\b|\bsc\b/i)[0]);
const sameStreet = (a, b) => a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
const pointGrid = (file, keep) => {
  try {
    const j = JSON.parse(readFileSyncOsm(join(ROOT, file), 'utf8'));
    const grid = new Map();
    const key = (la, lo) => `${Math.floor(la * 1000)}:${Math.floor(lo * 1000)}`;
    const put = (la, lo, nm) => { const k = key(la, lo); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([la, lo, nm]); };
    for (const e of j.elements) {
      if (e.type !== 'way' || !e.geometry || !keep(e.tags ?? {})) continue;
      const nm = streetCore(e.tags?.name ?? '');
      for (let k = 0; k < e.geometry.length; k++) {
        const g = e.geometry[k]; put(g.lat, g.lon, nm);
        if (!k) continue;
        const h = e.geometry[k - 1], L = dist([h.lat, h.lon], [g.lat, g.lon]), n = Math.floor(L / 20);
        for (let q = 1; q < n; q++) { const t = q / n; put(h.lat + (g.lat - h.lat) * t, h.lon + (g.lon - h.lon) * t, nm); }
      }
    }
    return {
      nearest(lat, lon, r) {
        let best = null; const la0 = Math.floor(lat * 1000), lo0 = Math.floor(lon * 1000);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of grid.get(`${la0 + a}:${lo0 + b}`) ?? []) {
          const d = dist([lat, lon], [q[0], q[1]]);
          if (d <= r && (!best || d < best.d)) best = { d, name: q[2] };
        }
        return best;
      },
    };
  } catch (e) { warn(`${file} do kontroli położenia słupków niedostępny: ${e.message}`); return null; }
};
const osmRoads = pointGrid('data/osm/arad.json', (t) => t.highway && t.name);
const osmRails = pointGrid('data/osm/arad-rail.json', (t) => t.railway === 'tram' || t.railway === 'light_rail');
if (osmRoads && osmRails) {
  const claimedTl = new Set();
  let moved = 0;
  for (const p of poles.filter((x) => x.src.startsWith('anexa17') && x.lat !== null && x.lon !== null)) {
    const tram = p.kind === 'tram' || p.kind === 'tram-sub';
    let reason = null;
    if (tram) {
      const rail = osmRails.nearest(p.lat, p.lon, 40);
      if (rail) continue;                                   // słupek stoi przy torze
      reason = 'punkt z arkusza dalej niż 40 m od toru';
    } else {
      const want = addrStreet(p.addr);
      if (want.length < 4) continue;
      const here = osmRoads.nearest(p.lat, p.lon, 60);
      if (here && sameStreet(here.name, want)) continue;    // adres zgadza się z ulicą przy punkcie
      reason = `adres „${p.addr}", a punkt z arkusza leży przy ${here ? `„${here.name}"` : 'żadnej nazwanej ulicy'}`;
    }
    const others = poles.filter((o) => o !== p && baseOf(o.name) === baseOf(p.name) && o.lat !== null && o.lon !== null);
    const cands = tlStops
      .filter((t) => baseOf(fixName(t.name)) === baseOf(p.name) && !claimedTl.has(t.id))
      .map((t) => ({ t, d: dist([p.lat, p.lon], [t.latitude, t.longitude]) }))
      .filter((c) => c.d > 40 && c.d <= 200)
      .filter((c) => !others.some((o) => dist([o.lat, o.lon], [c.t.latitude, c.t.longitude]) <= 20))   // wolny
      .filter((c) => tram ? !!osmRails.nearest(c.t.latitude, c.t.longitude, 12)
        : (() => { const r = osmRoads.nearest(c.t.latitude, c.t.longitude, 40); return r && sameStreet(r.name, addrStreet(p.addr)); })())
      .sort((a, b) => a.d - b.d);
    if (!cands.length) continue;
    const c = cands[0]; claimedTl.add(c.t.id); moved++;
    warn(`„${p.name}": ${reason} — przeniesiony ${Math.round(c.d)} m na słupek plannera ${tram ? 'na torze' : 'przy ulicy z adresu'} (${p.lat.toFixed(5)},${p.lon.toFixed(5)} → ${c.t.latitude.toFixed(5)},${c.t.longitude.toFixed(5)})`);
    p.lat = c.t.latitude; p.lon = c.t.longitude; p.src = `anexa17 (punkt wg plannera: ${tram ? 'arkusz stawiał słupek poza torem' : 'adres nie zgadzał się z ulicą przy punkcie'})`;
  }
  if (moved) log(`słupków przeniesionych na punkt plannera (adres/tor): ${moved}`);
}

// Słupek, który ma bliźniaka po drugiej stronie ulicy, nie trafił wyżej na
// swój odpowiednik (bliźniak był bliżej) — dobierany po znanej szerokości.
for (const p of poles.filter((x) => x.lat === null || x.lon === null)) {
  const same = tlStops.filter((t) => baseOf(fixName(t.name)) === baseOf(p.name));
  if (!same.length || p.lat === null) continue;
  const t = same.reduce((a, b) => (Math.abs(b.latitude - p.lat) < Math.abs(a.latitude - p.lat) ? b : a));
  p.lat = t.latitude; p.lon = t.longitude; p.src = 'anexa17 + współrzędne z plannera';
  fixedCoord++;
}
log(`planner Telelink: ${tlStops.length} słupków → ${added} dołożonych do inwentarza, ${fixedCoord} uzupełnionych współrzędnych`);
const blanks = poles.filter((p) => p.lat === null || p.lon === null);
if (blanks.length) warn(`${blanks.length} słupków bez współrzędnych: ${blanks.map((p) => p.name).join(', ')}`);

// Numer słupka z Anexy to kod porządkowy, nie nazwa: na tabliczce stoi
// „Podgoria", nie „Podgoria 6". Numer spada więc z nazwy wszędzie tam, gdzie
// słupki tej nazwy stoją obok siebie (do 250 m) — zostaje tam, gdzie naprawdę
// rozróżnia miejsca: Renașterii ciągnie się przez 726 m, Galleria to dwie pary
// po dwóch stronach ronda, osobno numerowane są też Voinicilor i Paul Chinezul.
// Patrz [[transit-maps-bare-numbers]] — klucz może mieć przedrostek, druk nigdy.
{
  const groups = new Map();
  for (const p of poles) {
    if (p.lat === null || p.lon === null) continue;
    const k = baseOf(p.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  let stripped = 0, kept = 0;
  for (const [, g] of groups) {
    let spread = 0;
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) spread = Math.max(spread, dist([g[i].lat, g[i].lon], [g[j].lat, g[j].lon]));
    }
    if (spread > 250) { kept += g.filter((p) => /\s\d+$/.test(p.name)).length; continue; }
    for (const p of g) {
      const bare = p.name.replace(/\s+\d+$/, '');
      if (bare !== p.name) { p.name = bare; stripped++; }
    }
  }
  log(`nazwy przystanków: ${stripped} słupków drukuje nazwę bez numeru porządkowego, ${kept} zachowuje go (grupy rozciągnięte na ponad 250 m)`);
}

// wzorce plannera: sekwencje słupków + polilinia
const tlPatterns = [];
for (const r of tlRoutes) {
  for (const p of r.patterns ?? []) {
    const stops = (p.stops ?? []).map((id) => tlToPole.get(id)).filter(Boolean);
    if (stops.length < 2) continue;
    tlPatterns.push({ short: clean(r.shortName), stops, names: stops.map((s) => canon(s.name)), geom: p.geometry ? decodePolyline(p.geometry) : [] });
  }
}
log(`planner Telelink: ${tlRoutes.length} linii, ${tlPatterns.length} wzorców (${tlPatterns.filter((p) => p.geom.length).length} z polilinią)`);

// ------------------------------------------------- 3) arkusz TRASEE URBANE (kontrola)
const trasee = readXlsx(join(SRC, 'trasee-urbane.xlsx'))['TRASEE URBANE'];
const excelRoutes = [];
for (const [hdr, mode] of [[2, 'tram'], [44, 'bus']]) {
  const head = trasee[hdr] ?? [];
  for (let c = 0; c < head.length; c++) {
    if (!clean(head[c])) continue;
    const seq = [];
    for (let r = hdr + 1; r < (mode === 'tram' ? 43 : trasee.length); r++) {
      const v = clean(trasee[r]?.[c]);
      if (v) seq.push(v);
    }
    excelRoutes.push({ head: clean(head[c]), mode, seq, key: norm(head[c]).replace(/^linia\s+/, '').replace(/\s+/g, '') });
  }
}
log(`TRASEE URBANE: ${excelRoutes.length} kolumn (${excelRoutes.filter((r) => r.mode === 'tram').length} pod „TRAMVAIE", ${excelRoutes.filter((r) => r.mode === 'bus').length} pod „AUTOBUZE")`);

// ------------------------------------------------- 4) rozkłady BusMana
const PROG = join(SRC, 'programe');
const index = JSON.parse(readFileSync(join(PROG, 'index.json'), 'utf8'));
const DAY = [
  [/zile\s+lucr/i, 'L'],            // poniedziałek–piątek
  [/sambata|sâmbătă/i, 'S'],        // sobota
  [/duminica|duminică/i, 'D'],      // niedziela
  [/sarbatoare|sărbătoare/i, 'SD'], // dni świąteczne = sobota + niedziela
];
const sanitize = (p) => p.replace(/[^0-9A-Za-z._-]+/g, '_');

/** w.htm → bloki (kierunki i warianty): nazwy przystanków i pliki z godzinami */
function parseIndexPage(html) {
  const blocks = [];
  for (const [, block] of html.matchAll(/<TD VALIGN="TOP">([\s\S]*?)<\/UL>/gi)) {
    const items = [...block.matchAll(/<LI>\s*(?:<A HREF="([^"]+)">)?\s*(?:<B>)?([^<]+)/gi)]
      .map(([, href, name]) => ({ page: href ? sanitize(href) : null, name: clean(name) }))
      .filter((x) => x.name);
    if (items.length > 1) blocks.push(items);
  }
  return blocks;
}

/** strona przystanku → { from, to, sections: {L|S|D|SD: [{t, letter}]}, notes } */
function parseStopPage(html) {
  const out = { from: '', to: '', sections: {}, notes: {} };
  const head = /<FONT SIZE=5><B>[^<]*<\/B><\/FONT><BR>([\s\S]*?)<\/TD>/i.exec(html)?.[1] ?? '';
  const parts = head.split(/-&gt;|->/);
  out.from = clean(parts[0]?.replace(/<[^>]+>/g, ''));
  out.to = clean(parts[1]?.replace(/<[^>]+>/g, ''));

  const rows = html.split(/<TR\b[^>]*>/i).slice(1).map((r) =>
    r.split(/<TD\b[^>]*>/i).slice(1).map((c) => c.replace(/<\/TD>[\s\S]*$|<\/TR>[\s\S]*$/i, '').trim()));

  let cur = null, hours = null;
  for (const cells of rows) {
    if (!cells.length) continue;
    const only = cells.length === 1 ? cells[0].replace(/<[^>]+>/g, ' ').trim() : '';
    const day = only && DAY.find(([re]) => re.test(only));
    if (day) { cur = day[1]; hours = null; out.sections[cur] ??= []; continue; }
    if (only && /^[A-Z] - /.test(only)) {
      for (const [, L, txt] of cells[0].matchAll(/([A-Z]) - ([^<]*)<BR>/g)) out.notes[L] = clean(txt);
      continue;
    }
    const asHours = cells.map((c) => /^<B>(\d{1,2})<\/B>$/.exec(c)?.[1]);
    if (cur && !hours && asHours.length >= 1 && asHours.every((h) => h !== undefined && h !== null)) { hours = asHours.map(Number); continue; }
    if (!cur || !hours) continue;
    const dep = [];
    let prev = -1, roll = 0;
    hours.forEach((h, i) => {
      if (h < prev) roll += 24;              // siatka przekracza północ (…22, 23, 0)
      prev = h;
      for (const [, mm, L] of (cells[i] ?? '').matchAll(/(\d{2})\s*([A-Z])?(?:<BR>|$|\s)/g)) {
        dep.push({ t: (h + roll) * 60 + Number(mm), letter: L ?? '' });
      }
    });
    out.sections[cur].push(...dep);
    hours = null;
  }
  for (const k of Object.keys(out.sections)) out.sections[k].sort((a, b) => a.t - b.t);
  return out;
}

// ------------------------------------------------- 5) dobór słupków
const cand = (name) => (byBase.get(canon(name)) ?? []).filter((p) => p.lat !== null && p.lon !== null);

/** Najkrótsza ścieżka przez kandydatów o pasującej nazwie — wybiera właściwą stronę ulicy. */
// Kolumna „Kierunek (sens)" Anexy mówi, w którą stronę jedzie autobus spod
// danego słupka: „Piața Romană", „Podgoria", „UTA", „Trenului"… Tam, gdzie to
// nazwa przystanku, miejsce bierze się ze słupków o tej nazwie; kilka słów to
// dzielnice i kierunki wylotowe bez własnego słupka — te ma mały słowniczek.
const GAZETTEER = {
  pecica: [46.17, 21.06], sag: [46.05, 21.33], fantanele: [46.13, 21.40], sofronea: [46.26, 21.31],
  livada: [46.23, 21.38], micalaca: [46.18, 21.35], vlaicu: [46.20, 21.29], gai: [46.21, 21.27],
  'zona industriala': [46.205, 21.255], arad: [46.175, 21.318], ghioroc: [46.156, 21.594],
  'combinat chimic': [46.165, 21.432], felnac: [46.16, 21.15], 'aradul nou': [46.145, 21.334],
};
// kierunki z Anexy zapisane inaczej niż nazwy słupków
const SENS_ALIAS = { sanpaul: 'cartier san paolo', 'ar nou': 'gara aradul nou', 'a nou': 'gara aradul nou', 'gara a nou': 'gara aradul nou', 'p romana': 'piata romana', 'p uta': 'piata uta' };
const unresolvedSens = new Set();
const placeOf = (sens) => {
  for (const part of String(sens ?? '').split(/[,/]/)) {
    const b0 = baseOf(part);
    if (!b0 || /cap(at)? de linie/.test(b0)) continue;
    const b = SENS_ALIAS[b0] ?? canon(part);
    const c = centroid(b) ?? centroid(b.replace(/^piata /, '')) ?? GAZETTEER[b] ?? GAZETTEER[b0] ?? (b.startsWith('zona industriala') ? GAZETTEER['zona industriala'] : null);
    if (c) return c;
    unresolvedSens.add(part.trim());
  }
  return null;
};
const KIND_TRAM = new Set(['tram', 'tram-sub']);
function pickPoles(names, hint, ctx = {}) {
  // tramwaj staje na słupku tramwajowym, autobus na autobusowym — gdy taki
  // jest; słupki plannera i OSM (bez rodzaju) zostają w grze zawsze
  const ofKind = (l) => {
    if (!ctx.kindPref) return l;
    const own = l.filter((p) => ctx.kindPref.has(p.kind) || (p.kind !== 'bus' && !KIND_TRAM.has(p.kind)));
    return own.some((p) => ctx.kindPref.has(p.kind)) ? own : l;
  };
  const layers = names.map((n) => ofKind(cand(n)));
  const missing = names.filter((n, i) => !layers[i].length);
  if (layers.every((l) => !l.length)) return { picked: names.map(() => null), missing };
  // przybliżony kierunek jazdy przy każdym przystanku: od środka kandydatów
  // poprzedniego do środka kandydatów następnego
  const mid = (i) => { const l = layers[i]; return l.length ? [l.reduce((a, p) => a + p.lat, 0) / l.length, l.reduce((a, p) => a + p.lon, 0) / l.length] : null; };
  const travel = (i) => {
    let a = null, b = null;
    for (let k = i - 1; k >= 0 && !a; k--) a = mid(k);
    for (let k = i + 1; k < names.length && !b; k++) b = mid(k);
    a = a ?? mid(i); b = b ?? mid(i);
    if (!a || !b) return null;
    const v = [(b[0] - a[0]) * 111320, (b[1] - a[1]) * 77000];
    const n = Math.hypot(v[0], v[1]);
    return n > 1 ? [v[0] / n, v[1] / n] : null;
  };
  let prev = null;
  const kept = [];
  for (let i = 0; i < layers.length; i++) {
    if (!layers[i].length) continue;
    const tv = layers[i].length > 1 ? travel(i) : null;
    const terminal = i === 0 || i === names.length - 1;
    // cosinus między kierunkiem jazdy a kierunkiem „sens" słupka (null: nieznany)
    const dotOf = (p) => {
      const place = tv && placeOf(p.sens);
      if (!place) return null;
      const d = [(place[0] - p.lat) * 111320, (place[1] - p.lon) * 77000];
      const n = Math.hypot(d[0], d[1]);
      return n > 30 ? (d[0] * tv[0] + d[1] * tv[1]) / n : null;
    };
    const dots = layers[i].length > 1 ? layers[i].map((p) => ({ p, dot: dotOf(p) })).filter((x) => x.dot !== null) : [];
    // PARA słupków tej samej ulicy (≤80 m od siebie), z których jeden patrzy
    // wyraźnie do przodu, a drugi do tyłu: Anexa rozstrzyga stronę, planner
    // tylko podpowiada (na Călărașilor planner miał słupki obu kierunków
    // skrzyżowane). Słupki innej linii o tej nazwie 150 m dalej (Renașterii
    // 48-ki przy Grădiniței) pary nie tworzą.
    const hiDot = dots.reduce((a, b) => (a && a.dot >= b.dot ? a : b), null);
    const loDot = dots.reduce((a, b) => (a && a.dot <= b.dot ? a : b), null);
    const decisive = i < names.length - 1 && !!(hiDot && loDot && hiDot.dot >= 0.6 && loDot.dot <= -0.6 && dist([hiDot.p.lat, hiDot.p.lon], [loDot.p.lat, loDot.p.lon]) <= 80);
    const layer = layers[i].map((p) => {
      let cost = hint?.[i] && p === hint[i] ? (decisive ? -100 : -300) : 0;
      if (layers[i].length > 1) {
        // strona ulicy: słupek, którego „sens" leży z przodu, wygrywa
        const dot = dotOf(p);
        // na przystanku KOŃCOWYM kierunek odjazdów nic nie mówi o tym, gdzie
        // autobus przyjeżdża (21/1 lądował na B109 „sens Horia" zamiast na
        // pętli, którą wskazuje planner)
        if (dot !== null && i < names.length - 1) cost -= 220 * dot;
        // przeciwny kierunek tej linii już ten słupek zajął (poza pętlami) —
        // więcej niż podpowiedź plannera, bo planner potrafi mieć jeden słupek
        // dla obu kierunków (Autoservice na 49b), a Anexa ma po jednym na stronę
        if (!terminal && ctx.used?.get(canon(p.name))?.has(p)) cost += 320;
      }
      return { p, cost, from: null };
    });
    if (process.env.LOG_PICK && ctx.label === process.env.LOG_PICK && layer.length > 1) console.log(`      PICK ${ctx.label} #${i} ${names[i]}: ` + layer.map((n) => `${n.p.id}(${n.p.kind},${n.p.sens||'-'})=${n.cost.toFixed(0)}${hint?.[i] === n.p ? '*' : ''}`).join(' '));
    // krok WSTECZ względem kierunku jazdy (słupek 48-ki 100 m za Grădinițą,
    // gdy 18A jedzie dalej do przodu) kosztuje ekstra
    const tvi = travel(i);
    const back = (a, b) => (tvi && ((b.lat - a.lat) * 111320 * tvi[0] + (b.lon - a.lon) * 77000 * tvi[1]) < -40 ? 200 : 0);
    if (prev) {
      for (const node of layer) {
        let best = null, bestC = Infinity;
        for (const pv of prev) {
          // dwa wpisy tej samej nazwy pod rząd to zwykle dwa słupki (podjazd i
          // odjazd z pętli), więc powtórzenie tego samego kosztuje
          const c = pv.cost + dist([pv.p.lat, pv.p.lon], [node.p.lat, node.p.lon]) + (pv.p === node.p ? 150 : 0) + back(pv.p, node.p);
          if (c < bestC) { bestC = c; best = pv; }
        }
        node.cost += bestC; node.from = best;
      }
    }
    prev = layer; kept.push(i);
  }
  let node = prev.reduce((a, b) => (b.cost < a.cost ? b : a));
  const chain = [];
  while (node) { chain.unshift(node.p); node = node.from; }
  const picked = names.map(() => null);
  kept.forEach((i, k) => { picked[i] = chain[k]; });
  return { picked, missing };
}

/** Wzorzec plannera najlepiej pasujący do ciągu nazw (+ podpowiedź słupek po słupku). */
const TL_SHORT = new Map(Object.entries({ Vladimirescu: 'VL - POD', Ghioroc: 'GH - POD' }));
function bestPattern(short, names) {
  const want = norm(TL_SHORT.get(short) ?? short);
  let best = null;
  for (const p of tlPatterns) {
    if (norm(p.short) !== want) continue;
    const a = names.map(canon), b = p.names;
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const score = dp[a.length][b.length] / Math.max(a.length, b.length);
    if (!best || score > best.score) best = { p, score, dp, a, b };
  }
  if (!best || best.score < 0.5) return null;
  const hint = new Array(names.length).fill(null);
  let i = best.a.length, j = best.b.length;
  while (i > 0 && j > 0) {
    if (best.a[i - 1] === best.b[j - 1]) { hint[i - 1] = best.p.stops[j - 1]; i--; j--; }
    else if (best.dp[i - 1][j] >= best.dp[i][j - 1]) i--;
    else j--;
  }
  return { pattern: best.p, score: best.score, hint };
}

// ------------------------------------------------- 6) odtwarzanie kursów
/** Z siatek odjazdów robi kursy: odjazd ścigany wzdłuż listy przystanków. */
function buildRuns(seq, notes, { fromStart }) {
  const runs = [];
  const take = (i, after, letter) => {
    let exact = null, plain = null, any = null;
    for (const d of seq[i].dep) {
      if (d.used || d.t < after || d.t - after > MAXHOP) continue;
      if (letter && d.letter === letter) { exact = d; break; }
      if (!d.letter) { plain ??= d; if (!letter) break; }
      any ??= d;
    }
    return exact ?? plain ?? any;
  };
  const endFor = (letter, i0) => {
    const m = letter && /^Spre:\s*(.+)$/i.exec(notes[letter] ?? '');
    if (!m) return seq.length - 1;
    const target = baseOf(m[1]);
    for (let i = i0 + 1; i < seq.length; i++) if (baseOf(seq[i].name) === target) return i;
    return seq.length - 1;
  };
  for (let start = 0; start < seq.length - 1; start++) {
    if (fromStart && start > 0) break;
    for (const d of seq[start].dep) {
      if (d.used) continue;
      d.used = true;
      const stops = [{ i: start, t: d.t }];
      const last = endFor(d.letter, start);
      let t = d.t;
      for (let i = start + 1; i <= last; i++) {
        // przystanek bez własnej strony w tym kierunku: BusMan drukuje w
        // kierunku powrotnym tylko część słupków (60 do Piaței Romane bez
        // Călțunaș…Izvor); kurs nim jedzie, czas dostanie z interpolacji
        if (!seq[i].dep.length) { stops.push({ i, t: null }); continue; }
        const nxt = take(i, t, d.letter);
        if (!nxt) break;
        nxt.used = true; t = nxt.t;
        stops.push({ i, t });
      }
      while (stops.length && stops[stops.length - 1].t === null) stops.pop();
      if (stops.length >= 2 || start === 0) runs.push({ letter: d.letter, stops, target: last });
      else d.used = false;
    }
  }
  return runs;
}

// ------------------------------------------------- 7) linie
const TRAM = new Set(['1', '1b', '3', '6', '7', '15', '16', '18b']);
// autobusy z numerem tramwajowym stają na słupkach tramwajowych (Podgoria 6,
// Miorița 1, Grădinița 1 w plannerze)
const TRAM_POLE_BUSES = new Set(['7A', '18A', 'Vladimirescu', 'Ghioroc']);
// punkty pośrednie między dwoma przystankami (droga inna niż najkrótsza)
const LINE_VIA = {
  48: [{ between: ['Felix', 'Frăției'], why: 'Strada Felix do końca, potem Strada Frăției', points: [[46.16713, 21.35104], [46.16691, 21.35189]] }],
};
// przebiegi spoza plannera: [lat, lon] w kolejności bloku 0
const LINE_SHAPES = (() => {
  try {
    const g = JSON.parse(readFileSyncOsm(join(ROOT, 'data/src/line13-shape.geojson'), 'utf8'));
    return Object.fromEntries(g.features.map((f) => [f.properties.line, f.geometry.coordinates.map(([lon, lat]) => [lat, lon])]));
  } catch { return {}; }
})();
const LABEL = new Map(Object.entries({
  '1B': '1b', 'BUS 7A': '7A', 'BUS 18A': '18A',
  'Vladi.-Podgo.': 'Vladimirescu', 'Ghioroc-Podgo.': 'Ghioroc', '49B': '49b',
}));

mkdirSync(GD, { recursive: true });
const routeRows = [], tripRows = [], stRows = [], shapeRows = [];
const usedPoles = new Set();
const stats = [];
let shapeSeq = 0, tripNo = 0, noGeom = 0, leftover = 0, totalDep = 0, estimatedArr = 0, interpolated = 0, extendedRuns = 0;

// nazwy pętli wszystkich linii — przystanek, na którym inna linia kończy bieg,
// jest miejscem zawrotu także dla linii okrężnej, która tamtędy przechodzi
// (Piața Romană dla 18b: pętla tramwajów 1, 3, 6 i 16)
const termNames = new Set();
for (const e of index) {
  for (const b of parseIndexPage(readFileSync(join(PROG, e.slug, 'w.htm'), 'utf8'))) {
    termNames.add(canon(b[0].name)); termNames.add(canon(b[b.length - 1].name));
  }
}

for (const entry of index) {
  const label = LABEL.get(entry.label) ?? entry.label;
  const isTram = TRAM.has(label);
  const routeId = `L${label}`;
  let blocks = parseIndexPage(readFileSync(join(PROG, entry.slug, 'w.htm'), 'utf8'));
  if (!blocks.length) { warn(`linia ${label}: w.htm bez listy przystanków — pomijam`); continue; }

  // Linia 48 jeździ w kółko (Billa → ANL → Real → ANL → Billa), a BusMan drukuje
  // każdy odcinek osobno. Gdy bloki domykają się w pętlę, scala się je w jeden
  // przebieg — inaczej połowa trasy nie miałaby kursu na całej długości.
  const first = (b) => canon(b[0].name), last = (b) => canon(b[b.length - 1].name);
  if (blocks.length > 2 && blocks.every((b, i) => i === 0 || last(blocks[i - 1]) === first(b)) &&
      last(blocks[blocks.length - 1]) === first(blocks[0])) {
    // styk odcinków: z dwóch wpisów tego samego przystanku zostaje ten z
    // następnego odcinka — poprzedni jest wytłuszczoną pętlą bez rozkładu
    const merged = blocks.reduce((acc, b) => (acc.length ? acc.slice(0, -1).concat(b) : b.slice()), []);
    // geometria pętli to sklejone polilinie odcinków — żaden pojedynczy wzorzec
    // plannera nie obejmuje całego okrążenia
    merged.geom = blocks.flatMap((b) => bestPattern(label, b.map((x) => x.name))?.pattern.geom ?? []);
    log(`linia ${label}: ${blocks.length} odcinki BusMana domykają pętlę — scalone w jeden przebieg (${merged.length} przystanków)`);
    blocks = [merged];
  }

  // Linia okrężna, która na końcu zawraca (52 na Grădina Poștei, 48 na parkingu
  // Realu, tramwaje 7/18b na Piaței Romane — tam rozkład wymienia plac dwa razy,
  // słupek przyjazdu i odjazdu), to dwa kierunki spotykające się w punkcie
  // zawrotu: tak nazywa je sam operator („PODGORIA – GELU – PODGORIA",
  // „BILLA – ANL – SELGROS – REAL") i tak ma wyglądać mapa — z pętlą na obu
  // końcach. Dzieli się w najdalszym od początku przystanku, ale tylko gdy
  // trasa naprawdę tam zawraca: podwójny wpis przystanku albo ostry (>120°)
  // zakręt polilinii plannera w jego pobliżu. Prawdziwe okrążenia (7A, 18A
  // wokół Micălaki) zostają jednym kierunkiem.
  if (blocks.length === 1 && first(blocks[0]) === last(blocks[0]) && blocks[0].length > 4) {
    const items = blocks[0];
    const names = items.map((x) => x.name);
    const { picked } = pickPoles(names, bestPattern(label, names)?.hint);
    const o = picked[0];
    let far = 1, farD = 0;
    picked.forEach((p, i) => { if (p && o && i > 0 && i < picked.length - 1) { const d = dist([o.lat, o.lon], [p.lat, p.lon]); if (d > farD) { farD = d; far = i; } } });
    const dup = canon(names[far]) === canon(names[far + 1] ?? '') ? far : canon(names[far - 1] ?? '') === canon(names[far]) ? far - 1 : -1;
    const geom = bestPattern(label, names)?.pattern.geom ?? items.geom ?? [];
    const fp = picked[far];
    let turns = false;
    for (let i = 1; i + 1 < geom.length && fp; i++) {
      if (dist([geom[i][0], geom[i][1]], [fp.lat, fp.lon]) > 80) continue;
      const v1 = [geom[i][0] - geom[i - 1][0], (geom[i][1] - geom[i - 1][1]) * 0.69], v2 = [geom[i + 1][0] - geom[i][0], (geom[i + 1][1] - geom[i][1]) * 0.69];
      const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2);
      if (n1 > 0 && n2 > 0 && (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2) < -0.5) { turns = true; break; }
    }
    // trasa wraca tą samą drogą, którą przyszła (48: ANL · Selgros · REAL · Selgros · ANL)
    const palindrome = far > 0 && far + 1 < names.length && canon(names[far - 1]) === canon(names[far + 1]);
    const why = dup >= 0 ? 'przystanek wpisany dwukrotnie: słupek przyjazdu i odjazdu'
      : turns ? 'najdalszy przystanek, trasa tam zawraca'
      : palindrome ? 'najdalszy przystanek, trasa wraca tą samą drogą'
      : termNames.has(canon(names[far])) ? 'najdalszy przystanek, pętla innych linii' : '';
    if (why) {
      const cut = dup >= 0 ? dup : far;
      blocks = dup >= 0 ? [items.slice(0, dup + 1), items.slice(dup + 1)] : [items.slice(0, far + 1), items.slice(far)];
      // geometria pętli przecięta w punkcie zawrotu — wzorzec plannera opisuje
      // całe okrążenie, a każdy kierunek ma dostać tylko swoją połowę
      const cp = picked[cut];
      if (geom.length > 1 && cp) {
        let k = 0, kd = Infinity;
        geom.forEach((g, i) => { const d = dist([g[0], g[1]], [cp.lat, cp.lon]); if (d < kd) { kd = d; k = i; } });
        blocks[0].geom = geom.slice(0, k + 1);
        blocks[1].geom = geom.slice(k);
      }
      log(`linia ${label}: pętla dzielona na dwa kierunki w „${names[cut]}" (${why})`);
    } else log(`linia ${label}: okrążenie bez zawrotu — jeden kierunek (najdalej ${names[far]}, ${Math.round(farD)} m od ${names[0]})`);
  }

  // kierunek: blok jest „powrotem", jeśli odwraca końce któregoś z bloków „tam"
  const dirOf = [];
  blocks.forEach((b, i) => {
    const rev = blocks.findIndex((o, j) => dirOf[j] === 0 && first(o) === last(b) && last(o) === first(b));
    dirOf[i] = rev >= 0 ? 1 : 0;
  });

  const xls = excelRoutes.find((r) => r.key === norm(label).replace(/\s+/g, '') ||
    (label === 'Vladimirescu' && r.key.startsWith('vladimirescu')) || (label === 'Ghioroc' && r.key.startsWith('ghioroc')));
  let routeTrips = 0, routeDep = 0, xlsDiff = '';
  const usedByLine = new Map();   // nazwa → słupki zajęte przez wcześniejsze bloki (kierunki) tej linii
  const blockInfo = [];

  blocks.forEach((items, bi) => {
    const names = items.map((x) => x.name);
    const hint = bestPattern(label, names);
    const { picked, missing } = pickPoles(names, hint?.hint, { label, kindPref: isTram ? KIND_TRAM : TRAM_POLE_BUSES.has(label) ? null : new Set(['bus']), used: usedByLine });
    if (process.env.LOG_PICK === label) console.log(`      PICKED ${label} blok ${bi}: ` + picked.map((p, i) => `${names[i]}→${p ? p.id : '-'}`).join(' | '));
    picked.forEach((p, i) => { if (p && i > 0 && i < picked.length - 1) { const k = canon(p.name); if (!usedByLine.has(k)) usedByLine.set(k, new Set()); usedByLine.get(k).add(p); } });
    if (missing.length) warn(`linia ${label} blok ${bi}: brak słupka dla ${[...new Set(missing)].join(', ')}`);
    picked.forEach((p) => p && usedPoles.add(p));

    // jeden kształt na blok — wszystkie kursy bloku jadą tą samą trasą
    // Linia 13 (Podgoria–Horia): planner nie ma jej wzorca, BusMan podaje dwa
    // przystanki — przebieg z pliku data/src/line13-shape.geojson (Calea
    // Radnei → Șiriei → DJ709), kierunek powrotny to jego odwrotność
    const fileShape = LINE_SHAPES[label] ? (bi === 0 ? LINE_SHAPES[label] : [...LINE_SHAPES[label]].reverse()) : null;
    const geom = [...(items.geom?.length ? items.geom : (hint?.pattern.geom?.length ? hint.pattern.geom : (fileShape ?? [])))];
    // Przystanek z rozkładu, którego planner nie zna (48: Frăției między Felix
    // a Renașterii — wzorzec plannera jedzie Dreptății, słupek stoi 200 m dalej
    // na Frăției): polilinia dostaje jego punkt między sąsiadami, żeby silnik
    // poprowadził trasę przez przystanek, a nie obok niego. Rozkład i Anexa
    // są tu danymi zamawiającego, planner tylko podpowiedzią.
    if (geom.length > 1) {
      const nearestIdx = (pt) => { let k = 0, kd = Infinity; geom.forEach((g, j) => { const d = dist(g, [pt.lat, pt.lon]); if (d < kd) { kd = d; k = j; } }); return [k, kd]; };
      for (let i = 1; i < names.length - 1; i++) {
        const p = picked[i];
        if (!p || hint?.hint?.[i]) continue;
        const [, dmin] = nearestIdx(p);
        const kindOk = isTram ? KIND_TRAM.has(p.kind) : TRAM_POLE_BUSES.has(label) ? true : p.kind === 'bus';
        if (dmin < 100 || dmin > 400 || !kindOk || !picked[i - 1] || !picked[i + 1]) continue;
        const [k1] = nearestIdx(picked[i - 1]), [k2] = nearestIdx(picked[i + 1]);
        // wierzchołki plannera między sąsiadami wypadają: kształt idzie
        // sąsiad → przystanek → sąsiad, a ulice między nimi znajdzie silnik.
        // Z zachowanymi wierzchołkami polilinia wracała spod przystanku tą
        // samą ulicą (48: Vaslui w dół i z powrotem zamiast dalej Frăției)
        const lo = Math.min(k1, k2), hi = Math.max(k1, k2);
        geom.splice(lo + 1, Math.max(0, hi - lo - 1), [p.lat, p.lon]);
        // punkty pośrednie, gdy droga do wstawionego przystanku nie jest
        // najkrótsza: 48 z Felix jedzie do końca Strada Felix i skręca w
        // Frăției (nie przez Vaslui) — narożnik Felix/Frăției i punkt na Frăției
        const via = LINE_VIA[label]?.find((v) => canon(v.between[0]) === canon(names[i - 1]) && canon(v.between[1]) === canon(names[i]));
        if (via) { geom.splice(lo + 1, 0, ...via.points); log(`linia ${label} blok ${bi}: ${via.points.length} punkty pośrednie ${names[i - 1]} → ${names[i]} (${via.why})`); }
        log(`linia ${label} blok ${bi}: przystanek „${p.name}" leży ${Math.round(dmin)} m od polilinii plannera — wstawiony do kształtu`);
      }
      // Pętle: polilinia plannera kończy się na środku skrzyżowania (Podgoria
      // 35–77 m od słupków, DN7 86 m, parking Real 56 m, pętla tramwajowa Făt
      // Frumos 98 m) — kształt dostaje słupek końcowy jako pierwszy/ostatni
      // punkt, a drogę (tor) do niego znajdzie silnik
      for (const [k, at] of [[0, 'start'], [names.length - 1, 'end']]) {
        const p = picked[k]; if (!p) continue;
        const e = at === 'start' ? geom[0] : geom[geom.length - 1];
        const d = dist(e, [p.lat, p.lon]);
        if (d < 20 || d > 400) continue;
        // polilinia i tak przechodzi przy słupku w pierwszych/ostatnich 800 m
        // (7/1: słupek odjazdu na wyjeździe z pętli Piața Romană, polilinia
        // zaczyna się na wjeździe) — dociągnięcie dublowałoby pętlę
        let passes = false, run = 0;
        const order = at === 'start' ? geom : [...geom].reverse();
        for (let q = 0; q < order.length && run <= 800; q++) {
          if (q) run += dist(order[q - 1], order[q]);
          if (dist(order[q], [p.lat, p.lon]) <= 30) { passes = true; break; }
        }
        if (passes) continue;
        if (at === 'start') geom.unshift([p.lat, p.lon]); else geom.push([p.lat, p.lon]);
        log(`linia ${label} blok ${bi}: kształt dociągnięty do słupka „${p.name}" (${Math.round(d)} m od ${at === 'start' ? 'początku' : 'końca'} polilinii plannera)`);
      }
    }
    let shapeId = '';
    if (geom.length > 1) {
      shapeId = `S${++shapeSeq}`;
      geom.forEach(([la, lo], i) => shapeRows.push([shapeId, la.toFixed(6), lo.toFixed(6), i + 1]));
    } else noGeom++;

    // siatki odjazdów każdego słupka
    const perStop = names.map((n) => ({ name: n }));
    const notes = {};
    const services = new Set();
    items.forEach((it, i) => {
      if (!it.page) return;
      const f = join(PROG, entry.slug, it.page);
      if (!existsSync(f)) { warn(`linia ${label}: brak pliku ${it.page}`); return; }
      const parsed = parseStopPage(readFileSync(f, 'utf8'));
      Object.assign(notes, parsed.notes);
      for (const [svc, deps] of Object.entries(parsed.sections)) {
        services.add(svc);
        perStop[i][svc] = deps.map((d) => ({ ...d, used: false }));
      }
    });

    for (const svc of [...services].sort()) {
      const seq = perStop.map((s) => ({ name: s.name, dep: s[svc] ?? [] }));
      const nDep = seq.reduce((a, s) => a + s.dep.length, 0);
      if (!nDep) continue;
      totalDep += nDep; routeDep += nDep;
      // najpierw kursy od początku trasy, potem te, które zaczynają się w środku
      const runs = buildRuns(seq, notes, { fromStart: true }).concat(buildRuns(seq, notes, { fromStart: false }));
      leftover += seq.reduce((a, s) => a + s.dep.filter((d) => !d.used).length, 0);
      // Kurs zaczynający się w środku kierunku tylko dlatego, że BusMan nie
      // drukuje godzin na początkowych przystankach (60 z Concordiei: strony
      // Călțunaș…Izvor nie istnieją, pierwsza godzina dopiero na Toth Arpad;
      // Anexa 17 ma jednak słupki powrotne, a innej drogi z pętli nie ma):
      // dostaje te przystanki od pętli. Godzina na pętli z przesunięcia kursów,
      // które ją mają wydrukowaną (mediana), bez nich z tempa jazdy niżej.
      const pageless = (j) => !seq[j].dep.length;
      const extLog = new Map();
      for (const run of runs) {
        const s0 = run.stops[0].i;
        if (s0 === 0) continue;
        let j = s0 - 1; while (j >= 1 && pageless(j)) j--;
        if (j >= 1) continue;                       // wcześniej jest przystanek z rozkładem: prawdziwy kurs skrócony
        const offs = runs
          .filter((r) => r.stops[0].i === 0 && r.stops[0].t !== null)
          .map((r) => { const k = r.stops.find((x) => x.i === s0); return k && k.t !== null ? k.t - r.stops[0].t : null; })
          .filter((x) => x !== null).sort((a, b) => a - b);
        const off = offs.length ? offs[offs.length >> 1] : null;
        const head = [];
        for (let k = 0; k < s0; k++) head.push({ i: k, t: k === 0 && off !== null ? run.stops[0].t - off : null });
        run.stops.unshift(...head); run.extFrom = s0; extendedRuns++;
        extLog.set(`${names[0]} → ${names[s0]}`, (extLog.get(`${names[0]} → ${names[s0]}`) ?? 0) + 1);
      }
      for (const [k, n] of extLog) log(`linia ${label} blok ${bi}: ${n} kursów dociągniętych do pętli (${k}: przystanki bez strony rozkładu, godziny szacowane)`);

      for (const run of runs) {
        const note = notes[run.letter] ?? '';
        const svcId = /numai.*s[âa]mb/i.test(note) ? 'S' : /numai.*dumin/i.test(note) ? 'D' : svc;
        const tripId = `${routeId}-${bi}-${svcId}-${String(++tripNo).padStart(4, '0')}`;
        const out = run.stops.map(({ i, t }, k) => ({ pole: picked[i], t, est: t === null || (run.extFrom !== undefined && k < run.extFrom) }));
        const paceOf = () => {
          let m = 0, mt = 0;
          for (let k = 1; k < out.length; k++) {
            if (out[k - 1].pole && out[k].pole && out[k - 1].t !== null && out[k].t !== null && !out[k - 1].est && !out[k].est) { m += dist([out[k - 1].pole.lat, out[k - 1].pole.lon], [out[k].pole.lat, out[k].pole.lon]); mt += out[k].t - out[k - 1].t; }
          }
          return m > 0 && mt > 0 ? mt / m : 1 / 300;          // min/m, awaryjnie 18 km/h
        };
        // początek bez żadnej wydrukowanej godziny na pętli: wstecz z tempa jazdy
        if (out.length && out[0].t === null) {
          let b = 0; while (b < out.length && out[b].t === null) b++;
          if (b < out.length) {
            const pace = paceOf();
            for (let k = b - 1; k >= 0; k--) {
              const a = out[k].pole, c = out[k + 1].pole;
              out[k].t = out[k + 1].t - (a && c ? Math.max(1, Math.round(dist([a.lat, a.lon], [c.lat, c.lon]) * pace)) : 2);
              out[k].est = true; interpolated++;
            }
          }
        }
        // czasy przystanków bez rozkładu: liniowo po odległości między
        // najbliższymi przystankami z godziną
        for (let k = 0; k < out.length; k++) {
          if (out[k].t !== null) continue;
          let a = k - 1; while (a >= 0 && out[a].t === null) a--;
          let b = k + 1; while (b < out.length && out[b].t === null) b++;
          if (a < 0 || b >= out.length) continue;
          const leg = (x, y) => (out[x].pole && out[y].pole ? dist([out[x].pole.lat, out[x].pole.lon], [out[y].pole.lat, out[y].pole.lon]) : 1);
          let total = 0, upto = 0;
          for (let m = a; m < b; m++) { const L = Math.max(1, leg(m, m + 1)); total += L; if (m < k) upto += L; }
          out[k].t = Math.round(out[a].t + (out[b].t - out[a].t) * upto / total);
          interpolated++;
        }
        for (let k = out.length - 1; k >= 0; k--) if (out[k].t === null) out.splice(k, 1);
        // Przyjazd na końcu biegu: BusMan drukuje rozkłady ODJAZDÓW, więc na
        // przystanku, na którym kurs się kończy, nie ma już godziny — ani na
        // pętli, ani tam, dokąd zawraca kurs skrócony („Spre: Piata U.T.A.").
        const endIdx = run.stops[run.stops.length - 1].i;
        if (endIdx === run.target - 1 && picked[run.target]) {
          let m = 0, mt = 0;
          for (let k = 1; k < out.length; k++) {
            if (out[k - 1].pole && out[k].pole) { m += dist([out[k - 1].pole.lat, out[k - 1].pole.lon], [out[k].pole.lat, out[k].pole.lon]); mt += out[k].t - out[k - 1].t; }
          }
          const pace = m > 0 && mt > 0 ? mt / m : 1 / 300;          // min/m, awaryjnie 18 km/h
          const a = out[out.length - 1].pole, b = picked[run.target];
          out.push({ pole: b, t: out[out.length - 1].t + (a ? Math.max(1, Math.round(dist([a.lat, a.lon], [b.lat, b.lon]) * pace)) : 2), est: true });
          estimatedArr++;
        }
        const rows = out.filter((s) => s.pole);
        if (rows.length < 2) continue;
        tripRows.push([routeId, svcId, tripId, clean(rows[rows.length - 1].pole.name), String(dirOf[bi]), shapeId]);
        rows.forEach((s, k) => stRows.push([tripId, s.pole.id, k + 1, hhmm(s.t), hhmm(s.t), s.est ? 0 : 1]));
        routeTrips++;
      }
    }
    blockInfo.push(`${names[0]} → ${names[names.length - 1]} (${names.length}${shapeId ? `, geom ${hint ? (hint.score * 100).toFixed(0) + '%' : 'sklejona'}` : ', bez geom'})`);
  });

  // kontrola: czy arkusz zamawiającego wymienia te same przystanki co rozkład
  if (xls) {
    const web = new Set(blocks.flat().map((x) => canon(x.name)));
    const sheet = new Set(xls.seq.map(canon));
    const onlySheet = [...sheet].filter((n) => !web.has(n));
    const onlyWeb = [...web].filter((n) => !sheet.has(n));
    if (onlySheet.length || onlyWeb.length) {
      xlsDiff = ` [arkusz ${xls.seq.length} poz. / rozkład ${blocks.flat().length}` +
        (onlySheet.length ? `; tylko w arkuszu: ${onlySheet.join(', ')}` : '') +
        (onlyWeb.length ? `; tylko w rozkładzie: ${onlyWeb.join(', ')}` : '') + ']';
    }
  } else xlsDiff = ' [brak kolumny w arkuszu]';

  routeRows.push([routeId, AGENCY_ID, label,
    clean(entry.desc).replace(/^AUTOBUZ:\s*/i, '').replace(/^\d+[a-zA-Z]?\s+/, ''), isTram ? 0 : 3, '']);
  stats.push({ label, isTram, trips: routeTrips, dep: routeDep, blocks: blockInfo, xlsDiff });
}

// ------------------------------------------------- 8) zapis
const stopRows = [...usedPoles].sort((a, b) => a.id.localeCompare(b.id))
  .map((p) => [p.id, p.id, p.name, p.addr || '', p.lat.toFixed(6), p.lon.toFixed(6)]);
writeFileSync(join(GD, 'stops.txt'), csv(['stop_id', 'stop_code', 'stop_name', 'stop_desc', 'stop_lat', 'stop_lon'], stopRows));
writeFileSync(join(GD, 'routes.txt'), csv(['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color'], routeRows));
writeFileSync(join(GD, 'trips.txt'), csv(['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id'], tripRows));
writeFileSync(join(GD, 'stop_times.txt'), csv(['trip_id', 'stop_id', 'stop_sequence', 'arrival_time', 'departure_time', 'timepoint'], stRows));
writeFileSync(join(GD, 'shapes.txt'), csv(['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'], shapeRows));
writeFileSync(join(GD, 'agency.txt'), csv(['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang'],
  [[AGENCY_ID, AGENCY_NAME, AGENCY_URL, 'Europe/Bucharest', 'ro']]));
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
writeFileSync(join(GD, 'calendar.txt'), csv(
  ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  [['L', 1, 1, 1, 1, 1, 0, 0, today, '20271231'],
   ['S', 0, 0, 0, 0, 0, 1, 0, today, '20271231'],
   ['D', 0, 0, 0, 0, 0, 0, 1, today, '20271231'],
   ['SD', 0, 0, 0, 0, 0, 1, 1, today, '20271231']]));
writeFileSync(join(GD, 'feed_info.txt'), csv(
  ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_version'],
  [['transit-maps — Anexa 17 + TRASEE URBANE + rozkłady CTP Arad', AGENCY_URL, 'ro', today, today]]));

// ------------------------------------------------- 9) raport
log('');
log('linia   typ      kursy  odjazdy  bloki rozkładu');
for (const s of stats) {
  log(`${s.label.padEnd(7)} ${(s.isTram ? 'tramwaj' : 'autobus').padEnd(8)} ${String(s.trips).padStart(5)} ${String(s.dep).padStart(8)}  ${s.blocks.join(' | ')}${s.xlsDiff}`);
}
const svcCount = new Map();
for (const t of tripRows) svcCount.set(t[1], (svcCount.get(t[1]) ?? 0) + 1);
log('');
log(`GTFS w data/gtfs: ${routeRows.length} linii, ${tripRows.length} kursów (${[...svcCount].sort().map(([k, v]) => `${k}: ${v}`).join(', ')}), ` +
  `${stRows.length} pozycji stop_times, ${stopRows.length} słupków, ${shapeRows.length} punktów w ${shapeSeq} kształtach`);
log(`odjazdów w rozkładach: ${totalDep}, niewykorzystanych po złożeniu kursów: ${leftover} (${(100 * leftover / Math.max(1, totalDep)).toFixed(1)}%)`);
if (unresolvedSens.size) log(`kierunki „sens" z Anexy bez miejsca na mapie (bez wpływu na dobór strony): ${[...unresolvedSens].sort().join(', ')}`);
log(`godzin dopisanych na pętlach (BusMan ich nie drukuje): ${estimatedArr}, interpolowanych na przystankach bez strony rozkładu: ${interpolated} — z ${stRows.length} pozycji (timepoint=0); kursów dociągniętych do pętli przez przystanki bez strony: ${extendedRuns}`);
if (noGeom) log(`bloków bez polilinii plannera: ${noGeom} — silnik dopasuje je po samych przystankach`);
if (warns.length) log(`ostrzeżeń: ${warns.length}`);
