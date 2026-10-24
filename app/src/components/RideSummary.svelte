<script lang="ts">
  import { dominantRating, hasWarning, listedTwisties, namedClosures, roadWarnings, splitRoadLabel, twistyRoads } from '../lib/curves'
  import { formatDuration, formatKm } from '../lib/format'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { RATING_COLORS } from '../lib/map/theme'
  import type { RideOption, RideTwisty } from '../lib/routing/ride'

  interface Props {
    ride: RideOption
    /** More options are still coming: the hint about sliding must not invite a drag that does nothing yet. */
    refining: boolean
    /** There is no other stop to slide to: the hint about sliding would send the rider nowhere. */
    onlyOption: boolean
    onfocus: (twisty: RideTwisty) => void
    /** The number of a twisty tapped on the map, whose row flashes. */
    flashed?: number | null
    /** The trip's places in riding order, which name its legs: start, stops, finish. */
    legNames?: string[]
  }

  let { ride, refining, onlyOption, onfocus, flashed = null, legNames = [] }: Props = $props()
  /** Below this a leg's curves read as none: "0.0 km of curves" would only be noise. */
  const LEG_CURVES_MIN_M = 500
  // A trip with stops lists its legs; their names come from the trip, their numbers from the ride.
  const legs = $derived(ride.legs.length > 1 && legNames.length === ride.legs.length + 1 ? ride.legs : [])

  const hasTracks = $derived(ride.trackM > 0)
  const dominant = $derived(dominantRating(ride.twisties))
  const listed = $derived(listedTwisties(ride.twisties, ride.coverageRoad, ride.coverageTwisty))
  const warnings = $derived(ride.twisties.map(roadWarnings))
  const showsLimitsNote = $derived(warnings.some(({ postedKmh, narrowM }) => postedKmh !== null || narrowM !== null))
  // The whole ride's fords, off the twisties too; a ride saved before they were counted knows only its twisties' chips.
  const fordCount = $derived(ride.fordCount ?? 0)
  const showsFordNote = $derived(fordCount > 0 || warnings.some(({ ford }) => ford))

  const share = (meters: number) => `${(meters / ride.distanceM) * 100}%`
</script>

