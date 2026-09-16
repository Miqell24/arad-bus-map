// HMM/Viterbi map matching (Newson–Krumm 2009) on a directed road graph.
// Observations = GTFS polyline points; states = projections onto nearby segments;
// emission = Gaussian distance penalty; transition = penalty for |route − straight line|.
// The result follows OSM nodes, so roundabouts and intersections get true geometry.
import { candidates, dijkstra, pathTo } from './graph.mjs';

function emission(d, sigma) { return -0.5 * (d / sigma) * (d / sigma); }

// noPen (all four helpers below): soft contraflow multipliers drop to 1 —
// raw meters only. Hard oneways (infinite pen) stay impossible. Switched on
// for GTFS shape-gap legs, where the bridge must follow the corridor and a
// contraflow surcharge otherwise loses to a longer around-the-block detour.
// Each entry/exit carries `raw` (real meters) beside the penalized `cost`:
// paths are CHOSEN by cost but SCORED by raw meters — a surcharge read as
// distance compounds along oneway corridors until a genuine block-circling
// detour outranks the straight street the shape drives (X499 rectangle).
function exits(graph, c, noPen) {
  const s = graph.segs[c.segIdx];
  const list = [];
  if (isFinite(s.fwdPen)) list.push({ node: s.b, raw: (1 - c.t) * s.len, cost: (1 - c.t) * s.len * (noPen ? 1 : s.fwdPen) });
  if (isFinite(s.bwdPen)) list.push({ node: s.a, raw: c.t * s.len, cost: c.t * s.len * (noPen ? 1 : s.bwdPen) });
  return list;
}

function entries(graph, c, noPen) {
  const s = graph.segs[c.segIdx];
  const list = [];
  if (isFinite(s.fwdPen)) list.push({ node: s.a, raw: c.t * s.len, cost: c.t * s.len * (noPen ? 1 : s.fwdPen) });
  if (isFinite(s.bwdPen)) list.push({ node: s.b, raw: (1 - c.t) * s.len, cost: (1 - c.t) * s.len * (noPen ? 1 : s.bwdPen) });
  return list;
}

// Travel along a shared segment; cost includes directional penalties (null =
// impossible), raw is the real meters of the same move.
function sameSegDist(graph, a, b, noPen) {
  if (a.segIdx !== b.segIdx) return null;
  const s = graph.segs[a.segIdx];
  let best = null;
  if (isFinite(s.fwdPen) && b.t >= a.t) {
    best = { cost: (b.t - a.t) * s.len * (noPen ? 1 : s.fwdPen), raw: (b.t - a.t) * s.len };
  }
  if (isFinite(s.bwdPen) && b.t <= a.t) {
    const cost = (a.t - b.t) * s.len * (noPen ? 1 : s.bwdPen);
    if (best === null || cost < best.cost) best = { cost, raw: (a.t - b.t) * s.len };
  }
  return best;
}

// Per B-candidate: { cost, raw } of the min-cost connection, or null.
function routeDistances(graph, a, candsB, cap, noPen) {
  const sources = new Map();
  for (const e of exits(graph, a, noPen)) {
    const cur = sources.get(e.node);
    if (cur === undefined || e.cost < cur.cost) sources.set(e.node, { cost: e.cost, raw: e.raw });
  }
  const entryLists = candsB.map((c) => entries(graph, c, noPen));
  const targets = new Set();
  for (const list of entryLists) for (const e of list) targets.add(e.node);
  const { dist, raw } = dijkstra(graph, sources, targets, cap, noPen);
  return candsB.map((b, k) => {
    let best = sameSegDist(graph, a, b, noPen);
    for (const e of entryLists[k]) {
      const d = dist.get(e.node);
      if (d !== undefined) {
        const cost = d + e.cost;
        if (best === null || cost < best.cost) best = { cost, raw: raw.get(e.node) + e.raw };
      }
    }
    return best;
  });
}

// Geometry of the a→b connection (without the start point). Returns {d, coords, nodesPath|null}.
function connectPair(graph, a, b, cap, noPen) {
  const ss = sameSegDist(graph, a, b, noPen);
  const sources = new Map();
  for (const e of exits(graph, a, noPen)) {
    const cur = sources.get(e.node);
    if (cur === undefined || e.cost < cur) sources.set(e.node, e.cost);
  }
  const entryList = entries(graph, b, noPen);
  const targets = new Set(entryList.map((e) => e.node));
  const { dist, prev } = dijkstra(graph, sources, targets, cap, noPen);
  let best = null;
  for (const e of entryList) {
    const d = dist.get(e.node);
    if (d !== undefined) {
      const total = d + e.cost;
      if (!best || total < best.total) best = { total, node: e.node };
    }
  }
  if (ss !== null && (best === null || ss.cost <= best.total)) {
    return { d: ss.cost, coords: [[b.x, b.y]], nodesPath: null };
  }
  if (best === null) return null;
  const nodesPath = pathTo(prev, best.node);
  const coords = [];
  for (const n of nodesPath) {
    const nd = graph.nodes.get(n);
    coords.push([nd.x, nd.y]);
  }
  coords.push([b.x, b.y]);
  return { d: best.total, coords, nodesPath };
}

