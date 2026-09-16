// Co jest w kadrze? Narzędzie diagnostyczne: dla prostokąta (lub punktu z
// promieniem) wypisuje kształty GTFS, narysowane przebiegi, słupki i way'e OSM
// razem z ich tagami — żeby zrozumieć KAŻDĄ pętelkę czy kikut na danych, a nie
// na oko.   node pipeline/spot.mjs 46.1805 21.3410 [promień m]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [lat0, lon0, rad = 150] = process.argv.slice(2).map(Number);
if (!Number.isFinite(lat0) || !Number.isFinite(lon0)) { console.log('użycie: node pipeline/spot.mjs <lat> <lon> [promień m]'); process.exit(1); }
const dm = (lat, lon) => Math.hypot((lat - lat0) * 111320, (lon - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180));
const inside = (coords) => coords.some(([lon, lat]) => dm(lat, lon) <= rad);
const fmt = ([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`;
const clip = (coords) => {
  // fragmenty w promieniu, z jednym punktem zapasu po obu stronach
  const out = [];
  let cur = null;
  coords.forEach((c, i) => {
    const near = dm(c[1], c[0]) <= rad;
    if (near) { if (!cur) { cur = []; if (i > 0) cur.push(coords[i - 1]); } cur.push(c); }
    else if (cur) { cur.push(c); out.push(cur); cur = null; }
  });
  if (cur) out.push(cur);
  return out;
};
const gj = (f) => JSON.parse(readFileSync(join(ROOT, 'data/out', f), 'utf8')).features;

console.log(`== kadr ${lat0},${lon0} r=${rad} m ==`);
console.log('\n-- kształty GTFS (gtfs-shape.geojson) --');
for (const f of gj('gtfs-shape.geojson')) {
  for (const part of clip(f.geometry.coordinates)) {
    if (part.length < 2) continue;
    console.log(`${f.properties.line}/${f.properties.dir} (${f.properties.mode}): ${part.map(fmt).join(' → ')}`);
  }
}
if (existsSync(join(ROOT, 'data/out/paths.geojson'))) {
  console.log('\n-- narysowane przebiegi linii (paths.geojson) --');
  for (const f of gj('paths.geojson')) {
    for (const part of clip(f.geometry.coordinates)) {
      if (part.length < 2) continue;
      console.log(`${f.properties.line}/${f.properties.dir}${f.properties.pseudo ? ' pseudo' : ''}: ${part.map(fmt).join(' → ')}`);
    }
  }
}
console.log('\n-- słupki (stops.geojson) --');
for (const f of gj('stops.geojson')) {
  const [lon, lat] = f.geometry.coordinates;
  if (dm(lat, lon) <= rad) console.log(`${f.properties.sid ?? '?'} ${f.properties.name} [${f.properties.lines}] ${lat.toFixed(5)},${lon.toFixed(5)} snap ${f.properties.snapDist} m${f.properties.terminus ? ' TERMINUS' : ''}`);
}
console.log('\n-- słupki w feedzie (stops.txt) --');
for (const l of readFileSync(join(ROOT, 'data/gtfs/stops.txt'), 'utf8').split('\n').slice(1)) {
  const m = /^([^,]+),[^,]*,("[^"]*"|[^,]*),("[^"]*"|[^,]*),([\d.]+),([\d.]+)/.exec(l);
  if (m && dm(+m[4], +m[5]) <= rad) console.log(`${m[1]} ${m[2].replace(/"/g, '')} ${(+m[4]).toFixed(5)},${(+m[5]).toFixed(5)}`);
}
for (const file of ['arad.json', 'arad-rail.json']) {
  const p = join(ROOT, 'data/osm', file);
  if (!existsSync(p)) continue;
  console.log(`\n-- OSM ${file} --`);
  for (const w of JSON.parse(readFileSync(p, 'utf8')).elements) {
    const g = w.geometry ?? [];
    if (!g.some((n) => dm(n.lat, n.lon) <= rad)) continue;
    const t = w.tags ?? {};
    const keys = ['highway', 'railway', 'service', 'access', 'oneway', 'junction', 'name', 'psv', 'bus', 'motor_vehicle', 'maxweight', 'area'];
    console.log(`w${w.id} ${keys.filter((k) => t[k]).map((k) => `${k}=${t[k]}`).join(' ')}  [${g.length} pkt, ${g.filter((n) => dm(n.lat, n.lon) <= rad).length} w kadrze]`);
  }
}
