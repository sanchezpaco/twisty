# Calibration set

Labelled stretches of Spanish roads for judging the fun model (`twisty_pipeline/curvature.py`). Made for step (d) of the
fun-model stack (`plans/2026-10-14-fun-calibration.md`); the first fit is `reviews/2026-10-15-fun-calibration-step2.md`.

- `calibration-set.json`: 164 stretches of 1.5-3 km in 15 regions, by `road-scout`, 2026-10-14. Each has `character`
  (1 straight or dull, 2 gentle, 3 flowing sweepers, 4 twisty, 5 tight hairpins and bends; half points allowed), a soft
  class tag (`mixed` 84, `fast-sweepers` 25, `urban` 25, `straight` 19, `hairpin-stack` 11), a `confidence` (56 high,
  108 medium) and its two ends as graph geometry vertices (only 67 of them end at a junction at both ends: cut
  sub-edges where needed). None is on a bench road or within 5 km of one.
- `blind-labels-expert.json`: a second, blind rating of 40 medium-confidence stretches by `expert-rider`. It is +0.6
  higher on average (within ±1 on 39 of 40, exact on 12) and tags several `mixed` stretches as hairpin stacks: a scale
  offset, not a disagreement of order.

## How to read it

- Compare **ranks**, not absolute characters. For the 40 doubly rated stretches use the mean of both labels.
- Class tags are soft: report and guard with them (urban and straight must not rise), do not fit on them.
- `half` splits the regions once: **dev** (Andalusia east and west, Cantabria, Castilla y León, Castilla-La Mancha,
  Catalonia, Extremadura, Navarra and La Rioja: 81 stretches) and **test** (Aragón, Asturias, Balearic Islands, Basque
  Country, Galicia, Madrid and Guadarrama, Valencia region and Murcia: 83). Fit on dev; read test once per change of the
  model, at acceptance.
- **The test half is unread** (2026-10-15): the first fit found nothing worth accepting, so nothing opened it.
- `val-ares` (test, 3 against the expert's 5) has no third rater; report acceptance with and without it.
