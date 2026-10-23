# Plan: step (d), curvature → fun calibration

Status: for the director's approval, nothing built. Owner: `routing` as `gis-data-engineer`. Date: 2026-10-14.
Comes from road-scout's findings on AS-227 and N-260 (maintainer-approved: the model is wrong on these roads; the bench
and the slider are not). It goes before the fun-model stack lands, and it is sequenced against the coverage stops below.

## What is known, and by whom

Measured by road-scout (`prof.py`, not reproduced by me yet): Somiedo km 10-12 from Pola has a mean of 324°/km and a p90
of 791°/km and scores fun 0.59; N-260 upper Cantó east (~1.29, 42.34) runs at 66-142°/km and scores 0.14-0.44; N-260
between Sort and Adrall is six chains, broken at 1.221, 42.375 and near 1.17 and 1.12.

Read in the code (`pipeline/twisty_pipeline/curvature.py`, `chains.py`), as facts about the model, not causes:

- Fun at a point is `fun_fraction(density)`, piecewise linear: 0 at 40°/km, 0.55 at 150, 1 at 500, flat above; the density
  is the heading change over a 1 km window (`WINDOW_M`) centred on the point, so every road is judged at one scale.
- A single vertex's deflection is capped at 150° (`MAX_DEFLECTION_DEG`, "almost always a mapping glitch") and the
  geometry is simplified at 5 m before turning is counted; a hairpin mapped with few vertices loses degrees.
- Speed does not enter the fun curve: a fast sweeper and a slow bend of the same density are worth the same. Speed enters
  the time model and the pace factor of the road class.
- A chain joins ways of the same ref (or name) only through a node where exactly two ways of that group meet; a ref and a
  name are different identities; otherwise the road is cut.

So three questions, to be answered by measurement before any constant moves:

1. **Hairpin stacks.** Is a stack scored low because of the deflection cap or the simplification (a hairpin mapped as one
   vertex of 180° counts 150° or less), because 1 km windows average hairpins with the straights between them, or because
   the curve saturates where riders do not? Each has a different fix.
2. **Fast sweepers.** Do riders feel 66-142°/km at 90 km/h as 0.14-0.44 of a perfect road? A lateral-acceleration view
   (`speed² × curvature`) puts them above what the density curve says; whether it matches the labels is the question.
3. **Chains.** At each of the breaks listed for N-260 and the other road-scout roads, what is on both sides: a third way of
   the same ref, a change of ref (N-260 → N-260a), ref on one side and name on the other, a bridge, a link? One table
   decides whether the join rule changes, and how.

## Step 0: diagnose (no model change)

A script (kept out of the repo, like the earlier surveys) prints, for each of road-scout's roads that failed: the profile
per 500 m (mean and p90 density, deflection counted before and after the cap and the simplification, window sizes 300 m,
500 m and 1 km, resulting fun), and for every chain break the tags and degree of the node. Output: one table in
`reviews/` with the answer to 1-3 for each road. Cost: one read of the extract (~4 min in a heavy slot) and no data
build.

## The calibration set (held out from the bench)

Needed from road-scout, so the model is fitted to riders and not to the bench's 28 roads:

- 150 to 200 stretches of 1.5-3 km across at least 12 regions, none of them on a bench road or within 5 km of one.
- Labelled for **character**, not for "great road": 1 straight/dull, 2 gentle, 3 flowing sweepers, 4 twisty, 5 tight
  hairpins and bends; plus a class tag (hairpin stack, fast sweepers, mixed, urban, straight). About a quarter of them
  are urban or dull roads, so a change that adds fun everywhere is caught.
- Split by region into a dev half and a test half, once, before anything is fitted. The test half is read only at the end
  of each step.

AS-227 and N-260 are not in the set. They come back through the model, or they stay out.

## Steps after the diagnosis

1. **Chains** (if the table says the join rule is at fault): join through a node of three or more ways of the group by
   continuity (the pair with the smallest change of heading), and across ref ↔ name where nothing else of the group meets
   there. Pipeline test per break type. Measure: the number of chains and their length distribution, the overlay, the
   bench's G2/G6.
2. **Curve**: a small family chosen by the table, for example fun taken as the larger of the density at 300 m and at 1 km
   (hairpins), the deflection cap raised or applied after merging close vertices, and a speed term for flowing roads;
   fitted on the dev half and accepted on the test half (rank agreement per class, and no rise of fun on the urban and
   dull labels). At most three parameters, named constants at the top of `curvature.py`.
3. **Bench and judges** on the unchanged stack: recall, G1, G6, D3, graph size, settled nodes; `expert-rider` blind on the
   roads whose fun moved most. Each step its own commit, with the table of numbers in the body.

Acceptance: rank agreement on the test half improves on every class and does not worsen on the urban and dull ones; the
bench loses no road it finds today; the graph does not grow by more than 1 MB; AS-227's chains move up by what the model
says, not by what the bench wants.

## Sequence with the coverage stops

The coverage stops rank roads by the rating of their chain, and the slider's score is `funM`: both come from this model.
So (d) goes first, then the stack is built and benched again, and the coverage constants (the cap, K, the ranking) are
not touched until that run. The order: step 0, (chains), (curve), pipeline run on (a)+(c)+(b)+(d), bench, then the
few-stops decision on cost (the Huawei number is +14 % on Madrid → Granada against a +10 % budget) with the new numbers.
Nothing lands before that.

## Needed from the director

1. A `road-scout` pass for the calibration set, as above (the biggest dependency; step 0 does not need it).
2. Agreement that (d) comes before the stack lands, and that the coverage constants wait for its run.
3. Whether a road that the model rates up by (d) but that the bench's baseline never found counts as a "gain" or needs
   the maintainer's look first (a changed model changes which roads are twisty everywhere, not only on the bench).