function argmax(arr) {
  let bi = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[bi]) bi = i;
  return bi;
}

function appendCoords(coords, extra) {
  for (const p of extra) {
    const last = coords[coords.length - 1];
    if (Math.abs(last[0] - p[0]) > 0.01 || Math.abs(last[1] - p[1]) > 0.01) coords.push(p);
  }
}

// pts: [[x,y], ...] (resampled GTFS polyline in local coordinates).
// Points with no roadway within ~70 m stay unassigned — if GTFS drives a road that
// is missing from OSM (new infrastructure), it is better to draw the raw trace than
// to pull the route onto random nearby streets (see the fallback in reconstruction).
export function matchShape(graph, pts, opts = {}) {
  const sigma = opts.sigma ?? 8;
  const beta = opts.beta ?? 32;
  const radii = opts.radii ?? [45, 70];
  const maxCand = opts.maxCand ?? 12;
  const perWay = opts.perWay ?? Infinity;
  // legs longer than this are GTFS shape gaps: bridge them on raw meters
  // (noPen) so the bridge hugs the corridor instead of dodging soft oneways
  const gapMin = opts.gapMin ?? Infinity;

  const obs = [];
  let skipped = 0;
  pts.forEach((p, idx) => {
    let cand = [];
    for (const r of radii) {
      cand = candidates(graph, p[0], p[1], r, maxCand, perWay);
      if (cand.length) break;
    }
    if (cand.length) obs.push({ x: p[0], y: p[1], cand, idx });
    else { skipped++; if (process.env.LOG_NOCAND) console.log(`      NOCAND @ ${p[0].toFixed(5)},${p[1].toFixed(5)}`); }
  });
  const N = obs.length;
  if (N === 0) return null;

  const NEG = -Infinity;
  const scoresHist = [obs[0].cand.map((c) => emission(c.dist, sigma))];
  const back = [];
  const breaks = new Set();
  const breakPts = [];

  for (let i = 1; i < N; i++) {
    const A = obs[i - 1], B = obs[i];
    const prevScores = scoresHist[i - 1];
    const dGc = Math.hypot(B.x - A.x, B.y - A.y);
    const cap = Math.max(400, dGc * 4 + 300);
    const noPen = dGc > gapMin;
    const rd = A.cand.map((c, j) => (prevScores[j] === NEG ? null : routeDistances(graph, c, B.cand, cap, noPen)));
    const ns = new Array(B.cand.length).fill(NEG);
    const bp = new Array(B.cand.length).fill(-1);
    for (let k = 0; k < B.cand.length; k++) {
      let best = NEG, bj = -1;
      for (let j = 0; j < A.cand.length; j++) {
        if (!rd[j] || rd[j][k] === null) continue;
        // scored on RAW meters — the contraflow surcharge steers the path
        // choice inside dijkstra but must not masquerade as extra distance
        const s = prevScores[j] - Math.abs(rd[j][k].raw - dGc) / beta;
        if (s > best) { best = s; bj = j; }
      }
      if (bj >= 0) { ns[k] = best + emission(B.cand[k].dist, sigma); bp[k] = bj; }
    }
    let allNeg = true;
    for (const s of ns) if (s !== NEG) { allNeg = false; break; }
    if (allNeg) {
      breaks.add(i);
      breakPts.push([B.x, B.y]);
      for (let k = 0; k < B.cand.length; k++) { ns[k] = emission(B.cand[k].dist, sigma); bp[k] = -1; }
    }
    let mx = -Infinity;
    for (const s of ns) if (s > mx) mx = s;
    for (let k = 0; k < ns.length; k++) if (ns[k] !== NEG) ns[k] -= mx;
    scoresHist.push(ns);
    back.push(bp);
  }

  const chosen = new Array(N);
  chosen[N - 1] = argmax(scoresHist[N - 1]);
  for (let i = N - 1; i >= 1; i--) {
    const j = back[i - 1][chosen[i]];
    chosen[i - 1] = j >= 0 ? j : argmax(scoresHist[i - 1]);
  }

  const c0 = obs[0].cand[chosen[0]];
  // Count TRAVELED meters per segment (not the mere fact of touching it) — a candidate
  // projected near a corner onto a long perpendicular segment must not drag the whole
  // block into the streets layer ("tails" at turns on a sparse OSM grid).
  let bridged = 0, rawFallbacks = 0, rawMeters = 0, sumDist = 0;

  // ---- hairpins ----
  // A vehicle in service does not reverse. Where the path reaches an
  // observation's candidate along a segment and leaves back the way it came —
  // the incoming route's last node is the outgoing route's first node, or the
  // two legs run opposite ways on one segment — the candidate sits a few
  // metres PAST the junction the vehicle actually turned at: a shape vertex
  // snapped onto a side street, a roundabout exit or a junction curve (Arad:
  // 46/60 at Strada Poetului, 41 on the Brâncuși roundabout, the 1/3/15 trams
  // pulled into the Cocorilor curve at Piața U.T.A., user report). The
  // candidate is moved onto that junction node — never dropped, so a real
  // loop the observation anchors (60's run out to Faurilor and back, 41's
  // dip below Eminescu) keeps its anchor. Kept as it is when it looks like a
  // real turnaround: a cul-de-sac with a stop at the end. A second pass then
  // looks at the assembled path for switchbacks at nodes BETWEEN candidates
  // (two junction curves meeting at an angle no tram can take) and drops the
  // candidate that caused one, but only if the direct route between its
  // neighbours is not materially shorter than the two legs it replaces — a
  // shorter route means the candidate was anchoring a genuine detour, and
  // it stays (reported as hairpinsLeft).
  const cand = obs.map((o, i) => o.cand[chosen[i]]);
  const stopsXY = opts.stopsXY || [];
  const nearStop = (x, y) => stopsXY.some((s) => Math.hypot(s[0] - x, s[1] - y) < 40);
  const MAX_NUB = 60;
  const rawBetween = (A, B) => {
    let m = 0;
    for (let p = A.idx; p < B.idx; p++) m += Math.hypot(pts[p + 1][0] - pts[p][0], pts[p + 1][1] - pts[p][1]);
    return m;
  };
  const link = (i, j) => {
    const A = obs[i], B = obs[j];
    const rawLen = rawBetween(A, B);
    const noPen = Math.hypot(B.x - A.x, B.y - A.y) > gapMin;
    return connectPair(graph, cand[i], cand[j], Math.max(500, rawLen * 4 + 300), noPen) ||
      connectPair(graph, cand[i], cand[j], rawLen * 8 + 2000, noPen);
  };
  // a candidate sitting exactly on a node (t = 0 or 1 — every snapped one
  // does) makes the route's first/last hop a zero-length step through its
  // OWN node, which would mask a reversal: skip that node and look at the
  // one actually travelled to
  const ownNode = (b) => {
    const sb = graph.segs[b.segIdx];
    return b.t < 1e-6 ? sb.a : b.t > 1 - 1e-6 ? sb.b : null;
  };
  const arrivesFrom = (conn, a, b) => {
    const sb = graph.segs[b.segIdx];
    if (conn.nodesPath) {
      const np = conn.nodesPath, own = ownNode(b);
      const last = np[np.length - 1];
      return last === own && np.length > 1 ? np[np.length - 2] : last;
    }
    return a.t <= b.t ? sb.a : sb.b;          // same segment: came from a's side
  };
  const leavesTo = (conn, b, c) => {
    const sb = graph.segs[b.segIdx];
    if (conn.nodesPath) {
      const np = conn.nodesPath, own = ownNode(b);
      return np[0] === own && np.length > 1 ? np[1] : np[0];
    }
    return c.t >= b.t ? sb.b : sb.a;
  };
  const deadEndBeyond = (b, fromEnd) => {
    const sb = graph.segs[b.segIdx];
    const far = fromEnd === sb.a ? sb.b : sb.a;
    return !(graph.out.get(far) || []).some((e) => e.segIdx !== b.segIdx);
  };
  const nodeCand = (nodeId, segIdx) => {
    const nd = graph.nodes.get(nodeId), sg = graph.segs[segIdx];
    return { segIdx, t: sg.a === nodeId ? 0 : 1, x: nd.x, y: nd.y, dist: 0 };
  };
  let hairpins = 0, hairpinsLeft = 0;
  // A spur to a stop on a side street is left in, but the vehicle does not
  // reverse at the pole: it drives on and leaves the street by its other end.
  // exitVia[i] = the far node of candidate i's segment — assemble() routes the
  // next leg from there (48 at Frăției: down Vaslui, along Frăției, on to
  // Dreptății — instead of down Vaslui and straight back up it).
  const exitVia = new Map();
  const kept = [0];
  for (let i = 1; i < N; i++) {
    if (i === N - 1) { kept.push(i); break; }
    const p = kept[kept.length - 1];
    const a = cand[p], b = cand[i], c = cand[i + 1];
    const c1 = link(p, i), c2 = link(i, i + 1);
    if (process.env.LOG_HAIRPIN && (!c1 || !c2)) console.log(`      HP obs ${i}: link null (c1=${!!c1} c2=${!!c2})`);
    if (c1 && c2) {
      const from = arrivesFrom(c1, a, b);
      const to = leavesTo(c2, b, c);
      if (process.env.LOG_HAIRPIN === '2') console.log(`      HP obs ${i} @ ${b.x.toFixed(0)},${b.y.toFixed(0)} seg ${b.segIdx} „${graph.segs[b.segIdx].name}" t=${b.t.toFixed(2)} from=${from} to=${to} c1np=${c1.nodesPath ? c1.nodesPath.length : '-'} c2np=${c2.nodesPath ? c2.nodesPath.length : '-'}`);
      if (from === to) {
        const nd = graph.nodes.get(from);
        const nub = Math.hypot(b.x - nd.x, b.y - nd.y);
        // a real turnaround: a cul-de-sac whose END is a stop of this run
        // (Via Carmina's car-park aisle ends 35 m from the pole, on a different
        // street — that is not it)
        const sbb = graph.segs[b.segIdx];
        const farNd = graph.nodes.get(from === sbb.a ? sbb.b : sbb.a);
        // …or a spur that is the only way to a stop: a stop within 25 m of
        // this candidate and more than 25 m from both its neighbours (the
        // Via Carmina bay 150 m down Cetății Orod off the DN7 — as opposed to
        // a bay beside the through road, which the road already passes)
        const dxy = (st, p) => Math.hypot(st[0] - p.x, st[1] - p.y);
        let spurStop = stopsXY.some((st) => dxy(st, b) < 25 && dxy(st, a) > 25 && dxy(st, c) > 25);
        if (spurStop) {
          // …unless the through road already passes the pole: with the spur
          // taken out, is every stop at its tip still within 25 m of the
          // direct a→c path? Then the spur is the planner's polyline touching
          // the stop point, not a road the bus uses (48 at ANL: 50 m down and
          // back beside Voinicilor; Frăției 192 m and the Via Carmina bay
          // 150 m off the road stay).
          const direct = connectPair(graph, a, c, Math.max(500, (c1.d + c2.d) * 2 + 300), false);
          if (direct && direct.coords && stopsXY.filter((st) => dxy(st, b) < 25).every((st) => pointToPolyline(direct.coords, st) <= 25)) spurStop = false;
        }
        const legit = spurStop || (nub > 20 && deadEndBeyond(b, from) && stopsXY.some((st) => Math.hypot(st[0] - farNd.x, st[1] - farNd.y) < 20));
        if (process.env.LOG_HAIRPIN) console.log(`      HP obs ${i} @ ${b.x.toFixed(0)},${b.y.toFixed(0)}: reversal at node ${from}, nub ${nub.toFixed(1)} m, legit=${legit}, ${c1.nodesPath || c2.nodesPath ? 'snap' : 'drop?'}`);
        if (legit && spurStop && !deadEndBeyond(b, from)) {
          const farId = from === sbb.a ? sbb.b : sbb.a;
          const rawLen = rawBetween(obs[i], obs[i + 1]);
          const alt = connectPair(graph, nodeCand(farId, b.segIdx), c, Math.max(500, rawLen * 4 + 300), false);
          if (alt && alt.d <= 3 * c2.d + 200 && alt.d < 900) { exitVia.set(i, farId); hairpins++; }
        }
        if (!legit) {
          if (c1.nodesPath || c2.nodesPath) { cand[i] = nodeCand(from, b.segIdx); hairpins++; }
          else {
            // all three on one segment: the middle one is simply out of order
            const direct = link(p, i + 1);
            if (direct && direct.d >= c1.d + c2.d - 2 * MAX_NUB) { hairpins++; continue; }
          }
        }
      }
    }
    kept.push(i);
  }

  const assemble = () => {
    const out = { coords: [[cand[kept[0]].x, cand[kept[0]].y]], usedLen: new Map(), usedIv: new Map(), rawStretches: [],
      bridged: 0, rawFallbacks: 0, rawMeters: 0, sumDist: 0, stepEnd: [0] };
    const use = (si, m, t0, t1) => {
      out.usedLen.set(si, (out.usedLen.get(si) || 0) + m);
      if (t0 !== undefined && t1 > t0) {
        let iv = out.usedIv.get(si);
        if (!iv) out.usedIv.set(si, (iv = [t0, t1]));
        else { if (t0 < iv[0]) iv[0] = t0; if (t1 > iv[1]) iv[1] = t1; }
      }
    };
    for (let q = 1; q < kept.length; q++) {
      const iA = kept[q - 1], iB = kept[q];
      const A = obs[iA], B = obs[iB];
      let a = cand[iA];
      const b = cand[iB];
      out.sumDist += b.dist;
      const via = exitVia.get(iA);
      if (via !== undefined) {
        // on from the stop to the far end of its segment, then route from there
        const sa = graph.segs[a.segIdx];
        const farCand = nodeCand(via, a.segIdx);
        use(a.segIdx, Math.abs(farCand.t - a.t) * sa.len, Math.min(a.t, farCand.t), Math.max(a.t, farCand.t));
        appendCoords(out.coords, [[farCand.x, farCand.y]]);
        a = farCand;
      }
      const rawLen = rawBetween(A, B);
      let isBreak = false;
      for (let k = iA + 1; k <= iB; k++) if (breaks.has(k)) isBreak = true;
      const spansSkipped = B.idx - A.idx > 1;
      const noPen = Math.hypot(B.x - A.x, B.y - A.y) > gapMin;
      let conn = connectPair(graph, a, b, Math.max(500, rawLen * 4 + 300), noPen);
      if (!conn) conn = connectPair(graph, a, b, rawLen * 8 + 2000, noPen);
      // The bridge is judged on a broken chain / across unassigned points — and,
      // more strictly, on shape-gap legs: if it comes out absurdly longer than
      // the raw trace, the road does not exist in OSM — draw the GTFS trace
      // instead of fabricating a detour via ramps (X499 at El Kafr drew an
      // 850 m rectangle over a 340 m straight corridor).
      const wildDetour = conn && (
        ((isBreak || spansSkipped) && conn.d > Math.max(rawLen * 2.5, rawLen + 150)) ||
        (noPen && conn.d > Math.max(rawLen * 2.2, rawLen + 150)));
      if (conn && !wildDetour) {
        appendCoords(out.coords, conn.coords);
        if (conn.nodesPath) {
          const sa = graph.segs[a.segIdx];
          const first = conn.nodesPath[0];
          if (first === sa.b) use(a.segIdx, (1 - a.t) * sa.len, a.t, 1);
          else if (first === sa.a) use(a.segIdx, a.t * sa.len, 0, a.t);
          for (let p = 0; p + 1 < conn.nodesPath.length; p++) {
            const si = graph.segByNodes.get(conn.nodesPath[p] + '|' + conn.nodesPath[p + 1]);
            if (si !== undefined) use(si, graph.segs[si].len, 0, 1);
          }
          const sb = graph.segs[b.segIdx];
          const last = conn.nodesPath[conn.nodesPath.length - 1];
          if (last === sb.a) use(b.segIdx, b.t * sb.len, 0, b.t);
          else if (last === sb.b) use(b.segIdx, (1 - b.t) * sb.len, b.t, 1);
        } else {
          use(a.segIdx, Math.abs(b.t - a.t) * graph.segs[a.segIdx].len, Math.min(a.t, b.t), Math.max(a.t, b.t));
        }
        if (isBreak) out.bridged++;
      } else {
        const raw = [[a.x, a.y]];
        for (let p = A.idx + 1; p < B.idx; p++) raw.push([pts[p][0], pts[p][1]]);
        raw.push([b.x, b.y]);
        appendCoords(out.coords, raw.slice(1));
        out.rawStretches.push(raw);
        out.rawFallbacks++;
        out.rawMeters += rawLen;
      }
      out.stepEnd.push(out.coords.length - 1);
    }
    return out;
  };
  // a switchback in the assembled path: a turn sharper than 150° after which
  // the path comes back within 10 m of where it was, inside 150 m
  // scanned from `start`, so an unfixable one is stepped over, not stopped at
  const findSwitchback = (coords, start) => {
    for (let i = Math.max(1, start); i < coords.length - 1; i++) {
      const a = coords[i - 1], b = coords[i], e = coords[i + 1];
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [e[0] - b[0], e[1] - b[1]];
      const n1 = Math.hypot(v1[0], v1[1]), n2 = Math.hypot(v2[0], v2[1]);
      if (n1 < 0.5 || n2 < 0.5) continue;
      const cosA = (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2);
      if (cosA > -0.866) continue;                    // < 150°
      // a spike of a few metres comes straight back onto its own trace
      if (cosA < -0.966 && Math.hypot(e[0] - a[0], e[1] - a[1]) < 3) return i;
      // sharper than 165° at a node is a switchback whether or not the path
      // comes back near itself: no bus or tram turns like that in service —
      // the 1/3/15 trams ran down one Piața U.T.A. junction curve and up the
      // other, 177° apart at the Cocorilor node
      if (cosA < -0.966) return i;
      let back = 0, returns = false;
      for (let j = i + 1; j < coords.length && back <= 150; j++) {
        back += Math.hypot(coords[j][0] - coords[j - 1][0], coords[j][1] - coords[j - 1][1]);
        if (back > 8 && Math.hypot(coords[j][0] - a[0], coords[j][1] - a[1]) < 10) { returns = true; break; }
      }
      if (returns) return i;
    }
    return -1;
  };
  const safeToDrop = (k) => {
    if (k <= 0 || k >= kept.length - 1) return false;
    const c1 = link(kept[k - 1], kept[k]), c2 = link(kept[k], kept[k + 1]);
    const direct = link(kept[k - 1], kept[k + 1]);
    return !!(c1 && c2 && direct) && direct.d >= c1.d + c2.d - 2 * MAX_NUB;
  };
  // How long is the excursion behind a reversal? The return leg is followed
  // while it stays within 10 m of the leg that went in; where they part is
  // where the excursion ends. A spike of a few metres and a junction-curve
  // switchback measure short; an out-and-back the operator really runs — line
  // 52 goes 700 m up Strada Cometei and comes back the same way — measures
  // long, and is left alone. A reversal whose tip is at one of this run's
  // stops is a real turnaround and is left alone whatever its length.
  const MAX_EXCURSION = 80;
  const pathLen = (coords) => {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]));
    return cum;
  };
  const along = (coords, cum, s) => {
    let i = 1;
    while (i < cum.length && cum[i] < s) i++;
    if (i >= cum.length) return null;
    const t = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
    return [coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]), coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1])];
  };
  // both legs are walked away from the vertex in 5 m steps; the excursion is
  // as long as they stay within 10 m of each other
  const excursionAt = (coords, cum, v) => {
    for (let s = 5; s <= 500; s += 5) {
      const b = along(coords, cum, cum[v] - s), f = along(coords, cum, cum[v] + s);
      if (!b || !f) return s;
      if (Math.hypot(b[0] - f[0], b[1] - f[1]) > 10) return s;
    }
    return 500;
  };
  const stopNear = (p, r) => stopsXY.some((st) => Math.hypot(st[0] - p[0], st[1] - p[1]) < r);
  let asm = assemble();
  let cum = pathLen(asm.coords);
  let from = 1, lastV = null, sameSpot = 0;
  for (let iter = 0; iter < 200; iter++) {
    const v = findSwitchback(asm.coords, from);
    if (v < 0) break;
    const at = asm.coords[v];
    const dbg = (why) => { if (process.env.LOG_HAIRPIN) console.log(`      SW @ ${at[0].toFixed(0)},${at[1].toFixed(0)} v=${v}: ${why}`); };
    // the same spot again after a drop: allowed a few times while each drop
    // still shortens the path (a switchback anchored by several candidates),
    // not when the road itself turns like that (a mini-roundabout entered from
    // a tangent) — then nothing changes and it is left alone
    if (lastV && Math.hypot(at[0] - lastV[0], at[1] - lastV[1]) < 15) {
      if (++sameSpot > 25) { hairpinsLeft++; from = v + 1; lastV = null; sameSpot = 0; dbg('LEFT repeat'); continue; }
    } else sameSpot = 0;
    const exc = excursionAt(asm.coords, cum, v);
    const q = asm.stepEnd.findIndex((e) => e >= v);      // step whose coordinates contain v
    const atEnd = q >= 0 && asm.stepEnd[q] === v;
    // the candidate that led the path there: the step's end if the spike is
    // the candidate itself, else the step's start; the other one as a fallback
    const tries = q < 1 ? [] : atEnd ? [q, q - 1, q + 1] : [q - 1, q, q + 1];
    let drop = tries.find(safeToDrop);
    if (drop === undefined) { hairpinsLeft++; from = v + 1; dbg(`LEFT no safe drop (q=${q} atEnd=${atEnd}, exc ${exc} m)`); continue; }
    if (exc > MAX_EXCURSION) {
      // a long out-and-back is the operator's (52 up Strada Cometei, 48 down
      // the Real access road): it stays. What may still go is a nub BEYOND the
      // stop at its end — tried, and kept only if the stop stays on the path.
      const st = stopsXY.find((p) => Math.hypot(p[0] - at[0], p[1] - at[1]) < 25);
      if (!st) { hairpinsLeft++; from = v + 1; dbg(`LEFT excursion ${exc} m`); continue; }
      const removed = kept.splice(drop, 1)[0];
      const asm2 = assemble();
      if (pointToPolyline(asm2.coords, st) > 15) {
        kept.splice(drop, 0, removed);
        hairpinsLeft++; from = v + 1; dbg(`LEFT excursion ${exc} m ending at a stop`); continue;
      }
      kept.splice(drop, 0, removed);              // re-inserted: the common path below drops it
    }
    const before = cum[cum.length - 1];
    kept.splice(drop, 1); hairpins++;
    asm = assemble();
    cum = pathLen(asm.coords);
    dbg(`drop kept[${drop}] (exc ${exc} m, path ${before.toFixed(0)} → ${cum[cum.length - 1].toFixed(0)} m)`);
    // a fruitless drop is harmless (the path did not move) — a switchback
    // anchored by several candidates needs a few before it gives
    if (before - cum[cum.length - 1] < 2) sameSpot++;
    from = 1;                                  // a drop can open a new one earlier in the path
    lastV = at;
  }
  const coords = asm.coords;
  const usedLen = asm.usedLen, usedIv = asm.usedIv, rawStretches = asm.rawStretches;
  bridged = asm.bridged; rawFallbacks = asm.rawFallbacks; rawMeters = asm.rawMeters; sumDist = asm.sumDist;

  // A segment enters the streets layer only once ≥25 m or ≥half of its length was
  // traveled (short intersection segments stay, glancing touches drop out).
  const usedSegs = new Set();
  for (const [si, m] of usedLen) {
    if (m >= Math.min(25, graph.segs[si].len * 0.5)) usedSegs.add(si);
  }

  let roundaboutSegs = 0;
  for (const si of usedSegs) if (graph.segs[si].roundabout) roundaboutSegs++;

  return {
    coords,
    usedSegs,
    usedIv,
    breakPts,
    rawStretches,
    stats: {
      observations: pts.length,
      matched: kept.length,
      hairpins,
      hairpinsLeft,
      noCandidates: skipped,
      viterbiBreaks: breaks.size,
      bridged: bridged,
      rawStretchCount: rawFallbacks,
      rawMeters: Math.round(rawMeters),
      meanError: N > 1 ? sumDist / (N - 1) : 0,
      roundaboutSegs: roundaboutSegs,
      extStart: 0,
      extEnd: 0,
    },
  };
}

