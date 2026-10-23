# Step (a): roads that gain fun when a posted limit stops zeroing it outside built-up areas

Input for the `rider-safety` review of the fun model, 2026-10-14. Radius 600 m, extract of 2026-10-13. Tracks
(`highway=track` and unpaved) are left out: they only count when the rider opts in.

In all, 11,948 roads (grouped by ref and name; unnamed ways one by one) gain fun: 10,377 km of tarmac,
3,463 km of fun, of which 1,285 km lie on ways tagged `lanes=1` or `width ≤ 3.5 m`.
Below, the 30 that gain most fun-km (fun-km = length × curve fun share; `-` means the tag is missing; the number in
brackets is the count of ways). Narrow km: length on `lanes=1` or `width ≤ 3.5`.

| # | Road | Fun km gained | Length km | Narrow km | highway | surface | width | lanes | maxspeed | lit | smoothness | access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | C-462 · Carretera de Tuixent a la Seu d'Urgell | 22.2 | 25.5 | 25.5 | tertiary (12) | - (12) | - (12) | 1 (12) | 40 (12) | - (12) | - (12) | - (12) |
| 2 | BV-1221 · Carretera de Talamanca | 21.4 | 25.5 | 0.0 | tertiary (24) | asphalt (17), - (7) | - (24) | 2 (24) | 50 (24) | - (24) | - (24) | - (24) |
| 3 | AB-513 | 18.5 | 22.7 | 0.0 | tertiary (6) | asphalt (6) | - (6) | 2 (6) | 50 (6) | - (6) | - (6) | - (6) |
| 4 | LU-P-1901 · Estrada A Fonsagrada (LU‐530) ‐ Navia (LU‐722) | 17.2 | 19.8 | 0.0 | tertiary (1) | asphalt (1) | - (1) | - (1) | 50 (1) | - (1) | - (1) | - (1) |
| 5 | B-122 | 15.8 | 17.9 | 0.1 | tertiary (19) | asphalt (12), - (7) | - (19) | - (14), 2 (4) | 50 (17), 40 (2) | - (19) | - (19) | - (19) |
| 6 | GIV-5221 · Carretera d'Oix a Beget | 14.8 | 17.7 | 0.0 | tertiary (10) | - (8), asphalt (2) | 4 (10) | - (10) | 30 (10) | - (10) | - (10) | - (10) |
| 7 | N-625 · Carretera Mansilla de las Mulas-Arriondas | 14.5 | 18.8 | 0.0 | trunk (18) | asphalt (18) | - (18) | 2 (18) | 40 (16), 50 (2) | - (18) | - (18) | - (18) |
| 8 | MCT · GR-68 Mancomunidad Canales del Taibilla | 14.2 | 15.6 | 0.0 | tertiary (4) | asphalt (4) | - (4) | 2 (4) | 50 (4) | - (4) | - (4) | - (4) |
| 9 | AS-352 · Carretera Somao - Vegafriosa | 14.2 | 17.4 | 0.0 | tertiary (1) | asphalt (1) | - (1) | 2 (1) | 30 (1) | - (1) | - (1) | - (1) |
| 10 | GIV-6703 | 13.6 | 15.6 | 0.0 | tertiary (19) | asphalt (19) | - (19) | 2 (19) | 50 (19) | no (18) | excellent (19) | - (19) |
| 11 | BV-5114 · Carretera de Santa Fe de Montseny | 12.3 | 12.7 | 0.0 | tertiary (3) | asphalt (3) | - (3) | - (3) | 50 (3) | - (3) | - (3) | - (3) |
| 12 | CV-147 · Carretera del Desert de les Palmes | 11.8 | 15.0 | 0.0 | tertiary (12) | asphalt (12) | - (12) | 2 (12) | 40 (12) | - (11) | - (12) | - (12) |
| 13 | DSA-576 · Lumbrales a Vilvestre | 11.7 | 14.7 | 0.0 | tertiary (15) | asphalt (15) | - (15) | - (13), 2 (2) | 50 (14), 30 (1) | - (14) | - (15) | - (15) |
| 14 | SC-22109-01 | 11.2 | 13.9 | 8.6 | tertiary (9) | asphalt (5), - (4) | - (9) | 1 (6), - (3) | 40 (9) | - (9) | - (9) | - (9) |
| 15 | AS-264 · Carretera de Arenas de Cabrales al límite con Cantabria, por Sotres | 11.0 | 15.4 | 0.3 | secondary (23) | asphalt (23) | - (23) | 2 (21), 1 (2) | 40 (22), 30 (1) | no (19) | excellent (18) | - (23) |
| 16 | LU-P-5001 | 11.0 | 12.5 | 12.5 | tertiary (1) | asphalt (1) | - (1) | 1 (1) | 50 (1) | - (1) | - (1) | yes (1) |
| 17 | CM-1006 | 10.2 | 23.9 | 0.0 | secondary (56) | asphalt (56) | - (56) | 2 (56) | 50 (56) | - (56) | - (32) | - (56) |
| 18 | GU-211 | 9.6 | 17.2 | 0.0 | tertiary (60) | asphalt (60) | - (60) | 2 (60) | 50 (33), 40 (22) | - (60) | - (60) | - (60) |
| 19 | BP-2126 · Carretera de la Llacuna a Guardiola de Font-rubí | 9.6 | 11.2 | 0.0 | tertiary (5) | - (5) | 4 (5) | 2 (5) | 50 (5) | - (5) | - (5) | - (5) |
| 20 | AS-233 · Carretera Trubia - Avilés | 9.5 | 15.6 | 0.0 | secondary (1) | asphalt (1) | - (1) | 2 (1) | 50 (1) | - (1) | - (1) | - (1) |
| 21 | CA-643 · San Roque de Río Miera-Puerto de Lunada | 9.3 | 11.8 | 0.0 | tertiary (2) | asphalt (2) | - (2) | - (2) | 40 (2) | - (2) | intermediate (2) | - (2) |
| 22 | LU-P-3805 | 9.2 | 14.9 | 0.0 | tertiary (3) | asphalt (3) | - (3) | - (3) | 50 (3) | - (3) | - (3) | - (3) |
| 23 | JH-7155 | 9.1 | 42.5 | 35.5 | unclassified (14) | asphalt (14) | - (14) | 1 (13), 2 (1) | 30 (13), 50 (1) | - (14) | - (13) | - (14) |
| 24 | Camino de Fuente del Arco a Puebla del Maestre | 9.1 | 19.0 | 0.0 | tertiary (3) | asphalt (3) | - (3) | 2 (3) | 50 (2), 40 (1) | - (3) | excellent (3) | - (3) |
| 25 | MA-5403 | 8.8 | 11.0 | 0.0 | tertiary (11) | asphalt (11) | - (11) | 2 (9), - (2) | 40 (8), 50 (2) | no (10) | - (11) | - (11) |
| 26 | CM-4157 | 8.7 | 11.1 | 0.0 | tertiary (49) | - (29), asphalt (20) | - (49) | - (49) | 40 (47), 50 (2) | - (49) | - (29) | - (49) |
| 27 | CM-2106 | 8.7 | 25.7 | 12.9 | secondary (48) | asphalt (46), - (2) | - (48) | 2 (44), 1 (4) | 40 (34), 50 (12) | - (48) | - (48) | - (48) |
| 28 | A-8101 | 8.7 | 11.7 | 0.0 | secondary (3) | asphalt (3) | - (3) | - (3) | 50 (3) | - (3) | good (3) | - (3) |
| 29 | LU-933 | 8.7 | 11.7 | 0.0 | tertiary (7) | asphalt (7), concrete (1) | - (8) | 2 (7), 1 (1) | 50 (7), 30 (1) | - (8) | - (8) | - (8) |
| 30 | LU-P-3807 · Estrada de San Pantaión de Cabanas a Bravos | 8.5 | 9.5 | 0.0 | tertiary (3) | asphalt (3) | - (3) | - (3) | 50 (3) | - (3) | - (3) | - (3) |
