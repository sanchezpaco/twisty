<script lang="ts">
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { lengthByRating, RATINGS } from '../lib/curves'
  import { formatExtra, formatKm } from '../lib/format'
  import { RATING_COLORS } from '../lib/map/theme'
  import type { RideOption } from '../lib/routing/ride'

  interface Props {
    options: RideOption[]
    selected: number
    /** Only the fastest option is known so far: the rest is still being searched. */
    refining: boolean
    onselect: (index: number) => void
    /** A finger started dragging the slider (the bars or the thumb), or let go: while it drags, the options fly past. */
    onscrub: (scrubbing: boolean) => void
    /** Given when the trip is too short for its stops to be offered: a way to show them anyway. */
    onshowstops?: () => void
  }

  let { options, selected, refining, onselect, onscrub, onshowstops }: Props = $props()

  const MIN_BAR_PERCENT = 10
  /** Stand-ins for the options that are still coming, shaped like a typical slider. */
  const PLACEHOLDER_BAR_PERCENTS = [14, 24, 36, 48, 60, 72, 84, 92, 100]
  const maxTwistyM = $derived(Math.max(1, ...options.map((option) => option.twistyM)))
  const fillPercent = $derived(options.length > 1 ? (selected / (options.length - 1)) * 100 : 0)

  let scrubbing = false

  function scrubbed(now: boolean) {
    if (now === scrubbing) return
    scrubbing = now
    onscrub(now)
  }

  // A tap picks one option and is shown as a step; only a finger that moves while down is scrubbing.
  function dragging(event: PointerEvent) {
    if (event.buttons === 1) scrubbed(true)
  }

  // A slider that goes away under the finger (a new plan) does not leave the map waiting for a release.
  $effect(() => () => scrubbed(false))

  function scrub(event: PointerEvent) {
    if (refining || event.buttons !== 1) return
    const { left, width } = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const index = Math.floor(((event.clientX - left) / width) * options.length)
    onselect(Math.min(options.length - 1, Math.max(0, index)))
  }
</script>

<svelte:window onpointerup={() => scrubbed(false)} onpointercancel={() => scrubbed(false)} />