<div class="mix" aria-hidden="true">
  <!-- The twisties in riding order, coloured by character: a preview of the ride. -->
  <span class="mix__curves" style:width={share(ride.twistyM)}>
    {#each ride.twisties as twisty, index (index)}
      <i style:flex-grow={twisty.lengthM} style:background={RATING_COLORS[twisty.rating - 1]}></i>
    {/each}
  </span>
  <span class="mix__fast" style:width={share(ride.motorwayM)}></span>
  <span class="mix__tracks" style:width={share(ride.trackM)}></span>
  <span class="mix__other" style:width={share(ride.otherM)}></span>
</div>

<dl class="stats" class:stats--grid={hasTracks}>
  <div>
    <dt><i class="dot dot--curves" style:background={dominant ? RATING_COLORS[dominant - 1] : undefined}></i>{i18n.t.ride.twisties}</dt>
    <dd>{formatKm(ride.twistyM)}<small>km</small></dd>
    {#if dominant}
      <span class="character" style:color={RATING_COLORS[dominant - 1]}>{i18n.t.ride.mostly[dominant - 1]}</span>
    {/if}
  </div>
  <div>
    <dt><i class="dot dot--fast"></i>{i18n.t.ride.fastRoads}</dt>
    <dd>{formatKm(ride.motorwayM)}<small>km</small></dd>
  </div>
  {#if hasTracks}
    <div>
      <dt><i class="dot dot--tracks"></i>{i18n.t.ride.tracks}</dt>
      <dd>{formatKm(ride.trackM)}<small>km</small></dd>
    </div>
  {/if}
  <div>
    <dt><i class="dot dot--other"></i>{i18n.t.ride.other}</dt>
    <dd>{formatKm(ride.otherM)}<small>km</small></dd>
  </div>
</dl>

{#if legs.length > 0}
  <h3>{i18n.t.ride.legs}</h3>
  <ol class="legs">
    {#each legs as leg, index (index)}
      <li>
        <span class="legs__names"><span>{legNames[index]}</span> → <span>{legNames[index + 1]}</span></span>
        <span class="legs__numbers">
          {formatDuration(leg.timeS)} · {formatKm(leg.distanceM)} km
          <b class:legs__none={leg.twistyM < LEG_CURVES_MIN_M}>{leg.twistyM < LEG_CURVES_MIN_M ? i18n.t.ride.noCurves : i18n.t.saved.curves(formatKm(leg.twistyM))}</b>
        </span>
      </li>
    {/each}
  </ol>
{/if}

{#if ride.twisties.length > 0}
  <h3>{i18n.t.ride.twistiesHeading}</h3>
  <ol class="twisties">
    {#each listed as { twisty, number, added }, index (number)}
      {@const road = splitRoadLabel(twisty.label || i18n.t.ride.unnamedRoad)}
      {@const roads = twistyRoads(twisty, i18n.t.ride.unnamedRoad)}
      <li style:animation-delay="{index * 60}ms" data-twisty={number} class:flash={number === flashed}>
        <button onclick={() => onfocus(twisty)}>
          <span class="number" style:border-color={RATING_COLORS[twisty.rating - 1]}>{number}</span>
          <span class="name">{road.title}</span>
          <span class="length">
            {formatKm(twisty.lengthM)} km ·
            <b style:color={RATING_COLORS[twisty.rating - 1]}>{i18n.t.ride.ratingWords[twisty.rating - 1]}</b>
          </span>
          {#if road.subtitle || added || roads}
            <span class="subtitle">
              {#if added}<span class="added" title={i18n.t.ride.coverageAdds(road.title)} aria-label={i18n.t.ride.coverageAdds(road.title)}>+ {i18n.t.ride.coverageAdded}</span>{/if}
              <!-- A twisty across several roads lists them, each with its own km: the title alone would claim them all. -->
              {#if roads}
                <span class="roads">
                  {#each roads as { title, lengthM }, at (at)}<span class:roads__title={title === road.title}>{title} {formatKm(lengthM)} km</span>{/each}
                </span>
              {:else if road.subtitle}<span class="subtitle__text">{road.subtitle}</span>{/if}
            </span>
          {/if}
          {#if hasWarning(warnings[number - 1])}
            {@const { postedKmh, narrowM, ford, closed } = warnings[number - 1]}
            <span class="chips">
              {#if postedKmh !== null}<span class="chip">{i18n.t.ride.signed(postedKmh)}</span>{/if}
              {#if narrowM !== null}<span class="chip">{i18n.t.ride.narrow(formatKm(narrowM))}</span>{/if}
              {#if ford}<span class="chip">{i18n.t.ride.ford}</span>{/if}
              {#if closed}<span class="chip">{i18n.t.ride.closedChip}</span>{/if}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ol>
{:else if !onlyOption}
  <p class="hint" class:hint--waiting={refining}>{i18n.t.ride.fastestHint}</p>
{/if}

<!-- One paragraph for every caution, on every ride: the band above the button stays the Google Maps line alone. -->
<p class="safety" role="note">
  <!-- This ride's own facts first: a closure can make the ride impossible, so it never trails the general advice. -->
  {#if fordCount > 0 || ride.closedPartOfYear}{i18n.t.ride.rideFacts(fordCount, ride.closedPartOfYear === true, namedClosures(ride.closedRoads))}{/if}
  {#if showsLimitsNote}{i18n.t.ride.safetyLimits}{/if}
  {#if showsFordNote}{i18n.t.ride.safetyFord}{/if}
  {i18n.t.ride.safetyConditions}
</p>

{#if hasTracks}
  <div class="warning" role="note">
    <strong>{i18n.t.ride.tracksWarningTitle(formatKm(ride.trackM))}</strong>
    {i18n.t.ride.tracksWarning}
  </div>
{/if}

<style>
  .mix {
    display: flex;
    gap: 3px;
    height: 6px;
    margin: 18px 0 14px;
  }

  .mix span {
    border-radius: 3px;
    transition: width 0.6s var(--ease-out);
  }

  .mix__curves {
    display: flex;
    overflow: hidden;
  }

  .mix__curves i {
    flex-basis: 0;
  }

  .dot--curves {
    background: var(--gradient);
  }

  /* A card three to a row is about 100 px wide: the words wrap rather than lose the end ("mostly very winding"). */
  .character {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
  }

  .mix__fast,
  .dot--fast {
    background: #5b6780;
  }

  .mix__tracks,
  .dot--tracks {
    background: var(--earth);
  }

  .mix__other,
  .dot--other {
    background: #2b3242;
  }

  .stats {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 8px;
    margin: 0;
  }

  /* Four cards do not fit in a row of the narrowest panel (a 360 px phone): two by two. */
  .stats--grid {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats div {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
  }

  dt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  dd {
    margin: 4px 0 0;
    font: 600 20px var(--font-display);
    font-variant-numeric: tabular-nums;
  }

  dd small {
    margin-left: 3px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .legs {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legs li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    border-top: 1px solid var(--border);
    font: 500 14px var(--font-ui);
  }

  .legs li:first-child {
    border-top: 0;
  }

  /* Each name gives way on its own; the numbers keep their column. */
  .legs__names {
    display: flex;
    flex: 1;
    gap: 6px;
    min-width: 0;
  }

  .legs__names span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .legs__numbers {
    flex: none;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.3;
    text-align: right;
  }

  .legs__numbers b {
    display: block;
    color: var(--amber);
    font-weight: 500;
  }

  .legs__numbers .legs__none {
    color: var(--text-faint);
  }

  h3 {
    margin: 22px 0 8px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .twisties {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .twisties li {
    animation: rise 0.45s var(--ease-out) both;
  }

  .twisties button {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'number name length' 'number subtitle subtitle' 'number chips chips';
    align-items: center;
    column-gap: 12px;
    row-gap: 2px;
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
  }

  @media (hover: hover) {
    .twisties button:hover {
      background: var(--surface-hover);
    }
  }

  /* The row of a twisty tapped on the map: a short glow that fades, so the eye finds it in the list. */
  .twisties li.flash button {
    animation: row-flash 1.2s var(--ease-out);
  }

  @keyframes row-flash {
    from {
      background: color-mix(in srgb, var(--amber) 26%, transparent);
    }
    to {
      background: transparent;
    }
  }

  /* Without motion the row is marked plainly for as long as the flash would last. */
  @media (prefers-reduced-motion: reduce) {
    .twisties li.flash button {
      animation: none;
      background: color-mix(in srgb, var(--amber) 18%, transparent);
    }
  }

  .number {
    grid-area: number;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid var(--pink);
    font: 700 12px var(--font-display);
  }

  /* Under the road's title, not beside it: beside it the title lost its end ("BA-…") in the side panel. */
  .added {
    flex: none;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 181, 71, 0.14);
    color: var(--amber);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  .name {
    grid-area: name;
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .length {
    grid-area: length;
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .length b {
    font-weight: 600;
  }

  .subtitle {
    grid-area: subtitle;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .roads {
    display: flex;
    flex-wrap: wrap;
    column-gap: 4px;
    min-width: 0;
  }

  /* The arrow says riding order to the eye only; a screen reader reads the roads as a list. */
  .roads > span + span::before {
    content: '→ ' / '';
    color: var(--text-faint);
  }

  /* The road the row is named after, so the eye ties the title to its place in the chain. */
  .roads__title {
    font-weight: 500;
  }

  .subtitle__text {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chips {
    grid-area: chips;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(210, 168, 110, 0.1);
    box-shadow: inset 0 0 0 1px rgba(210, 168, 110, 0.3);
    color: var(--earth);
    font-size: 11.5px;
    font-weight: 600;
  }

  .safety {
    margin: 8px 0 0;
    padding: 0 10px;
    color: var(--text-quiet);
    font-size: 12px;
    line-height: 1.5;
  }

  .hint {
    margin: 20px 0 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .warning {
    margin-top: 18px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: rgba(210, 168, 110, 0.08);
    box-shadow: inset 0 0 0 1px rgba(210, 168, 110, 0.3);
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .warning strong {
    color: var(--earth);
    font-weight: 600;
  }

  .hint--waiting {
    visibility: hidden;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
