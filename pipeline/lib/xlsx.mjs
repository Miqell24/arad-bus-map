// Minimalny czytnik .xlsx — tyle, ile potrzeba, żeby wczytać arkusz jako tablicę wierszy.
//
// Pliki źródłowe Aradu przychodzą w XLSX-ie i nic poza nimi nie jest potrzebne,
// więc zamiast ciągnąć zależność (openpyxl po stronie Pythona albo sheetjs po
// stronie Node'a) czytamy je wprost: .xlsx to ZIP z XML-em w środku, a Node ma
// w zlib inflateRaw. Obsłużone: katalog centralny ZIP-a (store i deflate),
// sharedStrings, komórki tekstowe (t="s"/"inlineStr"/"str"), liczbowe i puste.
// Nieobsłużone i niepotrzebne: formuły, style, daty jako liczby seryjne.
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

function unzip(buf) {
  // End of Central Directory — szukamy od końca (komentarz ZIP-a może mieć do 64 kB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('to nie jest ZIP (brak End of Central Directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`uszkodzony katalog centralny na pozycji ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    // dane leżą za lokalnym nagłówkiem, którego pola długości bywają inne niż w katalogu
    const lnlen = buf.readUInt16LE(lho + 26);
    const lelen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10)) : ENT[e] ?? m);

// „BC12" → 12 (numer kolumny, licząc od 1)
function colOf(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n;
}

/** Tabele z .docx (ten sam ZIP + XML): tablica tabel, każda = wiersze = komórki (tekst). */
export function readDocxTables(path) {
  const zip = unzip(readFileSync(path));
  const xml = zip.get('word/document.xml')?.toString('utf8') ?? '';
  const text = (frag) => unesc([...frag.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(''));
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(([, tbl]) =>
    [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map(([, tr]) =>
      [...tr.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(([, tc]) => text(tc).replace(/\s+/g, ' ').trim())));
}

/** Zwraca { nazwaArkusza: [[komórka, …], …] } — wiersze bez końcowych pustych komórek. */
export function readXlsx(path) {
  const zip = unzip(readFileSync(path));
  const txt = (name) => (zip.has(name) ? zip.get(name).toString('utf8') : '');

  const shared = [];
  for (const [, si] of txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // <si> może mieć kilka <r><t>…</t></r> (fragmenty o różnym formatowaniu) — sklejamy
    shared.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join(''));
  }

  const rels = new Map();
  for (const [, id, target] of txt('xl/_rels/workbook.xml.rels').matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    rels.set(id, target.replace(/^\/?(xl\/)?/, ''));
  }

  const out = {};
  for (const [, attrs] of txt('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unesc(/name="([^"]*)"/.exec(attrs)?.[1] ?? '');
    const rid = /r:id="([^"]*)"/.exec(attrs)?.[1];
    const file = rels.get(rid);
    if (!file || !zip.has('xl/' + file)) continue;
    const xml = zip.get('xl/' + file).toString('utf8');
    const rows = [];
    // uwaga: leniwe [^>]*? — chciwe zjadłoby ukośnik znacznika samozamykającego
    // i pusta komórka „<c r=„F50"/>" wchłonęłaby zawartość następnej
    for (const [, rattr, body] of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = Number(/r="(\d+)"/.exec(rattr)?.[1] ?? rows.length + 1);
      const cells = [];
      for (const [, cattr, cbody] of (body ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+\d+)"/.exec(cattr)?.[1];
        const t = /t="([^"]*)"/.exec(cattr)?.[1] ?? 'n';
        const i = (ref ? colOf(ref) : cells.length + 1) - 1;
        let v = null;
        if (cbody) {
          if (t === 's') {
            const k = Number(/<v>(\d+)<\/v>/.exec(cbody)?.[1]);
            v = shared[k] ?? null;
          } else if (t === 'inlineStr') {
            v = [...cbody.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join('') || null;
          } else {
            const raw = /<v>([\s\S]*?)<\/v>/.exec(cbody)?.[1];
            if (raw !== undefined) v = t === 'str' || t === 'e' ? unesc(raw) : Number(raw);
          }
        }
        cells[i] = v;
      }
      while (cells.length && (cells[cells.length - 1] === null || cells[cells.length - 1] === undefined)) cells.pop();
      rows[r - 1] = cells;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    out[name] = rows;
  }
  return out;
}
