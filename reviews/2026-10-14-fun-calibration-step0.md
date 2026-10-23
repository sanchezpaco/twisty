# Fun calibration, step 0: what the model does on AS-227 and N-260 (measured)

Date: 2026-10-14. Plan: `plans/2026-10-14-fun-calibration.md`. Nothing in the model was changed. Data: the extract of
`c3d5e301` (spain-latest of 2026-10-13), the stack's pipeline ((a) posted limits, (c) unclassified roads, (b)
residential links), `read_ways` + `build_chains` as the pipeline runs them. Script: `step0_profile.py` (kept out of the
repo, in `.claude/handoffs/routing-scripts/`); it prints, per 500 m of a chain, the heading change per km at three
stages (raw vertices, simplified at 5 m, simplified and capped at 150° per vertex: what the model uses), the p90 of
the 1 km windows, the fun that 1 km, 500 m and 300 m windows would give, and the number of vertices turning 120° or more.

## 1. Hairpin stacks (AS-227, the gorge and the pass)

AS-227 from km 21.5 of the Puente de San Martín – Puerto de Somiedo chain (La Riera, -6.269, 43.199) to its end at the
pass (-6.227, 43.028): 59 stretches of 500 m, 37.8 km + 13.0 km of chains, 29.5 km in all.

| Measure | Value |
| --- | --- |
| Heading change per km, raw vertices / simplified at 5 m / simplified and capped | 420 / 305 / 305 |
| Stretches where the cap at 150° changes anything | 0 of 59 |
| Vertices that turn 120° or more, raw | 0 |
| Fun, 1 km windows (the model) / 500 m / 300 m / the largest of the three | 0.71 / 0.69 / 0.67 / 0.77 |
| Fun of the 500 m stretches, lowest and highest | 0.31 (km 12.5 of the pass chain) and 1.00 |

What it says:

- **The cap at 150° (`MAX_DEFLECTION_DEG`) is not the cause.** No vertex turns even 120°: the hairpins are mapped with
  several vertices each, so each vertex turns a part of the 180°.
- **The window is not the cause.** Judging with 300 m, 500 m or 1 km windows moves the road's fun between 0.67 and 0.71,
  and taking the best of the three gives 0.77. The tightest section (km 9.5-10.5 of the pass chain, 633-890°/km) is 1.00 in
  every case; a stack of hairpins is not averaged out by the 1 km window here.
- **The simplification takes 27 % of the turning** (420 → 305°/km over the whole stretch; 1,107 → 741°/km at the
  tightest 500 m, km 35.5 of the first chain). Whether that is mapping jitter being removed or real bend being lost,
  this table cannot say: it needs the labels.
- **The curve decides the rest.** The road runs at 300°/km on average, and the fun curve gives 0.74 for 300°/km
  (0.55 at 150, 1.00 at 500, linear between). Whether a rider rates that road as "0.71 of a perfect road" is exactly what
  the held-out labels measure. Road-scout's "Somiedo km 10-12 from Pola scores 0.59" is the same thing seen on a smaller
  stretch (mean 324°/km at p90 791).

## 2. Fast sweepers (N-260, upper Cantó, east side)

The chain "Eix Pirinenc" (N-260) 15.9 km from (1.324, 42.352) west to the Port del Cantó: the stretches at km 5.5-8.5
(1.293-1.298, 42.341-42.358) run at 97-127°/km simplified (109-176 raw), and the model gives them 0.23-0.40 (1 km windows).
Km 9.0-11.0 (1.271-1.285, 42.353-42.359) is 34-51°/km, fun 0.02-0.04: the road there is nearly straight in the data. The
whole 15.9 km chain scores 0.49; the 11.4 km chain to the east (km 8.5-11.4, 1.329-1.340) has 0.46-1.00 in its tightest
part and 0.87 as a whole. No vertex turns 120° or more anywhere on N-260 in this data either, and the cap changes nothing.

Speed does not enter the model at this point, so a bend of 100°/km is worth 0.3 whether the road runs at 60 or at
100 km/h. Whether riders feel it so is the label question; nothing here proves the sweepers are under-scored.

## 3. Chains (N-260, Sort to Adrall)

The box 1.05-1.5 E, 42.30-42.48 N holds 64 chains of N-260 and N-260a: 9 longer than 1 km (15.9, 13.1, 11.8, 11.6, 11.4,
6.7, 3.1, 2.2 and 1.6 km) and 55 slivers of up to 1 km (the carriageways and links). **Every break between the long ones is at a node where three to five ways of the same ref
meet**, and `chains._join` only joins through a node where exactly two ways of the group meet. At each one the data shows
the carriageways of a dual road and its links:

| Break (lon, lat) | Ways of N-260 at the node | Others |
| --- | --- | --- |
| 1.0611, 42.3108 and 42.3116 | 3 + 3 (primary, ref N-260, name Eix Pirinenc) | `primary_link` |
| 1.1247, 42.3912 | 3 | |
| 1.1624, 42.3802 and 1.1629, 42.3799 | 3 + 3 | `primary_link` |
| 1.1731, 42.3757 and 1.1737, 42.3755 | 3-4 | 2 `primary_link` |
| 1.2204 and 1.2210, 42.3753 (road-scout's 1.221, 42.375) | 3 and 3 | `primary_link` |
| 1.3240 and 1.3247, 42.3517 | 3 and 3 | `primary_link` |
| 1.3985, 42.326 | 3, with ways that have a ref and no name | |

So these are not passes: they are the places where the road doubles into two carriageways, with its slip roads, and a few
places where the name tag is on one side only (`Eix Pirinenc` on some ways, nothing on the ways next to them; the same
ref keeps them in one group, so the name does not break them). Two other facts: `N-260a` is a different ref
(a 1.0 km tertiary link road between two N-260 nodes, a separate chain), and the ways with `junction=roundabout` at 1.399
are in the group but `roundabout` ways are not twisty-eligible.

The breaks do not change the fun of any metre (fun is per vertex); they cut the road in pieces for the twisty overlay,
the road names in the graph (`edgeRoad`), and the app's candidates, which now join across them on their own.

## What this says about the plan

- Hypotheses 1 (the deflection cap) and the window size (part of 1) are **rejected on this data**: neither changes the
  fun of AS-227 or N-260 by more than a few hundredths.
- The remaining candidates for hairpin stacks and sweepers are **the simplification tolerance and the shape of the fun
  curve** (and a speed term for sweepers). Neither can be judged without rider labels; the calibration set is the next
  step and the plan's step 2 stays as written.
- For chains, the fix is concrete: join through a node of three or more ways of the group when they are the two
  carriageways of one road, by continuity of heading, and keep slivers and links out of the twisty detection. It can go
  first, because it needs no labels.
