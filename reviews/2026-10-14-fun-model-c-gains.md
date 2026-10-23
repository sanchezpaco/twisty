# Step (c): roads that gain fun when `unclassified` with a ref or a road's name becomes tertiary

Input for the `rider-safety` review of the fun model, 2026-10-14, measured on top of step (a) and its guards
(branch `fun-model-roads`, rebased on `fun-model-limits`). Extract of 2026-10-13. Paved ways tagged `highway=unclassified`
with a `ref`, or named Carretera / Ctra. / Estrada / Carreterín (or "... errepidea"). Their fun goes from a quarter to full,
unless a guard (one-way, barrier or gate or ford node, closure, destination-only, rough surface, street name) or a built-up
area takes it away. Tracks (unpaved) are left out. Narrow ways carry the app's "Narrow" chip (`narrow=yes`, `lanes=1` and
not one-way, or `width ≤ 3.5`), roads posted ≤ 40 the "Signed" chip.

In all, 3,224 roads (grouped by ref and name; unnamed ways one by one) gain fun: 8,202 km of tarmac,
3,743 fun-km, of which 461 km lie on narrow ways. Below, the 30 that gain most fun-km (`-` means
the tag is missing; the number in brackets is the count of ways).

| # | Road | Fun km gained | Length km | Narrow km | highway | surface | width | lanes | maxspeed | lit | smoothness | access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | JH-7155 | 30.9 | 47.4 | 40.4 | unclassified (15) | asphalt (15) | - (15) | 1 (14), 2 (1) | 30 (13), - (1) | - (15) | - (14) | - (15) |
| 2 | Carretera de Vidrà a Sant Privat d'en Bas | 16.2 | 22.8 | 0.0 | unclassified (12) | - (10), asphalt (2) | - (12) | - (12) | - (12) | - (12) | - (12) | - (12) |
| 3 | Carretera de Peramola | 14.7 | 22.3 | 0.0 | unclassified (6) | asphalt (6) | - (6) | - (6) | - (6) | - (6) | - (6) | - (6) |
| 4 | CHE-1403 | 13.9 | 33.7 | 0.0 | unclassified (11) | - (11) | - (11) | - (11) | - (11) | - (11) | - (11) | permissive (11) |
| 5 | Carretera de Solsona a Cambrils | 13.2 | 22.2 | 0.0 | unclassified (11) | - (8), asphalt (3) | - (10), 4 (1) | - (11) | - (11) | - (11) | - (11) | - (11) |
| 6 | Estrada a Cereixido por Feais | 10.5 | 15.6 | 0.0 | unclassified (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) |
| 7 | Etxalar - Zugarramurdi errepidea | 10.4 | 16.3 | 0.0 | unclassified (7) | - (4), asphalt (2) | - (7) | - (7) | - (7) | - (7) | - (7) | - (7) |
| 8 | carretera de Uña | 10.3 | 19.5 | 0.0 | unclassified (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) |
| 9 | Carretera de la Pobleta de Bellveí a Gerri de la Sal | 9.8 | 14.8 | 0.0 | unclassified (14) | - (14) | - (14) | - (14) | - (14) | - (14) | - (14) | - (14) |
| 10 | Carretera del Rat-Penat a la Plana Novella i Olivella | 9.7 | 15.5 | 0.0 | unclassified (18) | asphalt (15), - (3) | - (18) | - (13), 2 (5) | - (16), 10 (2) | - (18) | - (18) | - (18) |
| 11 | Carretera de Rossell a Vallibona | 9.7 | 15.0 | 0.0 | unclassified (7) | - (6), asphalt (1) | - (7) | - (7) | 30 (7) | - (7) | - (7) | - (7) |
| 12 | Carretera de la Mare de Déu del Mont | 9.5 | 13.8 | 0.0 | unclassified (14) | asphalt (14) | - (14) | - (14) | 30 (14) | - (14) | - (14) | - (14) |
| 13 | Carretera de la Vall del Bac | 9.3 | 14.5 | 0.0 | unclassified (15) | asphalt (13), - (2) | - (15) | - (15) | 30 (15) | - (15) | - (15) | - (11) |
| 14 | Estrada a Vilarmel | 9.3 | 13.8 | 0.0 | unclassified (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) |
| 15 | carretera de los Gazquez | 9.1 | 16.0 | 0.0 | unclassified (4) | - (4) | - (4) | - (4) | - (4) | - (4) | - (4) | - (4) |
| 16 | Carretera Vella de Tortosa al Perelló | 8.6 | 15.3 | 0.0 | unclassified (5) | paved (3), asphalt (2) | - (5) | - (5) | - (5) | - (5) | intermediate (5) | - (5) |
| 17 | Estrada Serra Seca - Alto da Xigua | 8.6 | 12.6 | 0.0 | unclassified (1) | - (1) | - (1) | - (1) | - (1) | - (1) | - (1) | - (1) |
| 18 | JV-2262 | 8.5 | 14.8 | 0.0 | unclassified (4) | - (4) | - (4) | - (4) | - (4) | - (4) | - (4) | - (4) |
| 19 | JA-7155 | 8.3 | 12.5 | 0.0 | unclassified (1) | asphalt (1) | - (1) | 2 (1) | 50 (1) | - (1) | intermediate (1) | - (1) |
| 20 | Carretera de Juan Quílez | 8.2 | 12.9 | 0.0 | unclassified (2) | - (2) | - (2) | - (2) | - (2) | - (2) | - (2) | - (2) |
| 21 | Carretera de Montan de Tost | 8.1 | 12.3 | 0.0 | unclassified (6) | asphalt (4), - (2) | - (6) | - (6) | - (4), 30 (2) | - (6) | - (6) | - (6) |
| 22 | Carretera de Solsona a Bassella | 8.1 | 13.8 | 0.0 | unclassified (2) | - (2) | - (2) | - (2) | - (2) | - (2) | - (2) | - (2) |
| 23 | HF15 | 8.0 | 12.5 | 12.5 | unclassified (6) | asphalt (6) | - (6) | 1 (6) | 30 (6) | - (6) | - (6) | - (6) |
| 24 | JV-2222 | 8.0 | 13.2 | 5.5 | unclassified (4) | asphalt (4) | - (4) | - (3), 1 (1) | - (4) | - (4) | - (4) | - (3) |
| 25 | Carretera del Amogable | 7.9 | 17.9 | 0.0 | unclassified (8) | - (8) | - (8) | - (8) | - (8) | - (8) | - (8) | - (8) |
| 26 | CH-1 | 7.8 | 10.6 | 0.0 | unclassified (2) | - (1), asphalt (1) | - (2) | - (2) | - (2) | - (2) | - (2) | - (2) |
| 27 | JV-7107 | 7.8 | 11.9 | 0.0 | unclassified (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) | - (3) |
| 28 | JV-2334 | 7.7 | 13.7 | 0.0 | unclassified (5) | - (3), asphalt (2) | - (5) | - (5) | - (5) | - (5) | - (5) | - (5) |
| 29 | Carretera de Tor | 7.5 | 11.8 | 0.0 | unclassified (9) | asphalt (7), paved (2) | - (8), 6 (1) | - (9) | 40 (8), 30 (1) | - (8) | - (9) | - (9) |
| 30 | SL-13 | 7.4 | 11.9 | 0.0 | unclassified (7) | asphalt (6), - (1) | - (7) | - (7) | - (7) | - (7) | - (7) | - (7) |
