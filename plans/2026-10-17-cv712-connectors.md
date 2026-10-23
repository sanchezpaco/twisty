# Connectors through a street's middle (CV-712)

ROADMAP Next up 11. Owner: routing (`gis-data-engineer`). Approved by the director, 2026-10-17, with the checks below.

## Cause (measured)

CV-712 Pego - la Vall d'Ebo ends in two runs, at OSM nodes 252039342 and 2127069749, 8.5 m apart. Both are dead ends of
a long numbered road, so `read_connectors` looks for a residential link for them. The link exists: residential way
23287384 "Avinguda de la Marina Alta" (about 400 m, within `CONNECTOR_MAX_M`) ends at 252039342 and has 2127069749 as
its second-to-last node.

`connector_streets` builds its street graph from each street's first and last node only. A dead end or a network node
in the middle of a street is not seen, so the 8.5 m between the two runs is never a link, and the street's far end
(252060146) reaches no network node within 600 m. Both dead ends stay unjoined.

Spain-wide, on main's data (script `diag.py`, in the session scratchpad):

| | Now | Streets split at network nodes |
| --- | --- | --- |
| Dead ends of named roads (7,610) joined | 2,720 | 3,715 (+995, 0 lost) |
| Of the gained, on a numbered road | | 257 (LE 32, CV 17, A 14, NA 14, BA 12, ...; e.g. GI-1, CA-326, CV-147, CV-104) |
| Connector pieces kept | 5,139 | 6,158 |

## Change

1. In `read_connectors`, cut the candidate streets at blocked nodes first (`cut_ways`, as now but before the link
   search), so a barrier still stops a link and no two pieces share a stranded node id.
2. As built (the first version, below, lost links): two passes in `connector_streets`.
   1. Today's search on whole streets, unchanged: every dead end it joins keeps exactly today's links.
   2. For the dead ends it leaves unjoined only, the same search on the streets split at their inner network nodes
      (`split_at`, pure). A piece that links is kept as its whole street when that is no longer than
      `CONNECTOR_MAX_M`, else as the piece.
   - The first version split every street and kept only the piece up to the first network node. On the Spain build it
     dropped 133 km of today's connectors (1,296 ways), 44 of 968 bench options had ridden them, and it lost G1
     vidra-sant-privat on great-giv-5221-oix-beget-ends: seven of the trip's nine options rode the arc of a village
     roundabout (w132963077) that roads meet in its middle. Keeping short streets whole still dropped 77 km: 832 ways
     went because the dead end now found a nearer link through a street's middle, in place of the chain it had.
   - `split_at` first used `np.isin` against the 2M network nodes once per street, which sorts them on every call: the
     Spain build hung in the graph step for 13 h. It searches the sorted ids instead (454.7 s -> 5.0 s for that step
     on a Marina Alta extract).
3. Tests in `test_connectors.py`: the CV-712 shape, a short street past the network kept whole (the roundabout), a long
   one kept up to the network node, a gate before the node stops the link.

## Checks

- pytest; the graph rebuilt in a scratch dir (heavy slot), the bench against it.
- CV-712: Pego -> la Vall d'Ebo rides the climb (a bench trip or a direct plan), and the 20 km CV-700 detour is gone.
- Bench diff read trip by trip: every route change explained (a road now reachable, or a residential piece dropped);
  G1 and recall before and after; node and edge counts.
- The network-to-network pieces that drop out: their metres and edges, and whether any bench route rode them before.
- No place becomes unreachable: no_route over the bench trips and the 25 fresh trips, and reach, on the new graph.
- graph.bin size, raw and gzip, before and after.
- The baseline is re-recorded on the branch (a pipeline change).
