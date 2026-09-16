#!/usr/bin/env bash
# Pobiera wsad: rozkłady i planner CTP Arad (ctp-scrape.mjs), OSM przez
# Overpassa, MapLibre GL. Wszystko jest cache'owane — powtórny bieg dociąga
# tylko to, czego brakuje.
#
# GTFS-a Aradu nie ma. Miasto nie publikuje feedu, nie ma go w Mobility
# Database ani w Transitous, a external.gtfs.ro obsługuje Oradeę, Kluż,
# Konstancę i Jassy — Aradu nie. Feed pod data/gtfs pisze więc
# pipeline/arad-feed.mjs z trzech rzeczy: arkuszy zamawiającego w data/src
# (Anexa 17 = 323 słupki ze współrzędnymi, TRASEE URBANE = trasy 25 linii),
# rozkładów operatora z ctparad.ro i plannera pasażerskiego CTP na platformie
# Telelink City (ten sam silnik co w Burgasie).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm data/src web/vendor

# Pobrany wycinek jest przyjmowany dopiero wtedy, gdy PARSUJE SIĘ i ma sensowną
# liczbę elementów. `grep -q '"elements"'` przepuszczał ucięte odpowiedzi
# (Braszów, 16.08.2026: 65 kB fragmentu uznane za komplet).
UA="transit-maps/1.0 (github.com/Miqell24)"   # overpass-api.de oddaje 406 bez User-Agenta

ok_json () { # $1=plik  $2=minimalna liczba elementów
  python3 - "$1" "$2" <<'PYEOF' 2>/dev/null
import json, sys
try:
    sys.exit(0 if len(json.load(open(sys.argv[1])).get("elements", [])) >= int(sys.argv[2]) else 1)
except Exception:
    sys.exit(1)
PYEOF
}

# Słupki stoją w kadrze 46.131–46.253 N / 21.238–21.594 E (Ghioroc na wschodzie,
# Ceala na zachodzie, pętla linii 13 w Horii). Ramka ma ~2 km zapasu, żeby trasa
# nie wybiegła poza graf przy krawędzi.
BB_S=46.10; BB_W=21.20; BB_N=46.29; BB_E=21.63

# 1) GTFS — pisany, nie pobierany. Arkusze muszą leżeć w data/src.
if [ ! -f data/src/anexa17-statii.xlsx ] || [ ! -f data/src/trasee-urbane.xlsx ]; then
  echo "brak arkuszy źródłowych w data/src (anexa17-statii.xlsx, trasee-urbane.xlsx)" >&2
  exit 1
fi
if [ ! -f data/src/programe/index.json ]; then
  echo "== rozkłady CTP Arad + planner Telelink -> data/src =="
  node pipeline/ctp-scrape.mjs
fi
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== arkusze + rozkłady -> data/gtfs =="
  node pipeline/arad-feed.mjs
fi

# 2) OSM — jezdnie. Kadr 21 × 33 km, poza miastem rzadko zabudowany, więc
#    mieści się w jednym zapytaniu.
if [ ! -f data/osm/arad.json ]; then
  echo "== Overpass (jezdnie) =="
  QR="[out:json][timeout:900];way($BB_S,$BB_W,$BB_N,$BB_E)[\"highway\"~\"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|busway|construction|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$\"];out geom;"
  ok=0
  # overpass-api.de pierwszy: lżejsze lustra bywały przyłapane na starej bazie
  for EP in "https://overpass-api.de/api/interpreter" \
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
            "https://overpass.kumi.systems/api/interpreter"; do
    echo "-- $EP"
    if curl -fsS -A "$UA" --max-time 900 -o data/osm/arad.json --data-urlencode "data=$QR" "$EP" \
       && ok_json "data/osm/arad.json" 2000; then
      ok=1; break
    fi
    sleep 5
  done
  [ "$ok" = 1 ] || { echo "Overpass (jezdnie): wszystkie lustra padły" >&2; exit 1; }
fi

# 2b) OSM — torowiska tramwajowe. `disused` i `construction` idą specjalnie:
#     OSM spóźnia się z ponownym otwarciem odcinków, a Arad ma jeszcze tor
#     podmiejski do Ghioroca, po którym dziś jeżdżą autobusy. Patrz railKind()
#     w pipeline/lib/graph.mjs.
if [ ! -f data/osm/arad-rail.json ]; then
  echo "== Overpass (torowiska) =="
  QT="[out:json][timeout:300];way($BB_S,$BB_W,$BB_N,$BB_E)[\"railway\"~\"^(tram|construction|disused)$\"];out geom;"
  ok=0
  for EP in "https://overpass-api.de/api/interpreter" \
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
            "https://overpass.kumi.systems/api/interpreter"; do
    echo "-- $EP"
    if curl -fsS -A "$UA" --max-time 300 -o data/osm/arad-rail.json --data-urlencode "data=$QT" "$EP" \
       && ok_json "data/osm/arad-rail.json" 40; then
      ok=1; break
    fi
    sleep 5
  done
  [ "$ok" = 1 ] || { echo "Overpass (torowiska): wszystkie lustra padły" >&2; exit 1; }
fi

# 3) MapLibre GL (lokalnie, bez CDN-a w czasie działania)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — dane gotowe:"
du -sh data/gtfs data/osm data/src 2>/dev/null || true