function pointToPolyline(coords, p) {
  let best = Infinity;
  for (let i = 0; i + 1 < coords.length; i++) {
    const a = coords[i], b = coords[i + 1];
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const l2 = vx * vx + vy * vy;
    let t = l2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
    if (d < best) best = d;
  }
  return best;
}

// Segment bookkeeping of one routed leg — same rules as the reconstruction loop
// above, so an extended stretch enters the streets layer on equal terms.
function useConn(graph, use, a, conn, b) {
  if (conn.nodesPath) {
    const sa = graph.segs[a.segIdx];
    const first = conn.nodesPath[0];
    if (first === sa.b) use(a.segIdx, (1 - a.t) * sa.len, a.t, 1);
    else if (first === sa.a) use(a.segIdx, a.t * sa.len, 0, a.t);
    for (let p = 0; p + 1 < conn.nodesPath.length; p++) {
      const si = graph.segByNodes.get(conn.nodesPath[p] + '|' + conn.nodesPath[p + 1]);
      if (si !== undefined) use(si, graph.segs[si].len, 0, 1);
    }
    const sb = graph.segs[b.segIdx];
    const last = conn.nodesPath[conn.nodesPath.length - 1];
    if (last === sb.a) use(b.segIdx, b.t * sb.len, 0, b.t);
    else if (last === sb.b) use(b.segIdx, (1 - b.t) * sb.len, b.t, 1);
  } else {
    use(a.segIdx, Math.abs(b.t - a.t) * graph.segs[a.segIdx].len, Math.min(a.t, b.t), Math.max(a.t, b.t));
  }
}

