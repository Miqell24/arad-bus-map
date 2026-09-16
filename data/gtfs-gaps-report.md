# Gap report for shapes.txt — Arad public transport GTFS

- **Feed:** transit-maps — Anexa 17 + TRASEE URBANE + rozkłady CTP Arad, version `20260916` (valid 20260916–?), contact: —
- **Generated:** 16/09/2026, 10:25 by the `arad-bus-map` pipeline
- **Gap definition:** a pair of adjacent `shapes.txt` points more than 200 m apart in a straight line — the trace "jumps" instead of following the roadway (the GTFS spec requires shapes to trace the actual travel path).
- **Scope:** all 42 shapes used by trips in the feed.

## Summary

| | |
|---|---|
| gaps > 200 m in total (across all route variants) | **459** |
| unique locations after grouping (250 m radius) | **153** |
| lines affected | **24** |
| longest gap | **2288 m** |

Gaps cluster where infrastructure changed (construction sites, detours, new roads,
loops on closed premises) — this looks like holes in the geometric base layer of the
system that generates shapes, replicated into every run through a given corridor.

## Locations (longest gap first)

"Vicinity" is the nearest named OpenStreetMap street (approximate). "Variants" — the
number of shapes with a gap at this location. Links open the spot for manual checking.

| # | max [m] | vicinity | lines | variants | position |
|---|---|---|---|---|---|
| 1 | 2288 | — | Ghioroc | 1 | 46.14553, 21.49553 [OSM](https://www.openstreetmap.org/?mlat=46.14553&mlon=21.49553#map=17/46.14553/21.49553) · [Google](https://www.google.com/maps?q=46.14553,21.49553) |
| 2 | 1458 | — | Ghioroc | 1 | 46.14522, 21.50130 [OSM](https://www.openstreetmap.org/?mlat=46.14522&mlon=21.50130#map=17/46.14522/21.50130) · [Google](https://www.google.com/maps?q=46.14522,21.50130) |
| 3 | 1374 | Podul Andrei Șaguna | 49b | 2 | 46.15991, 21.30011 [OSM](https://www.openstreetmap.org/?mlat=46.15991&mlon=21.30011#map=17/46.15991/21.30011) · [Google](https://www.google.com/maps?q=46.15991,21.30011) |
| 4 | 1160 | — | Ghioroc | 2 | 46.14203, 21.53769 [OSM](https://www.openstreetmap.org/?mlat=46.14203&mlon=21.53769#map=17/46.14203/21.53769) · [Google](https://www.google.com/maps?q=46.14203,21.53769) |
| 5 | 1150 | Strada Ion Luca Caragiale | 21, 41, 46, 49b, 54, 60 | 12 | 46.17632, 21.30681 [OSM](https://www.openstreetmap.org/?mlat=46.17632&mlon=21.30681#map=17/46.17632/21.30681) · [Google](https://www.google.com/maps?q=46.17632,21.30681) |
| 6 | 1064 | — | Ghioroc | 2 | 46.15217, 21.56749 [OSM](https://www.openstreetmap.org/?mlat=46.15217&mlon=21.56749#map=17/46.15217/21.56749) · [Google](https://www.google.com/maps?q=46.15217,21.56749) |
| 7 | 1049 | — | Ghioroc | 2 | 46.14617, 21.54610 [OSM](https://www.openstreetmap.org/?mlat=46.14617&mlon=21.54610#map=17/46.14617/21.54610) · [Google](https://www.google.com/maps?q=46.14617,21.54610) |
| 8 | 965 | — | Ghioroc | 2 | 46.15348, 21.44243 [OSM](https://www.openstreetmap.org/?mlat=46.15348&mlon=21.44243#map=17/46.15348/21.44243) · [Google](https://www.google.com/maps?q=46.15348,21.44243) |
| 9 | 957 | Strada Ștefan cel Mare | 3, 19, 49b | 6 | 46.14522, 21.32744 [OSM](https://www.openstreetmap.org/?mlat=46.14522&mlon=21.32744#map=17/46.14522/21.32744) · [Google](https://www.google.com/maps?q=46.14522,21.32744) |
| 10 | 928 | — | Ghioroc | 2 | 46.14334, 21.51582 [OSM](https://www.openstreetmap.org/?mlat=46.14334&mlon=21.51582#map=17/46.14334/21.51582) · [Google](https://www.google.com/maps?q=46.14334,21.51582) |
| 11 | 878 | Calea Iuliu Maniu | 19, Ghioroc | 2 | 46.18066, 21.33863 [OSM](https://www.openstreetmap.org/?mlat=46.18066&mlon=21.33863#map=17/46.18066/21.33863) · [Google](https://www.google.com/maps?q=46.18066,21.33863) |
| 12 | 799 | — | Ghioroc | 2 | 46.15138, 21.45132 [OSM](https://www.openstreetmap.org/?mlat=46.15138&mlon=21.45132#map=17/46.15138/21.45132) · [Google](https://www.google.com/maps?q=46.15138,21.45132) |
| 13 | 772 | Aleea Plajei | Ghioroc | 2 | 46.15393, 21.57907 [OSM](https://www.openstreetmap.org/?mlat=46.15393&mlon=21.57907#map=17/46.15393/21.57907) · [Google](https://www.google.com/maps?q=46.15393,21.57907) |
| 14 | 759 | Strada Roșiorilor | 1, 18b, 3, 6, 7, 15 | 10 | 46.19101, 21.31391 [OSM](https://www.openstreetmap.org/?mlat=46.19101&mlon=21.31391#map=17/46.19101/21.31391) · [Google](https://www.google.com/maps?q=46.19101,21.31391) |
| 15 | 742 | — | Ghioroc | 2 | 46.14984, 21.55626 [OSM](https://www.openstreetmap.org/?mlat=46.14984&mlon=21.55626#map=17/46.14984/21.55626) · [Google](https://www.google.com/maps?q=46.14984,21.55626) |
| 16 | 708 | Strada Andrei Șaguna | 41, 46, 49b, 54, 60 | 8 | 46.16900, 21.30316 [OSM](https://www.openstreetmap.org/?mlat=46.16900&mlon=21.30316#map=17/46.16900/21.30316) · [Google](https://www.google.com/maps?q=46.16900,21.30316) |
| 17 | 702 | — | 54 | 2 | 46.16841, 21.25629 [OSM](https://www.openstreetmap.org/?mlat=46.16841&mlon=21.25629#map=17/46.16841/21.25629) · [Google](https://www.google.com/maps?q=46.16841,21.25629) |
| 18 | 696 | Calea Aurel Vlaicu | 1, 18b, 3, 6, 15 | 5 | 46.19676, 21.29875 [OSM](https://www.openstreetmap.org/?mlat=46.19676&mlon=21.29875#map=17/46.19676/21.29875) · [Google](https://www.google.com/maps?q=46.19676,21.29875) |
| 19 | 682 | Strada Dunării | 6, 60 | 4 | 46.20842, 21.27862 [OSM](https://www.openstreetmap.org/?mlat=46.20842&mlon=21.27862#map=17/46.20842/21.27862) · [Google](https://www.google.com/maps?q=46.20842,21.27862) |
| 20 | 676 | Strada Dorobanților | 54 | 2 | 46.16929, 21.29706 [OSM](https://www.openstreetmap.org/?mlat=46.16929&mlon=21.29706#map=17/46.16929/21.29706) · [Google](https://www.google.com/maps?q=46.16929,21.29706) |
| 21 | 675 | Calea Iuliu Maniu | 18A, 19, 7A, Ghioroc, Vladimirescu | 8 | 46.18176, 21.32932 [OSM](https://www.openstreetmap.org/?mlat=46.18176&mlon=21.32932#map=17/46.18176/21.32932) · [Google](https://www.google.com/maps?q=46.18176,21.32932) |
| 22 | 663 | Ion Paulat | Ghioroc | 2 | 46.14711, 21.46948 [OSM](https://www.openstreetmap.org/?mlat=46.14711&mlon=21.46948#map=17/46.14711/21.46948) · [Google](https://www.google.com/maps?q=46.14711,21.46948) |
| 23 | 636 | Strada Progresului | Ghioroc, Vladimirescu | 4 | 46.16466, 21.40140 [OSM](https://www.openstreetmap.org/?mlat=46.16466&mlon=21.40140#map=17/46.16466/21.40140) · [Google](https://www.google.com/maps?q=46.16466,21.40140) |
| 24 | 619 | — | Ghioroc | 2 | 46.13996, 21.52788 [OSM](https://www.openstreetmap.org/?mlat=46.13996&mlon=21.52788#map=17/46.13996/21.52788) · [Google](https://www.google.com/maps?q=46.13996,21.52788) |
| 25 | 617 | Calea Aurel Vlaicu | 1b | 2 | 46.20169, 21.26451 [OSM](https://www.openstreetmap.org/?mlat=46.20169&mlon=21.26451#map=17/46.20169/21.26451) · [Google](https://www.google.com/maps?q=46.20169,21.26451) |
| 26 | 612 | Strada Petru Rareș | 15, 16 | 4 | 46.19747, 21.33656 [OSM](https://www.openstreetmap.org/?mlat=46.19747&mlon=21.33656#map=17/46.19747/21.33656) · [Google](https://www.google.com/maps?q=46.19747,21.33656) |
| 27 | 601 | Strada Combinatului | Ghioroc, Vladimirescu | 4 | 46.15770, 21.42511 [OSM](https://www.openstreetmap.org/?mlat=46.15770&mlon=21.42511#map=17/46.15770/21.42511) · [Google](https://www.google.com/maps?q=46.15770,21.42511) |
| 28 | 597 | Calea Victoriei | 19, 46, 49b, 60 | 5 | 46.18387, 21.30956 [OSM](https://www.openstreetmap.org/?mlat=46.18387&mlon=21.30956#map=17/46.18387/21.30956) · [Google](https://www.google.com/maps?q=46.18387,21.30956) |
| 29 | 585 | — | 54 | 2 | 46.16826, 21.24793 [OSM](https://www.openstreetmap.org/?mlat=46.16826&mlon=21.24793#map=17/46.16826/21.24793) · [Google](https://www.google.com/maps?q=46.16826,21.24793) |
| 30 | 572 | Strada Episcop Roman Ciorogariu | 21 | 2 | 46.17919, 21.30069 [OSM](https://www.openstreetmap.org/?mlat=46.17919&mlon=21.30069#map=17/46.17919/21.30069) · [Google](https://www.google.com/maps?q=46.17919,21.30069) |
| 31 | 570 | Calea Radnei | 18A, 7A, Ghioroc, Vladimirescu | 6 | 46.17825, 21.35268 [OSM](https://www.openstreetmap.org/?mlat=46.17825&mlon=21.35268#map=17/46.17825/21.35268) · [Google](https://www.google.com/maps?q=46.17825,21.35268) |
| 32 | 547 | Ciprian Porumbescu | Ghioroc | 2 | 46.14607, 21.47714 [OSM](https://www.openstreetmap.org/?mlat=46.14607&mlon=21.47714#map=17/46.14607/21.47714) · [Google](https://www.google.com/maps?q=46.14607,21.47714) |
| 33 | 547 | Strada Progresului | Ghioroc, Vladimirescu | 2 | 46.16199, 21.40942 [OSM](https://www.openstreetmap.org/?mlat=46.16199&mlon=21.40942#map=17/46.16199/21.40942) · [Google](https://www.google.com/maps?q=46.16199,21.40942) |
| 34 | 540 | Calea Bodrogului | 54 | 2 | 46.16857, 21.26436 [OSM](https://www.openstreetmap.org/?mlat=46.16857&mlon=21.26436#map=17/46.16857/21.26436) · [Google](https://www.google.com/maps?q=46.16857,21.26436) |
| 35 | 536 | Strada Paltinului | 1, 18b, 3, 6, 7, 15 | 6 | 46.19335, 21.30498 [OSM](https://www.openstreetmap.org/?mlat=46.19335&mlon=21.30498#map=17/46.19335/21.30498) · [Google](https://www.google.com/maps?q=46.19335,21.30498) |
| 36 | 526 | Strada Câmpurilor | 46 | 2 | 46.21625, 21.28580 [OSM](https://www.openstreetmap.org/?mlat=46.21625&mlon=21.28580#map=17/46.21625/21.28580) · [Google](https://www.google.com/maps?q=46.21625,21.28580) |
| 37 | 524 | Strada Renașterii | 18A, 7A | 2 | 46.17352, 21.35925 [OSM](https://www.openstreetmap.org/?mlat=46.17352&mlon=21.35925#map=17/46.17352/21.35925) · [Google](https://www.google.com/maps?q=46.17352,21.35925) |
| 38 | 510 | Centura Arad Est | Ghioroc | 2 | 46.15566, 21.43339 [OSM](https://www.openstreetmap.org/?mlat=46.15566&mlon=21.43339#map=17/46.15566/21.43339) · [Google](https://www.google.com/maps?q=46.15566,21.43339) |
| 39 | 502 | Strada Vrabiei | 18b | 1 | 46.18698, 21.30175 [OSM](https://www.openstreetmap.org/?mlat=46.18698&mlon=21.30175#map=17/46.18698/21.30175) · [Google](https://www.google.com/maps?q=46.18698,21.30175) |
| 40 | 496 | Strada Câmpurilor | 46 | 2 | 46.21970, 21.28141 [OSM](https://www.openstreetmap.org/?mlat=46.21970&mlon=21.28141#map=17/46.21970/21.28141) · [Google](https://www.google.com/maps?q=46.21970,21.28141) |
| 41 | 488 | Strada Petru Rareș | 15, 16, 31 | 5 | 46.19352, 21.33225 [OSM](https://www.openstreetmap.org/?mlat=46.19352&mlon=21.33225#map=17/46.19352/21.33225) · [Google](https://www.google.com/maps?q=46.19352,21.33225) |
| 42 | 483 | Calea Zimandului | 15, 16 | 2 | 46.20136, 21.34091 [OSM](https://www.openstreetmap.org/?mlat=46.20136&mlon=21.34091#map=17/46.20136/21.34091) · [Google](https://www.google.com/maps?q=46.20136,21.34091) |
| 43 | 478 | Calea Radnei | Ghioroc | 1 | 46.17478, 21.36868 [OSM](https://www.openstreetmap.org/?mlat=46.17478&mlon=21.36868#map=17/46.17478/21.36868) · [Google](https://www.google.com/maps?q=46.17478,21.36868) |
| 44 | 465 | Strada Andrei Șaguna | 21, 41, 46, 49b, 54, 60 | 11 | 46.17943, 21.30850 [OSM](https://www.openstreetmap.org/?mlat=46.17943&mlon=21.30850#map=17/46.17943/21.30850) · [Google](https://www.google.com/maps?q=46.17943,21.30850) |
| 45 | 465 | Piața Academician Caius Iacob | 1, 18b, 3, 6, 7, 16, 19 | 7 | 46.18261, 21.32560 [OSM](https://www.openstreetmap.org/?mlat=46.18261&mlon=21.32560#map=17/46.18261/21.32560) · [Google](https://www.google.com/maps?q=46.18261,21.32560) |
| 46 | 462 | Strada Mihail Kogălniceanu | 18b, 7, 41 | 3 | 46.16672, 21.30484 [OSM](https://www.openstreetmap.org/?mlat=46.16672&mlon=21.30484#map=17/46.16672/21.30484) · [Google](https://www.google.com/maps?q=46.16672,21.30484) |
| 47 | 461 | Strada Libertății | 41 | 2 | 46.18954, 21.29515 [OSM](https://www.openstreetmap.org/?mlat=46.18954&mlon=21.29515#map=17/46.18954/21.29515) · [Google](https://www.google.com/maps?q=46.18954,21.29515) |
| 48 | 458 | Strada Sălcuța | 39b | 1 | 46.21066, 21.32052 [OSM](https://www.openstreetmap.org/?mlat=46.21066&mlon=21.32052#map=17/46.21066/21.32052) · [Google](https://www.google.com/maps?q=46.21066,21.32052) |
| 49 | 456 | Deviere DN7 | Ghioroc, Vladimirescu | 4 | 46.17059, 21.38362 [OSM](https://www.openstreetmap.org/?mlat=46.17059&mlon=21.38362#map=17/46.17059/21.38362) · [Google](https://www.google.com/maps?q=46.17059,21.38362) |
| 50 | 456 | Calea Radnei | Ghioroc, Vladimirescu | 4 | 46.17606, 21.36290 [OSM](https://www.openstreetmap.org/?mlat=46.17606&mlon=21.36290#map=17/46.17606/21.36290) · [Google](https://www.google.com/maps?q=46.17606,21.36290) |
| 51 | 453 | Bulevardul Revoluției | 1, 18b, 7 | 3 | 46.17453, 21.31759 [OSM](https://www.openstreetmap.org/?mlat=46.17453&mlon=21.31759#map=17/46.17453/21.31759) · [Google](https://www.google.com/maps?q=46.17453,21.31759) |
| 52 | 446 | Strada Profesor Doctor Aurel Ardelean | 18b, 7, 21 | 3 | 46.17842, 21.29576 [OSM](https://www.openstreetmap.org/?mlat=46.17842&mlon=21.29576#map=17/46.17842/21.29576) · [Google](https://www.google.com/maps?q=46.17842,21.29576) |
| 53 | 440 | Calea Bodrogului | 54 | 2 | 46.16873, 21.27325 [OSM](https://www.openstreetmap.org/?mlat=46.16873&mlon=21.27325#map=17/46.16873/21.27325) · [Google](https://www.google.com/maps?q=46.16873,21.27325) |
| 54 | 438 | Strada Independenței | 41 | 1 | 46.19300, 21.27970 [OSM](https://www.openstreetmap.org/?mlat=46.19300&mlon=21.27970#map=17/46.19300/21.27970) · [Google](https://www.google.com/maps?q=46.19300,21.27970) |
| 55 | 435 | Calea Timișorii | 49b | 2 | 46.14298, 21.32138 [OSM](https://www.openstreetmap.org/?mlat=46.14298&mlon=21.32138#map=17/46.14298/21.32138) · [Google](https://www.google.com/maps?q=46.14298,21.32138) |
| 56 | 425 | Strada Mircea Stănescu | 1, 18b, 3, 6, 7, 16 | 10 | 46.18039, 21.32128 [OSM](https://www.openstreetmap.org/?mlat=46.18039&mlon=21.32128#map=17/46.18039/21.32128) · [Google](https://www.google.com/maps?q=46.18039,21.32128) |
| 57 | 423 | Strada OST | Ghioroc | 1 | 46.14558, 21.48909 [OSM](https://www.openstreetmap.org/?mlat=46.14558&mlon=21.48909#map=17/46.14558/21.48909) · [Google](https://www.google.com/maps?q=46.14558,21.48909) |
| 58 | 422 | Strada Ioan Moldovan | 19, 46, 49b, 60 | 4 | 46.18842, 21.31020 [OSM](https://www.openstreetmap.org/?mlat=46.18842&mlon=21.31020#map=17/46.18842/21.31020) · [Google](https://www.google.com/maps?q=46.18842,21.31020) |
| 59 | 418 | Strada Voinicilor | 48 | 1 | 46.16980, 21.36213 [OSM](https://www.openstreetmap.org/?mlat=46.16980&mlon=21.36213#map=17/46.16980/21.36213) · [Google](https://www.google.com/maps?q=46.16980,21.36213) |
| 60 | 416 | Bulevardul Revoluției | 1, 18b, 3, 6, 7, 16 | 10 | 46.17700, 21.31890 [OSM](https://www.openstreetmap.org/?mlat=46.17700&mlon=21.31890#map=17/46.17700/21.31890) · [Google](https://www.google.com/maps?q=46.17700,21.31890) |
| 61 | 409 | Strada Dobrogea | 31, 39b | 3 | 46.20552, 21.32055 [OSM](https://www.openstreetmap.org/?mlat=46.20552&mlon=21.32055#map=17/46.20552/21.32055) · [Google](https://www.google.com/maps?q=46.20552,21.32055) |
| 62 | 399 | Strada Sigsmund Borlea | 49, 49b | 3 | 46.15269, 21.30082 [OSM](https://www.openstreetmap.org/?mlat=46.15269&mlon=21.30082#map=17/46.15269/21.30082) · [Google](https://www.google.com/maps?q=46.15269,21.30082) |
| 63 | 396 | Strada Crinului | 7A, Ghioroc, Vladimirescu | 3 | 46.17962, 21.34672 [OSM](https://www.openstreetmap.org/?mlat=46.17962&mlon=21.34672#map=17/46.17962/21.34672) · [Google](https://www.google.com/maps?q=46.17962,21.34672) |
| 64 | 391 | Strada Ion Creangă | 60 | 2 | 46.21610, 21.27193 [OSM](https://www.openstreetmap.org/?mlat=46.21610&mlon=21.27193#map=17/46.21610/21.27193) · [Google](https://www.google.com/maps?q=46.21610,21.27193) |
| 65 | 387 | Strada Molidului | 49, 49b | 3 | 46.14108, 21.31746 [OSM](https://www.openstreetmap.org/?mlat=46.14108&mlon=21.31746#map=17/46.14108/21.31746) · [Google](https://www.google.com/maps?q=46.14108,21.31746) |
| 66 | 387 | Strada Profesor Doctor Aurel Ardelean | 18b, 7, 21, 54 | 6 | 46.16782, 21.29091 [OSM](https://www.openstreetmap.org/?mlat=46.16782&mlon=21.29091#map=17/46.16782/21.29091) · [Google](https://www.google.com/maps?q=46.16782,21.29091) |
| 67 | 385 | Strada Sabin Drăgoi | Ghioroc | 1 | 46.14575, 21.48385 [OSM](https://www.openstreetmap.org/?mlat=46.14575&mlon=21.48385#map=17/46.14575/21.48385) · [Google](https://www.google.com/maps?q=46.14575,21.48385) |
| 68 | 382 | Relocare | 46 | 2 | 46.24870, 21.26000 [OSM](https://www.openstreetmap.org/?mlat=46.24870&mlon=21.26000#map=17/46.24870/21.26000) · [Google](https://www.google.com/maps?q=46.24870,21.26000) |
| 69 | 380 | Strada Pădurii | Ghioroc, Vladimirescu | 4 | 46.15922, 21.41913 [OSM](https://www.openstreetmap.org/?mlat=46.15922&mlon=21.41913#map=17/46.15922/21.41913) · [Google](https://www.google.com/maps?q=46.15922,21.41913) |
| 70 | 377 | Strada Măgurele | 60 | 2 | 46.21251, 21.27651 [OSM](https://www.openstreetmap.org/?mlat=46.21251&mlon=21.27651#map=17/46.21251/21.27651) · [Google](https://www.google.com/maps?q=46.21251,21.27651) |
| 71 | 375 | Strada Condurașilor | 18b | 1 | 46.16637, 21.29819 [OSM](https://www.openstreetmap.org/?mlat=46.16637&mlon=21.29819#map=17/46.16637/21.29819) · [Google](https://www.google.com/maps?q=46.16637,21.29819) |
| 72 | 375 | Strada Andrei Șaguna | 41, 46, 54, 60 | 4 | 46.17360, 21.30548 [OSM](https://www.openstreetmap.org/?mlat=46.17360&mlon=21.30548#map=17/46.17360/21.30548) · [Google](https://www.google.com/maps?q=46.17360,21.30548) |
| 73 | 373 | Strada Constantin Ticu Dumitrescu | 49b | 2 | 46.14287, 21.31121 [OSM](https://www.openstreetmap.org/?mlat=46.14287&mlon=21.31121#map=17/46.14287/21.31121) · [Google](https://www.google.com/maps?q=46.14287,21.31121) |
| 74 | 371 | — | Ghioroc | 2 | 46.14919, 21.46036 [OSM](https://www.openstreetmap.org/?mlat=46.14919&mlon=21.46036#map=17/46.14919/21.46036) · [Google](https://www.google.com/maps?q=46.14919,21.46036) |
| 75 | 370 | Strada Bogdan Voievod I | 60 | 2 | 46.20419, 21.27530 [OSM](https://www.openstreetmap.org/?mlat=46.20419&mlon=21.27530#map=17/46.20419/21.27530) · [Google](https://www.google.com/maps?q=46.20419,21.27530) |
| 76 | 366 | Strada Suceava | 41 | 2 | 46.19291, 21.28439 [OSM](https://www.openstreetmap.org/?mlat=46.19291&mlon=21.28439#map=17/46.19291/21.28439) · [Google](https://www.google.com/maps?q=46.19291,21.28439) |
| 77 | 365 | Strada Ioan Budai Deleanu | 52 | 1 | 46.19346, 21.33731 [OSM](https://www.openstreetmap.org/?mlat=46.19346&mlon=21.33731#map=17/46.19346/21.33731) · [Google](https://www.google.com/maps?q=46.19346,21.33731) |
| 78 | 364 | Calea Aurel Vlaicu | 1, 18b, 3, 39b, 6, 15 | 6 | 46.18957, 21.32156 [OSM](https://www.openstreetmap.org/?mlat=46.18957&mlon=21.32156#map=17/46.18957/21.32156) · [Google](https://www.google.com/maps?q=46.18957,21.32156) |
| 79 | 354 | Strada Andrei Șaguna | 49b | 1 | 46.16462, 21.30082 [OSM](https://www.openstreetmap.org/?mlat=46.16462&mlon=21.30082#map=17/46.16462/21.30082) · [Google](https://www.google.com/maps?q=46.16462,21.30082) |
| 80 | 352 | Strada Zambilelor | 60 | 2 | 46.21344, 21.27325 [OSM](https://www.openstreetmap.org/?mlat=46.21344&mlon=21.27325#map=17/46.21344/21.27325) · [Google](https://www.google.com/maps?q=46.21344,21.27325) |
| 81 | 351 | Aleea Plajei | Ghioroc | 1 | 46.15377, 21.57576 [OSM](https://www.openstreetmap.org/?mlat=46.15377&mlon=21.57576#map=17/46.15377/21.57576) · [Google](https://www.google.com/maps?q=46.15377,21.57576) |
| 82 | 350 | Strada Tineretului | Ghioroc | 1 | 46.16623, 21.39608 [OSM](https://www.openstreetmap.org/?mlat=46.16623&mlon=21.39608#map=17/46.16623/21.39608) · [Google](https://www.google.com/maps?q=46.16623,21.39608) |
| 83 | 346 | Strada Progresului | Ghioroc, Vladimirescu | 2 | 46.16039, 21.41474 [OSM](https://www.openstreetmap.org/?mlat=46.16039&mlon=21.41474#map=17/46.16039/21.41474) · [Google](https://www.google.com/maps?q=46.16039,21.41474) |
| 84 | 345 | Strada Radu Pancu | 48 | 1 | 46.16983, 21.37042 [OSM](https://www.openstreetmap.org/?mlat=46.16983&mlon=21.37042#map=17/46.16983/21.37042) · [Google](https://www.google.com/maps?q=46.16983,21.37042) |
| 85 | 344 | Strada Constantin Ticu Dumitrescu | 49b | 2 | 46.14646, 21.30755 [OSM](https://www.openstreetmap.org/?mlat=46.14646&mlon=21.30755#map=17/46.14646/21.30755) · [Google](https://www.google.com/maps?q=46.14646,21.30755) |
| 86 | 343 | Strada Ștefan cel Mare | 3, 19 | 2 | 46.14576, 21.32411 [OSM](https://www.openstreetmap.org/?mlat=46.14576&mlon=21.32411#map=17/46.14576/21.32411) · [Google](https://www.google.com/maps?q=46.14576,21.32411) |
| 87 | 339 | Calea Aurel Vlaicu | 18b, 7 | 2 | 46.20001, 21.29380 [OSM](https://www.openstreetmap.org/?mlat=46.20001&mlon=21.29380#map=17/46.20001/21.29380) · [Google](https://www.google.com/maps?q=46.20001,21.29380) |
| 88 | 338 | — | 54 | 2 | 46.17118, 21.24021 [OSM](https://www.openstreetmap.org/?mlat=46.17118&mlon=21.24021#map=17/46.17118/21.24021) · [Google](https://www.google.com/maps?q=46.17118,21.24021) |
| 89 | 334 | Calea Radnei | 18A, 7A, Ghioroc, Vladimirescu | 6 | 46.17722, 21.35798 [OSM](https://www.openstreetmap.org/?mlat=46.17722&mlon=21.35798#map=17/46.17722/21.35798) · [Google](https://www.google.com/maps?q=46.17722,21.35798) |
| 90 | 328 | Strada Arinului | 19 | 1 | 46.15093, 21.32780 [OSM](https://www.openstreetmap.org/?mlat=46.15093&mlon=21.32780#map=17/46.15093/21.32780) · [Google](https://www.google.com/maps?q=46.15093,21.32780) |
| 91 | 325 | Strada Poetului | 46, 60 | 4 | 46.21066, 21.29143 [OSM](https://www.openstreetmap.org/?mlat=46.21066&mlon=21.29143#map=17/46.21066/21.29143) · [Google](https://www.google.com/maps?q=46.21066,21.29143) |
| 92 | 323 | Strada Ion Păun Pincio | 49 | 1 | 46.15568, 21.31869 [OSM](https://www.openstreetmap.org/?mlat=46.15568&mlon=21.31869#map=17/46.15568/21.31869) · [Google](https://www.google.com/maps?q=46.15568,21.31869) |
| 93 | 320 | Strada Coloniștilor | 49, 49b | 3 | 46.15220, 21.30437 [OSM](https://www.openstreetmap.org/?mlat=46.15220&mlon=21.30437#map=17/46.15220/21.30437) · [Google](https://www.google.com/maps?q=46.15220,21.30437) |
| 94 | 319 | Strada Emilian | 41 | 2 | 46.19478, 21.27533 [OSM](https://www.openstreetmap.org/?mlat=46.19478&mlon=21.27533#map=17/46.19478/21.27533) · [Google](https://www.google.com/maps?q=46.19478,21.27533) |
| 95 | 312 | Relocare | 46 | 1 | 46.24572, 21.25865 [OSM](https://www.openstreetmap.org/?mlat=46.24572&mlon=21.25865#map=17/46.24572/21.25865) · [Google](https://www.google.com/maps?q=46.24572,21.25865) |
| 96 | 308 | — | 54 | 1 | 46.16956, 21.24283 [OSM](https://www.openstreetmap.org/?mlat=46.16956&mlon=21.24283#map=17/46.16956/21.24283) · [Google](https://www.google.com/maps?q=46.16956,21.24283) |
| 97 | 306 | Strada Petru Rareș | 15, 16, 31, 52 | 5 | 46.18847, 21.32856 [OSM](https://www.openstreetmap.org/?mlat=46.18847&mlon=21.32856#map=17/46.18847/21.32856) · [Google](https://www.google.com/maps?q=46.18847,21.32856) |
| 98 | 306 | Strada Tulnic | 19 | 2 | 46.13792, 21.34774 [OSM](https://www.openstreetmap.org/?mlat=46.13792&mlon=21.34774#map=17/46.13792/21.34774) · [Google](https://www.google.com/maps?q=46.13792,21.34774) |
| 99 | 305 | Calea Aurel Vlaicu | 1b | 1 | 46.20220, 21.25858 [OSM](https://www.openstreetmap.org/?mlat=46.20220&mlon=21.25858#map=17/46.20220/21.25858) · [Google](https://www.google.com/maps?q=46.20220,21.25858) |
| 100 | 304 | Strada Ilie Minea | 19 | 2 | 46.15814, 21.32790 [OSM](https://www.openstreetmap.org/?mlat=46.15814&mlon=21.32790#map=17/46.15814/21.32790) · [Google](https://www.google.com/maps?q=46.15814,21.32790) |
| 101 | 304 | — | Ghioroc | 1 | 46.14438, 21.51256 [OSM](https://www.openstreetmap.org/?mlat=46.14438&mlon=21.51256#map=17/46.14438/21.51256) · [Google](https://www.google.com/maps?q=46.14438,21.51256) |
| 102 | 302 | Strada Emil Montia | 19 | 2 | 46.13635, 21.35097 [OSM](https://www.openstreetmap.org/?mlat=46.13635&mlon=21.35097#map=17/46.13635/21.35097) · [Google](https://www.google.com/maps?q=46.13635,21.35097) |
| 103 | 301 | Strada Dunării | 6, 60 | 4 | 46.20420, 21.28098 [OSM](https://www.openstreetmap.org/?mlat=46.20420&mlon=21.28098#map=17/46.20420/21.28098) · [Google](https://www.google.com/maps?q=46.20420,21.28098) |
| 104 | 300 | Strada Progresului | Ghioroc, Vladimirescu | 2 | 46.16736, 21.39219 [OSM](https://www.openstreetmap.org/?mlat=46.16736&mlon=21.39219#map=17/46.16736/21.39219) · [Google](https://www.google.com/maps?q=46.16736,21.39219) |
| 105 | 296 | Strada Piotr Ilici Ceaikovski | 46 | 1 | 46.17049, 21.30657 [OSM](https://www.openstreetmap.org/?mlat=46.17049&mlon=21.30657#map=17/46.17049/21.30657) · [Google](https://www.google.com/maps?q=46.17049,21.30657) |
| 106 | 293 | Calea Bodrogului | 54 | 2 | 46.16901, 21.28462 [OSM](https://www.openstreetmap.org/?mlat=46.16901&mlon=21.28462#map=17/46.16901/21.28462) · [Google](https://www.google.com/maps?q=46.16901,21.28462) |
| 107 | 291 | Strada Aprodul Purice | 41 | 2 | 46.18502, 21.29637 [OSM](https://www.openstreetmap.org/?mlat=46.18502&mlon=21.29637#map=17/46.18502/21.29637) · [Google](https://www.google.com/maps?q=46.18502,21.29637) |
| 108 | 287 | Strada Preparandiei | 41, 60 | 4 | 46.16631, 21.31314 [OSM](https://www.openstreetmap.org/?mlat=46.16631&mlon=21.31314#map=17/46.16631/21.31314) · [Google](https://www.google.com/maps?q=46.16631,21.31314) |
| 109 | 284 | Strada Aurel Suciu | 18b, 7 | 2 | 46.16609, 21.29305 [OSM](https://www.openstreetmap.org/?mlat=46.16609&mlon=21.29305#map=17/46.16609/21.29305) · [Google](https://www.google.com/maps?q=46.16609,21.29305) |
| 110 | 281 | Strada Ștefan cel Mare | 19 | 1 | 46.14813, 21.33518 [OSM](https://www.openstreetmap.org/?mlat=46.14813&mlon=21.33518#map=17/46.14813/21.33518) · [Google](https://www.google.com/maps?q=46.14813,21.33518) |
| 111 | 278 | Strada Cloșca | Ghioroc | 2 | 46.15530, 21.58855 [OSM](https://www.openstreetmap.org/?mlat=46.15530&mlon=21.58855#map=17/46.15530/21.58855) · [Google](https://www.google.com/maps?q=46.15530,21.58855) |
| 112 | 276 | — | Ghioroc | 1 | 46.15069, 21.56063 [OSM](https://www.openstreetmap.org/?mlat=46.15069&mlon=21.56063#map=17/46.15069/21.56063) · [Google](https://www.google.com/maps?q=46.15069,21.56063) |
| 113 | 274 | Aleea Saturn | 7, 15 | 2 | 46.20221, 21.29303 [OSM](https://www.openstreetmap.org/?mlat=46.20221&mlon=21.29303#map=17/46.20221/21.29303) · [Google](https://www.google.com/maps?q=46.20221,21.29303) |
| 114 | 274 | Strada Toamnei | 46, 60 | 4 | 46.19615, 21.30497 [OSM](https://www.openstreetmap.org/?mlat=46.19615&mlon=21.30497#map=17/46.19615/21.30497) · [Google](https://www.google.com/maps?q=46.19615,21.30497) |
| 115 | 270 | Strada Voievod Moga | 52 | 1 | 46.18758, 21.34201 [OSM](https://www.openstreetmap.org/?mlat=46.18758&mlon=21.34201#map=17/46.18758/21.34201) · [Google](https://www.google.com/maps?q=46.18758,21.34201) |
| 116 | 269 | Strada Flacăra | 19 | 2 | 46.14312, 21.33890 [OSM](https://www.openstreetmap.org/?mlat=46.14312&mlon=21.33890#map=17/46.14312/21.33890) · [Google](https://www.google.com/maps?q=46.14312,21.33890) |
| 117 | 267 | Calea Aurel Vlaicu | 1b, 6 | 2 | 46.20144, 21.28646 [OSM](https://www.openstreetmap.org/?mlat=46.20144&mlon=21.28646#map=17/46.20144/21.28646) · [Google](https://www.google.com/maps?q=46.20144,21.28646) |
| 118 | 267 | Strada Ioan Budai Deleanu | 52 | 1 | 46.19134, 21.34061 [OSM](https://www.openstreetmap.org/?mlat=46.19134&mlon=21.34061#map=17/46.19134/21.34061) · [Google](https://www.google.com/maps?q=46.19134,21.34061) |
| 119 | 266 | Strada Florilor | 7, 41, 60 | 3 | 46.16660, 21.31732 [OSM](https://www.openstreetmap.org/?mlat=46.16660&mlon=21.31732#map=17/46.16660/21.31732) · [Google](https://www.google.com/maps?q=46.16660,21.31732) |
| 120 | 266 | Strada Cetății | 19 | 1 | 46.16049, 21.32939 [OSM](https://www.openstreetmap.org/?mlat=46.16049&mlon=21.32939#map=17/46.16049/21.32939) · [Google](https://www.google.com/maps?q=46.16049,21.32939) |
| 121 | 265 | Strada Adam Müller-Guttenbrunn | 19 | 1 | 46.15351, 21.32691 [OSM](https://www.openstreetmap.org/?mlat=46.15351&mlon=21.32691#map=17/46.15351/21.32691) · [Google](https://www.google.com/maps?q=46.15351,21.32691) |
| 122 | 264 | Strada Viitorului | 31, 39b | 3 | 46.20218, 21.32284 [OSM](https://www.openstreetmap.org/?mlat=46.20218&mlon=21.32284#map=17/46.20218/21.32284) · [Google](https://www.google.com/maps?q=46.20218,21.32284) |
| 123 | 259 | Strada Zimbrului | 3, 19, 49 | 4 | 46.14920, 21.32143 [OSM](https://www.openstreetmap.org/?mlat=46.14920&mlon=21.32143#map=17/46.14920/21.32143) · [Google](https://www.google.com/maps?q=46.14920,21.32143) |
| 124 | 258 | Strada Episcop Roman Ciorogariu | 41 | 2 | 46.18115, 21.30260 [OSM](https://www.openstreetmap.org/?mlat=46.18115&mlon=21.30260#map=17/46.18115/21.30260) · [Google](https://www.google.com/maps?q=46.18115,21.30260) |
| 125 | 257 | Relocare | Ghioroc | 1 | 46.17097, 21.37786 [OSM](https://www.openstreetmap.org/?mlat=46.17097&mlon=21.37786#map=17/46.17097/21.37786) · [Google](https://www.google.com/maps?q=46.17097,21.37786) |
| 126 | 255 | — | Ghioroc | 2 | 46.14173, 21.52068 [OSM](https://www.openstreetmap.org/?mlat=46.14173&mlon=21.52068#map=17/46.14173/21.52068) · [Google](https://www.google.com/maps?q=46.14173,21.52068) |
| 127 | 255 | Bulevardul Nicolae Titulescu | 18A, 19, 7A | 4 | 46.17764, 21.34405 [OSM](https://www.openstreetmap.org/?mlat=46.17764&mlon=21.34405#map=17/46.17764/21.34405) · [Google](https://www.google.com/maps?q=46.17764,21.34405) |
| 128 | 252 | Strada Armoniei | 49 | 1 | 46.14115, 21.31331 [OSM](https://www.openstreetmap.org/?mlat=46.14115&mlon=21.31331#map=17/46.14115/21.31331) · [Google](https://www.google.com/maps?q=46.14115,21.31331) |
| 129 | 248 | Strada Tudor Vladimirescu | 19, 54 | 2 | 46.18379, 21.32095 [OSM](https://www.openstreetmap.org/?mlat=46.18379&mlon=21.32095#map=17/46.18379/21.32095) · [Google](https://www.google.com/maps?q=46.18379,21.32095) |
| 130 | 247 | Calea Bodrogului | 54 | 1 | 46.16883, 21.27772 [OSM](https://www.openstreetmap.org/?mlat=46.16883&mlon=21.27772#map=17/46.16883/21.27772) · [Google](https://www.google.com/maps?q=46.16883,21.27772) |
| 131 | 244 | Strada Voinicilor | 48 | 1 | 46.17111, 21.35600 [OSM](https://www.openstreetmap.org/?mlat=46.17111&mlon=21.35600#map=17/46.17111/21.35600) · [Google](https://www.google.com/maps?q=46.17111,21.35600) |
| 132 | 242 | Calea Radnei | Ghioroc | 1 | 46.17339, 21.37545 [OSM](https://www.openstreetmap.org/?mlat=46.17339&mlon=21.37545#map=17/46.17339/21.37545) · [Google](https://www.google.com/maps?q=46.17339,21.37545) |
| 133 | 242 | Sâmbăteni-Ghioroc | Ghioroc | 1 | 46.15559, 21.59190 [OSM](https://www.openstreetmap.org/?mlat=46.15559&mlon=21.59190#map=17/46.15559/21.59190) · [Google](https://www.google.com/maps?q=46.15559,21.59190) |
| 134 | 238 | Strada Profesor Doctor Aurel Ardelean | 18b, 21 | 2 | 46.17166, 21.29281 [OSM](https://www.openstreetmap.org/?mlat=46.17166&mlon=21.29281#map=17/46.17166/21.29281) · [Google](https://www.google.com/maps?q=46.17166,21.29281) |
| 135 | 237 | Strada Nelu Aristide Dragomir | 7 | 1 | 46.18623, 21.32524 [OSM](https://www.openstreetmap.org/?mlat=46.18623&mlon=21.32524#map=17/46.18623/21.32524) · [Google](https://www.google.com/maps?q=46.18623,21.32524) |
| 136 | 237 | Strada Ciobanului | 48 | 1 | 46.16894, 21.35706 [OSM](https://www.openstreetmap.org/?mlat=46.16894&mlon=21.35706#map=17/46.16894/21.35706) · [Google](https://www.google.com/maps?q=46.16894,21.35706) |
| 137 | 232 | Strada Libelulei | 60 | 2 | 46.21420, 21.28235 [OSM](https://www.openstreetmap.org/?mlat=46.21420&mlon=21.28235#map=17/46.21420/21.28235) · [Google](https://www.google.com/maps?q=46.21420,21.28235) |
| 138 | 229 | Strada Cloșca | Ghioroc | 1 | 46.15466, 21.58542 [OSM](https://www.openstreetmap.org/?mlat=46.15466&mlon=21.58542#map=17/46.15466/21.58542) · [Google](https://www.google.com/maps?q=46.15466,21.58542) |
| 139 | 228 | Strada Poetului | 46 | 1 | 46.21292, 21.28959 [OSM](https://www.openstreetmap.org/?mlat=46.21292&mlon=21.28959#map=17/46.21292/21.28959) · [Google](https://www.google.com/maps?q=46.21292,21.28959) |
| 140 | 228 | Calea Aurel Vlaicu | 1b | 2 | 46.20121, 21.27869 [OSM](https://www.openstreetmap.org/?mlat=46.20121&mlon=21.27869#map=17/46.20121/21.27869) · [Google](https://www.google.com/maps?q=46.20121,21.27869) |
| 141 | 227 | Strada Tiberiu | 41 | 1 | 46.19127, 21.28840 [OSM](https://www.openstreetmap.org/?mlat=46.19127&mlon=21.28840#map=17/46.19127/21.28840) · [Google](https://www.google.com/maps?q=46.19127,21.28840) |
| 142 | 224 | Strada Economului | 49b | 1 | 46.15505, 21.29890 [OSM](https://www.openstreetmap.org/?mlat=46.15505&mlon=21.29890#map=17/46.15505/21.29890) · [Google](https://www.google.com/maps?q=46.15505,21.29890) |
| 143 | 216 | Strada Nouă | 1b, 60 | 3 | 46.20323, 21.27176 [OSM](https://www.openstreetmap.org/?mlat=46.20323&mlon=21.27176#map=17/46.20323/21.27176) · [Google](https://www.google.com/maps?q=46.20323,21.27176) |
| 144 | 214 | Strada Ilia | 7, 41, 60 | 4 | 46.16700, 21.30918 [OSM](https://www.openstreetmap.org/?mlat=46.16700&mlon=21.30918#map=17/46.16700/21.30918) · [Google](https://www.google.com/maps?q=46.16700,21.30918) |
| 145 | 214 | Piața Avram Iancu | 18b | 1 | 46.16995, 21.31686 [OSM](https://www.openstreetmap.org/?mlat=46.16995&mlon=21.31686#map=17/46.16995/21.31686) · [Google](https://www.google.com/maps?q=46.16995,21.31686) |
| 146 | 213 | Strada Tismana | 31 | 1 | 46.19971, 21.32688 [OSM](https://www.openstreetmap.org/?mlat=46.19971&mlon=21.32688#map=17/46.19971/21.32688) · [Google](https://www.google.com/maps?q=46.19971,21.32688) |
| 147 | 213 | Strada Steagului | 19 | 2 | 46.13927, 21.34503 [OSM](https://www.openstreetmap.org/?mlat=46.13927&mlon=21.34503#map=17/46.13927/21.34503) · [Google](https://www.google.com/maps?q=46.13927,21.34503) |
| 148 | 208 | Calea Timișorii | 3 | 1 | 46.15319, 21.32175 [OSM](https://www.openstreetmap.org/?mlat=46.15319&mlon=21.32175#map=17/46.15319/21.32175) · [Google](https://www.google.com/maps?q=46.15319,21.32175) |
| 149 | 207 | Bulevardul Westfield | 46 | 1 | 46.22875, 21.26612 [OSM](https://www.openstreetmap.org/?mlat=46.22875&mlon=21.26612#map=17/46.22875/21.26612) · [Google](https://www.google.com/maps?q=46.22875,21.26612) |
| 150 | 207 | Strada Turdei | 46, 60 | 4 | 46.20525, 21.29366 [OSM](https://www.openstreetmap.org/?mlat=46.20525&mlon=21.29366#map=17/46.20525/21.29366) · [Google](https://www.google.com/maps?q=46.20525,21.29366) |
| 151 | 204 | Bulevardul Nicolae Titulescu | 19 | 1 | 46.16599, 21.33181 [OSM](https://www.openstreetmap.org/?mlat=46.16599&mlon=21.33181#map=17/46.16599/21.33181) · [Google](https://www.google.com/maps?q=46.16599,21.33181) |
| 152 | 204 | Strada Vântului | 19 | 1 | 46.13349, 21.35234 [OSM](https://www.openstreetmap.org/?mlat=46.13349&mlon=21.35234#map=17/46.13349/21.35234) · [Google](https://www.google.com/maps?q=46.13349,21.35234) |
| 153 | 201 | Strada Voievod Moga | 52 | 1 | 46.18639, 21.33888 [OSM](https://www.openstreetmap.org/?mlat=46.18639&mlon=21.33888#map=17/46.18639/21.33888) · [Google](https://www.google.com/maps?q=46.18639,21.33888) |

## Methodology

Computed on raw `shapes.txt` (no map matching): for every shape the distances
between consecutive points (`shape_pt_sequence`) were measured in a local metric
projection; pairs above the 200 m threshold were grouped spatially by gap
midpoint. Script: `pipeline/report-gaps.mjs` (`npm run report`), regenerate
after every feed update.