{#if options.length === 1 && !refining}
  <p class="alone">{i18n.t.slider.noOptions}</p>
  {#if onshowstops}
    <button class="show-stops" onclick={onshowstops}>{i18n.t.slider.showAnyway}</button>
  {/if}
{:else}
<div class="slider" style:--fill="{fillPercent}%" style:--stops={refining ? PLACEHOLDER_BAR_PERCENTS.length : options.length}>
  <!-- The whole block is one drag area: the bars alone are too thin to hit, and the range input below is the accessible control. -->
  <div class="bars" aria-hidden="true" onpointerdown={scrub} onpointermove={(event) => (dragging(event), scrub(event))}>
    {#if refining}
      {#each PLACEHOLDER_BAR_PERCENTS as percent, index (index)}
        <div class="bar bar--placeholder" style:height="{percent}%" style:animation-delay="{index * 90}ms"></div>
      {/each}
      <span class="refining" aria-live="polite">{i18n.t.planning.refining}</span>
    {:else}
    {#each options as option, index (index)}
      {@const lengths = lengthByRating(option.twisties)}
      <div
        class="bar"
        class:bar--active={index === selected}
        class:bar--included={index < selected}
        style:height="{MIN_BAR_PERCENT + ((100 - MIN_BAR_PERCENT) * option.twistyM) / maxTwistyM}%"
      >
        <!-- Hottest curves at the bottom: a bar that glows red from the base rides better roads. -->
        <span class="stack">
          {#each RATINGS as rating (rating)}
            {#if lengths[rating - 1] > 0}
              <span style:flex-grow={lengths[rating - 1]} style:background={RATING_COLORS[rating - 1]}></span>
            {/if}
          {/each}
        </span>
        <span class="tip">{i18n.t.slider.option(formatExtra(option.extraS), formatKm(option.twistyM))}</span>
      </div>
    {/each}
    {/if}
  </div>
  <div class="range">
  <input
    type="range"
    min="0"
    max={options.length - 1}
    step="1"
    value={selected}
    disabled={refining}
    onpointermove={dragging}
    oninput={(event) => onselect(Number(event.currentTarget.value))}
    aria-label={i18n.t.slider.label}
    aria-valuetext={i18n.t.slider.option(formatExtra(options[selected].extraS), formatKm(options[selected].twistyM))}
  />
  </div>
  <div class="ends">
    <span>{i18n.t.slider.fastest}</span>
    <span>{i18n.t.slider.maxCurves}</span>
  </div>
</div>
{/if}

<style>
  .alone {
    margin: 0;
    padding: 4px 0 8px;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .show-stops {
    min-height: var(--touch-target);
    margin-bottom: 4px;
    padding: 0 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: none;
    font: 500 13.5px var(--font-ui);
    color: var(--text-muted);
  }

  .slider {
    --thumb: 26px;
    --bar-gap: 5px;
    --bar-max: 44px;
    /* The width a bar gets: what is left of the row shared by the stops, up to its maximum. */
    --bar-width: min(var(--bar-max), calc((100% - var(--bar-gap) * (var(--stops) - 1)) / var(--stops)));
    /* From the middle of the first bar to the middle of the last: the way the thumb's centre travels. */
    --travel: calc((var(--stops) - 1) * (var(--bar-width) + var(--bar-gap)));
    position: relative;
    padding-top: 4px;
  }

  .bars {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: var(--bar-gap);
    height: 64px;
    margin: 0 calc(var(--thumb) / 2 - 6px);
    touch-action: pan-y;
  }

  /* With few options the bars stay bars instead of growing into blocks. */
  .bar {
    position: relative;
    flex: 1;
    min-width: 0;
    max-width: var(--bar-max);
    border-radius: 5px 5px 2px 2px;
    background: rgba(255, 255, 255, 0.07);
    transition:
      height 0.6s var(--ease-out),
      background 0.35s,
      box-shadow 0.35s,
      transform 0.35s var(--ease-out);
  }

  .bar--placeholder {
    background: rgba(255, 255, 255, 0.05);
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .refining {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12.5px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  @keyframes shimmer {
    50% {
      background: rgba(255, 255, 255, 0.11);
    }
  }

  .stack {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-radius: inherit;
    overflow: hidden;
    opacity: 0.4;
    transition: opacity 0.35s;
  }

  .stack span {
    flex-basis: 0;
  }

  .bar--included .stack {
    opacity: 0.7;
  }

  .bar--active .stack {
    opacity: 1;
  }

  .bar--active {
    box-shadow: 0 0 22px -2px rgba(255, 46, 110, 0.7);
    transform: scaleY(1.04);
    transform-origin: bottom;
  }

  .tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    padding: 5px 9px;
    border-radius: 8px;
    background: #1a1f2b;
    font-size: 12px;
    white-space: nowrap;
    color: var(--text);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 4px);
    transition: opacity 0.2s, transform 0.2s;
  }

  @media (hover: hover) {
    .bar:hover .tip {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .range {
    margin: 0 calc(var(--thumb) / 2 - 6px);
  }

  /* The thumb stops over the middle of each bar: a native range runs its thumb's centre from half a thumb in from
     either end, so the input is as wide as that travel plus a thumb, centred under the bars. */
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: calc(var(--travel) + var(--thumb));
    height: var(--touch-target);
    margin: 0 0 0 calc((100% - var(--travel)) / 2 - var(--thumb) / 2);
    background: transparent;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--amber), var(--pink) var(--fill), rgba(255, 255, 255, 0.08) var(--fill));
  }

  input[type='range']::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--amber), var(--pink) var(--fill), rgba(255, 255, 255, 0.08) var(--fill));
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((6px - var(--thumb)) / 2);
    border-radius: 50%;
    border: 4px solid var(--bg);
    background: #fff;
    box-shadow: 0 0 0 1.5px rgba(255, 46, 110, 0.9), 0 6px 22px rgba(255, 46, 110, 0.55);
    transition: transform 0.2s var(--ease-out);
  }

  input[type='range']::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    border: 4px solid var(--bg);
    background: #fff;
    box-shadow: 0 0 0 1.5px rgba(255, 46, 110, 0.9), 0 6px 22px rgba(255, 46, 110, 0.55);
  }

  input[type='range']:focus-visible {
    outline: none;
  }

  input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 1.5px rgba(255, 46, 110, 0.9), 0 0 0 6px rgba(255, 181, 71, 0.25), 0 6px 22px rgba(255, 46, 110, 0.55);
  }

  input[type='range']:active::-webkit-slider-thumb {
    transform: scale(1.12);
  }

  .ends {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
</style>