// Route through a chain of points, greedily leg by leg. `from` seeds the chain
// (all its candidates compete on the first leg), every `target` is then reached
// from the candidate the previous leg settled on. A leg with no road route — or
// one whose route is an absurd detour — ends the chain: half an extension beats
// invented geometry.
function chainThrough(graph, from, targets, use, opts) {
  const coords = [];
  let curCands = candidates(graph, from.pt[0], from.pt[1], from.radius, 6);
  if (!curCands.length) return { coords, reached: 0, meters: 0 };
  let cur = null, meters = 0, reached = 0;
  for (const t of targets) {
    const cands = candidates(graph, t.pt[0], t.pt[1], t.radius, 8);
    if (!cands.length) break;
    const src = cur ? [cur] : curCands;
    const gap = Math.hypot(t.pt[0] - (cur ? cur.x : from.pt[0]), t.pt[1] - (cur ? cur.y : from.pt[1]));
    if (gap > opts.maxGap) break;
    const cap = Math.max(400, gap * 2.5 + 300);
    let best = null;
    for (const a of src) {
      for (const b of cands) {
        const conn = connectPair(graph, a, b, cap, false);
        // the emission side still matters: a candidate 150 m off the pole that
        // routes 20 m shorter is not the stop's street
        if (conn && (!best || conn.d + b.dist * 2 < best.conn.d + best.b.dist * 2)) best = { a, b, conn };
      }
    }
    if (!best) break;
    if (!cur) coords.push([best.a.x, best.a.y]);
    appendCoords(coords, best.conn.coords);
    useConn(graph, use, best.a, best.conn, best.b);
    meters += best.conn.d;
    cur = best.b;
    reached++;
  }
  return { coords, reached, meters };
}

