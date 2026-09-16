// Pobiera to, czego nie ma w arkuszach: rozkłady i geometrię.
//
// Arkusze od zamawiającego (Anexa 17 + TRASEE URBANE) dają komplet słupków ze
// współrzędnymi i listy przystanków 25 linii miejskich — ale ani jednej godziny
// i ani jednej polilinii. Obie te rzeczy są publiczne gdzie indziej:
//
//   ctparad.ro/wp-content/programe/…   – rozkłady operatora w eksporcie BusMana:
//       <linia>/w.htm        = dwa kierunki, każdy jako lista przystanków
//       <linia>/NNNNtNNN.htm = godziny odjazdów z JEDNEGO przystanku w JEDNYM
//                              kierunku, siatka „godzina → minuty", osobno dla
//                              dni roboczych i świątecznych, z literowymi
//                              odsyłaczami skróconych kursów („A - Spre: …")
//   telelink.city/api/v1/…/transport/planner/{stops,routes}
//                                      – backend plannera pasażerskiego CTP
//       (ten sam silnik co w Burgasie): słupki ze współrzędnymi oraz wzorce
//       tras z zakodowaną polilinią Google — czyli shapes.
//
// Skrypt zapisuje surowe pliki do data/src/ i nic nie interpretuje; całą
// robotę wykonuje arad-feed.mjs, więc feed da się przebudować offline.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data/src');

const t0 = Date.now();
const log = (m) => console.log(`[scrape ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const UA = 'Mozilla/5.0 (transit-maps family; contact via github.com/Miqell24)';
const REFRESH = process.argv.includes('--refresh');

// BusMan pisze w windows-1250; zapisujemy pliki jako UTF-8, żeby feed nie musiał zgadywać
const dec1250 = new TextDecoder('windows-1250');

async function get(url, { binary = false } = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      return binary ? buf : dec1250.decode(buf);
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

async function cached(relPath, url, { json = false } = {}) {
  const file = join(SRC, relPath);
  if (!REFRESH && existsSync(file)) return readFileSync(file, 'utf8');
  const txt = json ? await (await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })).text() : await get(url);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, txt, 'utf8');
  return txt;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ---------- 1) planner Telelink (współrzędne + geometria) ----------
const TENANT = 'e39aa927-11c1-435f-92b9-57804f7bc1b4';
const TL = `https://www.telelink.city/api/v1/${TENANT}/transport/planner`;
for (const ep of ['stops', 'routes']) {
  const txt = await cached(`telelink/${ep}.json`, `${TL}/${ep}`, { json: true });
  log(`telelink/${ep}.json — ${(txt.length / 1024).toFixed(0)} kB, ${JSON.parse(txt).length} rekordów`);
}

// ---------- 2) spis linii w rozkładach ----------
const PROG = 'https://ctparad.ro/wp-content/programe';
// tramwaje (i cztery linie tramwajowe obsługiwane autobusami) — lista w linii.js
const liniiJs = await cached('programe/tramvai-linii.js', `${PROG}/tramvai/linii.js`);
const tramLines = [...liniiJs.matchAll(/\{label:\s*"([^"]*)",\s*link:\s*"([^"/]+)\/w\.htm",\s*desc:\s*"([^"]*)"\}/g)]
  .map(([, label, dir, desc]) => ({ label, dir, desc, base: `${PROG}/tramvai/${dir}`, kind: 'tramvai' }));
// autobusy — lista w rute.json (bierzemy tylko miejskie, czyli te z arkusza)
const ruteJson = await cached('programe/autobuz-rute.json', `${PROG}/autobuz/rute.json`, { json: true });
const URBAN = new Set(['Linia 13', 'Linia 19', 'Linia 21', 'Linia 31', 'Linia 39b', 'Linia 41', 'Linia 46',
  'Linia 48', 'Linia 49', 'Linia 49B', 'Linia 52', 'Linia 54', 'Linia 60']);
const busLines = JSON.parse(ruteJson).filter((r) => URBAN.has(r.name)).map((r) => ({
  label: r.name.replace(/^Linia\s+/, ''), dir: r.path, desc: r.label,
  base: `${PROG}/autobuz/bus_html/${encodeURIComponent(r.path)}`, kind: 'autobuz',
}));
const lines = [...tramLines, ...busLines];
log(`linie z rozkładami: ${lines.length} (${tramLines.length} w katalogu tramwajowym, ${busLines.length} autobusowych)`);

// ---------- 3) w.htm każdej linii + strona każdego przystanku ----------
let pages = 0;
const index = [];
for (const l of lines) {
  const slug = l.dir.replace(/[^0-9A-Za-z]+/g, '_');
  const w = await cached(`programe/${slug}/w.htm`, `${l.base}/w.htm`);
  // uwaga: linia 13 ma w nazwach plików apostrof wsteczny („013`t001.htm")
  const stopPages = [...w.matchAll(/HREF="([^"]+t\d+\.htm)"/gi)].map((m) => m[1]);
  await pool(stopPages, 4, async (p) => {
    await cached(`programe/${slug}/${p.replace(/[^0-9A-Za-z._-]+/g, '_')}`, `${l.base}/${encodeURIComponent(p)}`);
    pages++;
  });
  index.push({ label: l.label, kind: l.kind, dir: l.dir, slug, desc: l.desc, stopPages: stopPages.length });
  log(`${l.kind} ${l.label.padEnd(14)} ${String(stopPages.length).padStart(3)} stron przystankowych  (${l.desc.slice(0, 50)})`);
}
writeFileSync(join(SRC, 'programe/index.json'), JSON.stringify(index, null, 1), 'utf8');
log(`gotowe: ${lines.length} linii, ${pages} stron rozkładowych w data/src/programe`);
