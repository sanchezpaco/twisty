<script lang="ts">
  import { tick } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { isSidePanel, onLayoutChange } from '../lib/layout'
  import { LOOKS, MAP_THEMES } from '../lib/map/theme'
  import { chooseTheme, mapTheme } from '../lib/map/themeState.svelte'

  let open = $state(false)
  // Beside the map the card opens under the button; on a phone it would hide the middle of the route the rider is
  // comparing styles on, so it becomes a strip to the left of the button, in the band the route fit keeps clear.
  let side = $state(isSidePanel())
  $effect(() => onLayoutChange(() => (side = isSidePanel())))
  let root: HTMLElement
  let button: HTMLButtonElement
  let card = $state<HTMLElement>()

  async function toggle() {
    open = !open
    if (open) {
      await tick()
      card?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    }
  }

  function close(returnFocus: boolean) {
    open = false
    if (returnFocus) button.focus()
  }

  // The card stays open while styles are tried; a touch anywhere else (the map, the sheet being dragged) closes it.
  $effect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => event.target instanceof Node && !root.contains(event.target) && close(false)
    window.addEventListener('pointerdown', outside, true)
    const forgetBack = onBackButton(() => {
      close(true)
      return true
    })
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      forgetBack()
    }
  })

  async function arrow(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = MAP_THEMES[(MAP_THEMES.indexOf(mapTheme.current) + step + MAP_THEMES.length) % MAP_THEMES.length]
    chooseTheme(next)
    await tick()
    card?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }

  /** A hairpin with the route on it, in the colours of the theme: the thumbnail shows what the map will look like. */
  const HAIRPIN = 'M-2 52 C 16 52 18 40 32 40 S 52 28 36 21 S 12 14 30 -2'
  /** The route's widths are for a map; on a 64 px thumbnail they are this much thinner. */
  const THUMB_LINE_SCALE = 0.6
  const THUMB_SIZE_PX = { card: 64, strip: 28 }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && open && close(true)} />

<div class="picker" bind:this={root}>
  <button
    bind:this={button}
    class="layers"
    class:layers--open={open}
    onclick={toggle}
    aria-label={i18n.t.map.style}
    aria-expanded={open}
    title={i18n.t.map.style}
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  </button>
  {#if open}
    <div class="card" class:card--strip={!side} bind:this={card} role="radiogroup" aria-label={i18n.t.map.style} tabindex="-1" onkeydown={arrow}>
      {#each MAP_THEMES as theme (theme)}
        {@const look = LOOKS[theme]}
        {@const active = mapTheme.current === theme}
        <button
          class="tile"
          class:tile--active={active}
          role="radio"
          aria-checked={active}
          tabindex={active ? 0 : -1}
          onclick={() => chooseTheme(theme)}
        >
          <svg viewBox="0 0 64 64" width={side ? THUMB_SIZE_PX.card : THUMB_SIZE_PX.strip} height={side ? THUMB_SIZE_PX.card : THUMB_SIZE_PX.strip} aria-hidden="true">
            <rect width="64" height="64" fill={look.thumbnail.land} />
            <path d="M66 66 L66 40 C 56 44 50 54 46 66Z" fill={look.thumbnail.field} />
            <path d="M40 -2 L66 -2 L66 30 C 56 24 48 14 40 -2Z" fill={look.thumbnail.wood} />
            <path d="M-2 66 L-2 56 C 8 58 20 62 30 66Z" fill={look.thumbnail.water} />
            <path d={HAIRPIN} fill="none" stroke={look.thumbnail.road} stroke-width="3" stroke-linecap="round" />
            <g fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d={HAIRPIN} stroke={look.route.twisty.glow.color ?? look.colors.land} stroke-width={look.route.twisty.glow.width * THUMB_LINE_SCALE} stroke-opacity={look.route.twisty.glow.color ? look.route.twisty.glow.opacity : 0} />
              <path d={HAIRPIN} stroke={look.route.twisty.casing.color} stroke-width={look.route.twisty.casing.width * THUMB_LINE_SCALE} stroke-opacity={look.route.twisty.casing.opacity} />
              <path d={HAIRPIN} stroke={look.ramp[3]} stroke-width={look.route.twisty.width * THUMB_LINE_SCALE} />
            </g>
          </svg>
          <span>{i18n.t.map.themes[theme]}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .layers {
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: var(--map-shadow);
    color: var(--text-muted);
    transition: color 0.3s, box-shadow 0.3s;
  }

  .layers--open {
    color: var(--text);
    box-shadow: 0 0 0 1px rgba(255, 181, 71, 0.5), 0 10px 30px -8px rgba(255, 46, 110, 0.5);
  }

  /* Under the button, against its right edge, in every posture. */
  .card {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius-md);
    background: var(--surface-sheet);
    backdrop-filter: blur(18px);
    box-shadow: var(--map-shadow);
    animation: pop 0.2s var(--ease-out) both;
  }

  .tile {
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 76px;
    padding: 6px 6px 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }

  /* Three tiles must fit beside the button on the 344 px cover screen: 344 - 16 - 44 - 8 = 276. */
  .card--strip {
    top: 0;
    right: calc(100% + 8px);
    gap: 0;
    padding: 4px;
  }

  .card--strip .tile {
    grid-auto-flow: column;
    align-items: center;
    min-width: 0;
    gap: 4px;
    min-height: var(--touch-target);
    padding: 0 8px 0 4px;
  }

  .card--strip .tile svg {
    border-radius: 8px;
  }

  .tile svg {
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--border-strong);
  }

  .tile--active {
    background: var(--surface-raised);
    color: var(--text);
  }

  .tile--active svg {
    box-shadow: 0 0 0 2px var(--amber);
  }

  @media (hover: hover) {
    .tile:hover {
      color: var(--text);
    }
  }

  .tile:focus-visible,
  .layers:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