// Terminal repair — the drawn line must reach the stops it serves.
//
// Source geometry regularly stops short of a terminus: the Jastrzębie shape of
// line 303 ends 1.3 km before Kamień Rzędówka, TPBI's tram 1 gives up 3 km before
// Romprim, and a stop-sequence pseudo-shape silently loses its last observation
// when the pole coordinate lies off every road (Lyski Rondo sits 115 m into a
// field, outside the candidate net — user report). Whatever the cause, the line
// ends in mid-street while the terminus disc, its name and the line badges float
// away from any route: the most visible defect the map can show.
//
// Fix: take the stops at either end that the matched geometry never comes near
// and chain them onto it through the graph, leg by leg, the way a pseudo match
// would have drawn them. Guarded: a run that is far from ALL its stops is a
// broken match, not a short shape, and is left untouched.
export function extendToStops(graph, res, stopsXY, opts = {}) {
  const trigger = opts.trigger ?? 120;
  const radius = opts.radius ?? 160;
  const maxGap = opts.maxGap ?? 4000;
  const coords = res.coords;
  if (!Array.isArray(stopsXY) || stopsXY.length < 2 || coords.length < 2) return null;

  const far = stopsXY.map((p) => pointToPolyline(coords, p) > trigger);
  let head = 0;
  while (head < far.length && far[head]) head++;
  let tail = 0;
  while (tail < far.length - head && far[far.length - 1 - tail]) tail++;
  if (!head && !tail) return null;
  if (head + tail >= far.length) return null;

  const usedLen = new Map();
  const use = (si, m, t0, t1) => {
    usedLen.set(si, (usedLen.get(si) || 0) + m);
    if (t0 !== undefined && t1 > t0) {
      let iv = res.usedIv.get(si);
      if (!iv) res.usedIv.set(si, (iv = [t0, t1]));
      else {
        if (t0 < iv[0]) iv[0] = t0;
        if (t1 > iv[1]) iv[1] = t1;
      }
    }
  };

  let startM = 0, endM = 0;
  if (tail) {
    const seq = stopsXY.slice(stopsXY.length - tail).map((pt) => ({ pt, radius }));
    const ch = chainThrough(graph, { pt: coords[coords.length - 1], radius: 30 }, seq, use, { maxGap });
    if (ch.reached) { appendCoords(coords, ch.coords); endM = ch.meters; }
  }
  if (head) {
    // travel order: the first orphan stop → … → the point the match starts at
    const seq = [...stopsXY.slice(1, head).map((pt) => ({ pt, radius })), { pt: coords[0], radius: 30 }];
    const ch = chainThrough(graph, { pt: stopsXY[0], radius }, seq, use, { maxGap });
    if (ch.reached === seq.length) {
      const pre = ch.coords;
      while (pre.length && Math.abs(pre[pre.length - 1][0] - coords[0][0]) < 0.01 &&
             Math.abs(pre[pre.length - 1][1] - coords[0][1]) < 0.01) pre.pop();
      coords.unshift(...pre);
      startM = ch.meters;
    }
  }
  for (const [si, m] of usedLen) {
    if (m >= Math.min(25, graph.segs[si].len * 0.5)) res.usedSegs.add(si);
  }
  res.stats.extStart = Math.round(startM);
  res.stats.extEnd = Math.round(endM);
  return { head, tail, startM: Math.round(startM), endM: Math.round(endM) };
}
