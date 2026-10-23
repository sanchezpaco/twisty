<script lang="ts">
  import { onMount } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { isSidePanel, onLayoutChange } from '../lib/layout'
  import { behaviourOf, chooserTargets, type GpxApp, MAPS_TARGET, type OpenInTarget, sameTarget, targetName } from '../lib/openIn/openIn'
  import { portal } from '../lib/portal'
  import { sheetCover } from '../lib/sheetCover.svelte'
  import { canShareGpx } from '../lib/shareFile'
  import RideIcon from './RideIcon.svelte'

  interface Props {
    apps: GpxApp[]
    /** The ride has stretches Google Maps would skip: the apps that follow a line come first. */
    gpxFirst: boolean
    /** Every twisty got its pins in the Google Maps link; when not, the sheet advises the GPX. */
    pinnedAll: boolean
    mapsUrl: string
    /** The app the rider chose to always use, marked in the list. */
    saved: OpenInTarget | null
    /** An app that could not be opened a moment ago, named in the hint. */
    failedApp: string | null
    /** The row of buttons the list opens from: in the side panel the list stands above it, inside the panel's column. */
    anchor: HTMLElement | null
    onpick: (target: OpenInTarget, remember: boolean) => void
    onclose: () => void
  }

  let { apps, gpxFirst, pinnedAll, mapsUrl, saved, failedApp, anchor, onpick, onclose }: Props = $props()

  // Changing the app that is always used usually means replacing it.
  // svelte-ignore state_referenced_locally
  let remember = $state(saved !== null)
  // Not every twisty pinned: the apps that follow the line come first, as the advice above them says.
  const targets = $derived(chooserTargets(apps, { gpxFirst: gpxFirst || !pinnedAll }))
  const keyOf = (target: OpenInTarget) => (target.kind === 'app' ? target.packageName : target.kind)
  const iconOf = (target: OpenInTarget) => (target.kind === 'app' ? apps.find((app) => app.packageName === target.packageName)?.icon : undefined)
  const sharesFiles = canShareGpx()

  /** Google Maps would skip tracks, and so may an app that recalculates the route from its own points. */
  const warnsAboutTracks = (target: OpenInTarget) => gpxFirst && (target.kind === 'maps' || (target.kind === 'app' && behaviourOf(target.packageName) === 'recalculates'))
  const warns = (target: OpenInTarget) => warnsAboutTracks(target) || (target.kind === 'maps' && !pinnedAll)
  function noteOf(target: OpenInTarget): string {
    if (warnsAboutTracks(target)) return i18n.t.openIn.skipsTracks
    if (target.kind === 'maps') return pinnedAll ? i18n.t.openIn.mapsFollows : i18n.t.openIn.mapsSkips
    if (target.kind === 'share') return sharesFiles ? i18n.t.openIn.otherAppHint : i18n.t.openIn.downloadGpxHint
    return behaviourOf(target.packageName) === 'recalculates' ? i18n.t.openIn.gpxRecalculates : i18n.t.openIn.gpxFollows
  }

  let side = $state(isSidePanel())
  $effect(() => onLayoutChange(() => (side = isSidePanel())))
  const placement = $derived.by(() => {
    if (!side || !anchor) return null
    const { left, width, top } = anchor.getBoundingClientRect()
    return `left:${left}px;width:${width}px;bottom:${innerHeight - top + 10}px`
  })

  // Over the phone's map the sheet takes the map's foot, so the credit moves above it; beside the side panel it is clear.
  let sheetHeight = $state(0)
  $effect(() => {
    if (placement !== null) return
    sheetCover.heightPx = sheetHeight
    return () => (sheetCover.heightPx = 0)
  })

  let dialog: HTMLElement
  onMount(() => {
    const opener = document.activeElement
    dialog.querySelector<HTMLElement>('.row')?.focus()
    return () => opener instanceof HTMLElement && opener.focus()
  })

  $effect(() =>
    onBackButton(() => {
      onclose()
      return true
    }),
  )
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div class="scrim" class:scrim--clear={placement !== null} use:portal onclick={onclose} role="presentation"></div>
<div class="sheet" class:sheet--anchored={placement !== null} style={placement} use:portal bind:this={dialog} bind:offsetHeight={sheetHeight} role="dialog" aria-modal="true" aria-labelledby="open-in-title">
  <div class="grab" aria-hidden="true"></div>
  <h3 id="open-in-title">{i18n.t.openIn.title}</h3>
  {#if failedApp}<p class="hint">{i18n.t.openIn.unavailable(failedApp)}</p>{/if}
  <!-- In the sheet, not a pop-up, and only when it is true: said where the app is chosen, when Google Maps would skip a
       twisty of this ride. -->
  {#if !pinnedAll}<p class="advice">{i18n.t.openIn.advice}</p>{/if}
  <p class="advice advice--quiet">{i18n.t.openIn.oneWay}</p>

  <label class="always">
    <input type="checkbox" bind:checked={remember} />
    <span class="box" aria-hidden="true"></span>
    {i18n.t.openIn.always}
  </label>

  {#each targets as target (keyOf(target))}
    {@const icon = iconOf(target)}
    {#snippet content()}
      <span class="tile">
        {#if icon}
          <img src={icon} alt="" width="44" height="44" />
        {:else}
          <RideIcon name={target.kind === 'maps' ? 'pin' : sharesFiles ? 'more' : 'gpx'} />
        {/if}
      </span>
      <span class="text">
        <span class="name">{targetName(target, i18n.t.openIn, sharesFiles)}</span>
        <span class="note" class:note--warn={warns(target)}>{noteOf(target)}</span>
      </span>
      {#if sameTarget(target, saved)}<span class="mark" aria-hidden="true">✓</span>{/if}
    {/snippet}
    {#if target.kind === 'maps'}
      <a class="row" href={mapsUrl} target="_blank" rel="noopener" onclick={() => onpick(MAPS_TARGET, remember)}>{@render content()}</a>
    {:else}
      <button class="row" onclick={() => onpick(target, remember)}>{@render content()}</button>
    {/if}
  {/each}
</div>

<style>
  .scrim {
    position: fixed;
    z-index: 40;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    animation: fade 0.2s ease-out both;
  }

  .sheet {
    position: fixed;
    z-index: 41;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 16px calc(14px + env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface-sheet-solid);
    box-shadow: var(--shadow);
    animation: rise 0.28s var(--ease-out) both;
  }

  .grab {
    width: 44px;
    height: 4px;
    margin: 0 auto 14px;
    border-radius: 2px;
    background: var(--border-strong);
  }

  h3 {
    margin: 0 4px 6px;
    font: 600 17px var(--font-display);
  }

  .hint {
    margin: 0 4px 10px;
    color: var(--earth);
    font-size: 13px;
  }

  .advice {
    margin: 0 4px 10px;
    color: var(--earth);
    font-size: 12.5px;
    line-height: 1.4;
  }

  .advice--quiet {
    font-size: 12px;
    color: var(--text-quiet);
  }

  .row {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    text-align: left;
    text-decoration: none;
  }

  .row + .row {
    margin-top: 2px;
  }

  @media (hover: hover) {
    .row:hover {
      background: var(--surface-hover);
    }
  }

  .tile {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text-muted);
    overflow: hidden;
  }

  .tile img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    display: grid;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    font-weight: 600;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note {
    color: var(--text-muted);
    font-size: 12.5px;
    line-height: 1.35;
  }

  .note--warn {
    color: var(--earth);
  }

  .mark {
    color: var(--amber);
    font-weight: 700;
  }

  .always {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    margin-bottom: 4px;
    padding: 0 10px;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
  }

  /* The real checkbox stays for keyboards and screen readers; the box next to it is what is seen. */
  .always input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    left: 0;
    margin: 0;
    cursor: pointer;
  }

  .box {
    display: grid;
    place-items: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    box-shadow: inset 0 0 0 1.5px var(--border-strong);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
  }

  .always input:checked + .box {
    background: var(--gradient);
    box-shadow: none;
  }

  .always input:checked + .box::after {
    content: '✓';
  }

  .always input:focus-visible + .box {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  /* Beside the map, in the side panel: the list stands above the button it came from, inside the panel's column. */
  .scrim--clear {
    background: transparent;
  }

  .sheet--anchored {
    right: auto;
    padding-bottom: 12px;
    border-radius: var(--radius-lg);
    animation: pop 0.2s var(--ease-out) both;
  }

  .sheet--anchored .grab {
    display: none;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scrim,
    .sheet {
      animation: none;
    }
  }
</style>
