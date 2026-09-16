# Arad Public Transport — interactive map

Interactive, poster-grade map of the public transport network of **Arad**:
the eight city tram lines of **CTP Arad** and its seventeen bus services —
**25 lines, 382 km of route drawn along the real track and street geometry**,
line numbers written parallel to every roadway they use, labelled stops and
terminus boxes.

## Live

Not published — this map is built and reviewed locally
(`npm run serve`, port 8196).

## The feed: written, not downloaded

**There is no Arad GTFS anywhere.** The city does not publish one, the
MobilityDatabase and Transitous do not carry it, and `external.gtfs.ro` — the
Romanian feed host behind the Oradea, Cluj, Constanța and Iași maps — has no
Arad dataset. So `pipeline/arad-feed.mjs` writes a complete feed, with real
departure times, out of three public sources:

| source | what it gives | file |
|---|---|---|
| **Anexa 17** (annex to the city's public-transport contract, `Amplasamentul stațiilor de tramvai și autobuz`) | 323 stop poles: name, address, direction served, WGS84 coordinates — 126 city tram, 21 interurban tram, 176 bus | `data/src/anexa17-statii.xlsx` |
| **TRASEE URBANE** (the urban route schedule) | the stop list of all 25 urban lines, one column per line, both directions under each other | `data/src/trasee-urbane.xlsx` |
| **coordonate GPS** (a second file from the client) | the four coordinates the scan of Anexa 17 had cut off — Tarafului, Păpădiei, Cibinului, Faurilor — read from the original | `data/src/coordonate-gps.docx` |
| **ctparad.ro timetables** (a BusMan HTML export) | departure times — per line, per direction, per stop, for weekdays, Saturdays, Sundays and holidays, with the lettered footnotes that mark short workings | `data/src/programe/` |
| **CTP's passenger planner** (Telelink City, the platform behind the Burgas map) | coordinates for the poles Anexa 17 does not list, and an encoded polyline per pattern → `shapes.txt` | `data/src/telelink/` |

Both spreadsheets came from the client as `.xlsx`; `pipeline/lib/xlsx.mjs` is a
60-line reader (ZIP central directory + `inflateRaw` + sharedStrings) so the
pipeline needs no spreadsheet dependency.

**The two spreadsheets and the operator's own timetables agree stop for stop**
— all 25 lines, every name. Anexa 17 is evidently a transcript of the same
source, and each verifies the other.

### Trips are reconstructed, times are real

BusMan publishes a departure grid per stop, not a list of runs, so
`arad-feed.mjs` chases each departure along the route: the 05:30 off Piața
Romană becomes the 05:33 at Teatru, the 05:35 at Primărie and so on to Făt
Frumos, consuming each time it takes. Lettered departures (`A - Spre: Piata
U.T.A.`) are short workings and end where the footnote says; `circulă numai în
zilele de sâmbătă` / `de duminică` become their own service days.

Result: **1 722 trips / 25 231 stop_times** across four services (L = Mon–Fri,
S = Saturday, D = Sunday, SD = holidays), from 23 687 published departures —
**0.4 % of them are left unclaimed** by any run, which is the honest error bar
on the reconstruction.

**The invented numbers carry `timepoint=0`.** BusMan prints departures, so the
stop where a run ENDS has no time — neither the terminus nor the turn-back of a
short working. There the feed adds the last leg's running time, computed from
that run's own pace over its own stop spacing (1 567 stop_times). And in some
directions BusMan prints only part of the stops: line 60 back from Concordiei
lists Călțunaș, Anton Pann, Faurilor, Mănăstire Gai and Izvor as bare names
without a timetable page. The bus serves them (Anexa 17 has the return poles),
so the run keeps them with times interpolated by distance between the printed
neighbours (68 stop_times). Both kinds are `timepoint=0` in `stop_times.txt`
and never appear on a departure board; every other time is the operator's.

## What the sources got wrong (and how it was repaired)

* **Two pairs of coordinates are swapped in the scan.** The spreadsheet's own
  `Info` sheet flags one (`UM 2` ↔ `Universitate 1` — UM 2 was given a point in
  Micălaca, 8 km from the military unit it is named after). The second pair is
  not flagged: **`RAR` ↔ `Piața Auto`**. Line 1b runs Băile Termale → RAR → UM
  → Piața Auto → Platforma Vest, due west; with the spreadsheet's coordinates
  that sequence doubles back on itself twice. The planner places both poles
  exactly the other way round. Both pairs are swapped back in `SWAP`.
* **Five poles have one digit misread.** `Primărie 2` reads 46.16679 instead
  of 46.17679 and lands on Piața Romană, 900 m from the city hall it is named
  after; `Simion Bărnuțiu` reads 21.32008 for 21.31008; `Budai Deleanu`,
  `Caraiman` (nr. 45) and the tram pole `Aris 1` each have one decimal wrong.
  The feed only moves a pole when the evidence is exactly that shape: changing
  ONE decimal digit of one coordinate brings it within 60 m of a witness — a
  planner stop of the same name that no other pole of that name claims, or
  (Aris 1) another Anexa pole with the very same street address, the bus pole
  `Aris`, `str. Cocorilor nr. 48`, which the tram pole's coordinates missed by
  232 m. The three Sâmbăteni poles, which sit 630 m from the planner's but are
  not a digit slip, are left alone and reported.
* **Three poles stand on the wrong street.** `Caraiman` nr. 38 is placed 100 m
  west of Calea Timișorii, on Constituției; the tram poles `Electrometal 1` and
  `Fortuna 2` are placed 47 and 45 m from the track, on the housing block their
  address names. A bus pole whose nearest named road is not the street in its
  own address, or a tram pole more than 40 m from any track, takes the planner's
  point for that stop — but only a free one (no other pole of that name within
  20 m), on the address street or on the track, within 200 m. Twelve more poles
  that failed only the first test kept their point, because the planner's stop
  was another pole's twin (`Liviu Rebreanu`, `Podgoria`, `Independenței`…).
* **Anexa 17 calls the bus stop `Caraiman` and the tram stop `Caraimanul`**; the
  timetables say `Caraimanul` for both. One alias, so that buses 19 and 49
  stand at the bus poles on Calea Timișorii, not at the tram platforms.
* **Four longitudes are cut off on the scan** (Cibinului, Faurilor, Tarafului,
  Păpădiei — the spreadsheet says so in its notes column). The client's second
  file, `coordonate GPS.docx`, carries all four; the planner's positions for the
  same poles agree with it to within 3 m.
* **Three stops exist in no inventory at all** — `Vezuviului` (line 31),
  `Calea Timișorii` (line 49) and `Horia` (the line 13 terminus). They are
  placed from OSM geometry: the middle of the street of that name, and the
  `place=village` node for Horia. These three are the only approximate
  positions in the feed (`EXTRA` in `arad-feed.mjs`).
* **`Indagrara` is the old name of the Galleria 1/2 pole pair.** The timetables
  still print it, Anexa 17 has renamed it, OSM still has an `Indagrara` node at
  those coordinates. The map uses Anexa 17's names throughout, so lines 1b and
  6 call at "Galleria 1/2" and then at the roundabout pair "Galleria 3/4".

## Stop names

Anexa 17 numbers the poles of a stop — `Podgoria 2`, `Podgoria 3`, `Podgoria 6`
— but the flag on the street says `Podgoria`. So the number is dropped from the
printed name wherever the poles of a name stand together (within 250 m), and
kept where it really separates places: `Renașterii 1–4` spread over 726 m of
Calea Radnei, `Galleria 1/2` and `3/4` are two pairs either side of the mall
roundabout, and so are `Voinicilor` and `Paul Chinezul`. 115 poles print a bare
name, 30 keep their number. The pole number stays in `stop_code` either way.

## Lines

**Trams (route_type 0, family red):** 1, 1b, 3, 6, 7, 15, 16, 18b. Lines 7 and
18b are the same big loop run in opposite directions. Line 1 currently runs
almost entirely as a short working to Piața U.T.A. — one full run a day in each
direction, which is exactly what its timetable says.

**Buses (route_type 3, family navy):** 13, 19, 21, 31, 39b, 41, 46, 48, 49,
49b, 52, 54, 60, plus four services CTP lists in its **tram** catalogue but
runs with buses (their timetable pages are prefixed `AUTOBUZ:`):

* **7A** and **18A** — the two directions of the Micălaca loop;
* **Vladimirescu** and **Ghioroc** — the old **interurban tramway** to the
  Ghioroc vineyards, 22 km east. The track is still there (and still in this
  map's OSM rail extract), the stops are the ones in Anexa 17's "suburban tram"
  sheet, but the service runs on DN7 by bus, so the feed draws it on the road
  graph in navy. These two print their name, not a number, because that is all
  the operator gives them.

**Line 48 is one circuit, not four legs.** BusMan splits it into Billa → ANL,
ANL → Real, Real → ANL, ANL → Billa; the times chain straight through
(Billa 05:34 → ANL 05:46 → Real → ANL 05:56 → Billa 06:00), so the feed merges
blocks that close a loop into a single run. Without that, half the route would
have no trip along its whole length and would not be drawn.

**Line 13 (Arad – Horia) has two stops.** Podgoria and Horia, 12 km apart, and
nothing in between — that is the whole timetable the operator publishes, and
the planner has no pattern for the line either. Its shape is the one hand-kept
file in the feed, `data/src/line13-shape.geojson`: Podgoria → Calea Radnei →
Strada Șiriei → DJ709 → Horia (Strada Ferdinand I), 24 waypoints, the return
direction its reverse; the road graph draws the roundabouts and one-way
carriageways along it. Every trip of every line now carries a `shape_id`.

## Departure boards

Because the feed carries the operator's own times, every pole on the map has
its board: click a stop and the popup lists, per line and direction, the
published minutes in hour rows — Mon–Fri, Saturday, Sunday side by side
(`pipeline/timetables.mjs` → `data/out/timetables.json`, 266 poles, 563
line-and-direction boards, 23 441 departures). The times the feed invents
(`timepoint=0`: arrivals at the end of a run, interpolated calls at stops
without a page) are on no board: a board lists what the operator prints. Where
Anexa 17 gives two poles the same point (Cicir 1/2, Mândruloc 1/2 on the DN7),
a click shows both poles' boards together.

## The drawn line follows the shape — and reaches every pole

The QA layer ("show raw GTFS shapes") draws the planner's polylines in red;
the built network follows them to within the road width everywhere the
polyline describes a road (`pipeline/shape-check.mjs` samples every shape
every 15 m against the drawn network and the drawn network against the shape,
and lists every turnaround inside a run and every loose stub). What remains
off the shape is the shape's own doing: the 49b polyline crosses the Mureș as a
straight chord 100 m east of Podul Andrei Șaguna, and the map draws the
bridge; the 19 polyline cuts a corner at Podgoria. The only turnaround the
checker still reports is the 4 m mini-roundabout at Bumbacului, which is real.

Three rounds of review against the map itself, line by line, went into that:

* **Car-park aisles are in the road graph**, with the driveway penalty. Line
  48 serves Selgros and Real inside their car parks and the Ghioroc bus calls
  at La Cocoș on the same lot; with `service=parking_aisle` excluded the route
  broke into stubs there.
* **A spur to a stop is kept only when the through road does not already pass
  the pole.** The planner's polyline touches every stop point and comes back,
  which on a stop set 15 m into a side street drew a 50 m out-and-back (48 at
  ANL). The matcher now tests the direct route: if every stop at the spur's tip
  is still within 25 m of it, the spur goes. Frăției on line 48 (a stop the
  planner does not know at all — the feed inserts it into the shape between
  Felix and Renașterii, replacing the planner's vertices between the two, and
  `LINE_VIA` adds the two waypoints that send the bus down Strada Felix to its
  end and along Strada Frăției, not through Vaslui) and the Via Carmina bay
  off the DN7 (150 m) stay, and the bus leaves a spur stop by the far end of
  its street rather than reversing.
* **The shape reaches the terminus pole.** The planner's polylines end in the
  middle of the junction — 35–120 m short of the Podgoria poles, 86 m short of
  DN 7, 55 m short of the Real car park, 111 m short of the Făt Frumos tram
  loop. The first and last pole of each block is prepended/appended to the
  shape, unless the polyline already passes within 30 m of it in its first or
  last 800 m (line 7 leaves the Piața Romană loop by its exit pole; extending
  it would have drawn the loop twice).
* **Which pole of a pair: Anexa 17's own `Kierunek (sens)` column decides.**
  The planner's stop coordinates hint which pole a direction uses, but its two
  Călărașilor stops were crossed; when a pair of poles ≤80 m apart has one
  facing the direction of travel and one facing back, the sheet's direction
  outweighs the hint. A step backwards along the route costs extra (line 18A
  was picking line 48's `Renașterii` pole 100 m behind Grădinița), the last
  stop of a direction ignores the departure direction altogether (arrival at
  Podgoria is the loop, whichever way the pole's departures point), trams use
  tram poles and buses bus poles, and the two directions of a line never share
  a pole where the sheet has two.
* **`pipeline/line-audit.mjs` looks at every line on its own**, the way the
  Lines view shows it: stops projected along the drawn route in order (a pole
  out of order, more than 30 m off, or on the LEFT of the direction of travel),
  and every turnaround with what it reaches. What it still lists is the data:
  tram platforms in the median of Calea Radnei are "on the left" of the buses
  7A/18A/Ghioroc that use them, the DN7 pairs have one coordinate for both
  poles in Anexa 17, and a handful of poles are 20–45 m off their street in the
  sheet (Liviu Rebreanu nr. 27, Bela Bartók nr. 3, Brâncoveanu nr. 2, Posada,
  Galleria 4) — drawn snapped to the line, kept as given in the feed.

## Build

```
npm run download   # timetables + planner + OSM (Overpass), then writes data/gtfs
npm run build      # -- all --tram all, then the departure boards
npm run lines      # the per-line view
node pipeline/shape-check.mjs   # drawn network vs the feed's shapes, turnarounds, stubs
node pipeline/stops-check.mjs   # shared poles, poles far from the drawn line
node pipeline/line-audit.mjs    # every line on its own: order, side, distance, turnarounds
npm run serve      # http://localhost:8196
```

* **OSM** comes from Overpass in two cuts — roads and tram tracks — over
  46.10–46.29 N / 21.20–21.63 E (`pipeline/download.sh`). `overpass-api.de`
  answers 406 without a User-Agent, so the script sends one.
* **Matching**: 47 directions, 382 km, **weighted mean error 3.36 m**, worst
  8.9 m. 6 949 road ways → a 38 986-node graph; 283 tram ways → 2 658 nodes.
* **Audit** (`npm run audit`): clean — 0 lines drawn short, 0 torn ends,
  0 doubles, 0 roadways without their numbers, 0 broken routes, fidelity
  0.00 % of samples more than 5 m off their roadway.
* **Terminus badge cells are now as wide as their label.** The grid used a
  fixed 3.4 em cell, which is right for `21` and `39b` and far too narrow for
  `Ghioroc` and `Vladimirescu` — at Podgoria, the city's main terminus, the two
  boxes sat on top of each other. Short numbers keep the old spacing.
* `feed.trustDir` (in `build.mjs`) tells the engine to group by `direction_id`
  even where a line has only one: the directions here come from the timetable's
  own blocks, and without it the loop lines (7, 18b, 48, 52) would split into as
  many "directions" as their short workings have end points.

## Data

Timetables and planner: CTP Arad (`ctparad.ro`, `arad-transport.telelink.city`).
Stop inventory: Anexa 17. Base map: OpenStreetMap / OpenFreeMap.
