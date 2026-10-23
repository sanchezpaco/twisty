# Routing evaluation kit

A frozen "photo" of the routing: the same trips, the same pairs, the same rendering and the same judge prompt, run on
any commit and any data folder, so two versions of the planner are judged on identical lists. The kit does not judge;
it writes a blind dossier that the judge reads (`judge-prompt.md`).

## What is frozen

`frozen.json` (written once by `run.js eval-freeze --baseline <baseline.jsonl>` from the v1 baseline, seed
`20261016`) holds the trips with their ends, the known roads of the pairs, and three lists:

- **misses:** every demanded pair the baseline did not find (62 in v1);
- **controls:** 20 found pairs drawn with the seed, never one whose stop is the forced route itself (cost within
  1 % of it) nor one that costs more than 2.5 times the forced route, so every control compares two different routes
  that a rider could weigh against each other;
- **sample:** 25 trips scored on their own: the six head-to-head trips and 19 drawn with the seed (no fixed
  trips, which are two of the six under another name).

Every random choice is a hash of the seed and a name (`ranked`, `oursIsX`): it does not move when other items come
or go. Do not run `eval-freeze` again for a later commit; that would replace the lists.

## The dossier

`make bench-eval EVAL_OUT=<dir>` (data from `TWISTY_DATA`, default `app/public/data`), or
`node bench/.build/run.js eval --out <dir>` after `make bench`'s build step, writes:

| file | holds |
| --- | --- |
| `pairs.md`, `pairs.json` | the misses and the controls mixed, in a seeded order: the trip and two routes, X and Y |
| `absolute.md`, `absolute.json` | per sample trip, our default stop and our most-fun stop (one route when they are the same) |
| `judge-prompt.md` | the prompt the judge is given, a copy of the committed one |
| `key.json` | what the judge must not read: which of X and Y is ours, the list of each pair, the demanded road, the stop |
| `summary.json` | counts, pairs that could not be built, and the flags worth a look (a forced route that backtracks, a road that is itself unsafe) |

In a pair, one of X and Y is the **forced route** (the fastest route that rides the whole demanded road, whichever
way; the key says which) and the other is **our stop** whose extra minutes are closest to the forced cost (the cheaper on a tie); for a control, the
first stop that rides the road. Both are described by the same code (`card.ts`): the figures of the head-to-head study
and the roads in riding order, with runs under 1 km folded into "local roads".

## Running it on a later commit

1. Run the bench on the commit (`run.js run --out <dir>`) to get `results.jsonl`.
2. `make bench-eval EVAL_OUT=<dir> EVAL_ARGS="--added <dir>/results.jsonl"`: the frozen lists are judged again on the
   new data, and the demanded pairs the commit misses that the frozen list does not have are added as a list of their
   own (`added` in `key.json`), never replacing the frozen misses.
3. Judge with the same prompt; compare to the v1 judgements by pair id (ids are stable).

A frozen pair whose road is no longer in the graph, or whose trip no longer plans, is not dropped silently: it is
listed under `skipped` in `summary.json` and the run exits with 1.
