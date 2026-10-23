<script lang="ts">
  import { onMount } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { isSidePanel, onLayoutChange } from '../lib/layout'
  import { portal } from '../lib/portal'
  import { sheetCover } from '../lib/sheetCover.svelte'

  interface Props {
    /** The row of buttons the sheet opens from: in the side panel it stands above it. */
    anchor: HTMLElement | null
    onshare: () => void
    onclose: () => void
  }

  let { anchor, onshare, onclose }: Props = $props()

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

  // Cancel takes the focus: a stray Enter keeps the rider's position to themselves.
  let dialog: HTMLElement
  onMount(() => {
    const opener = document.activeElement
    dialog.querySelector<HTMLElement>('.cancel')?.focus()
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
<div class="sheet" class:sheet--anchored={placement !== null} style={placement} use:portal bind:this={dialog} bind:offsetHeight={sheetHeight} role="alertdialog" aria-modal="true" aria-describedby="share-here-text">
  <div class="grab" aria-hidden="true"></div>
  <p id="share-here-text" class="text">{i18n.t.share.endsHere}</p>
  <button class="share" onclick={onshare}>{i18n.t.share.shareAnyway}</button>
  <button class="cancel" onclick={onclose}>{i18n.t.share.cancel}</button>
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

  .text {
    margin: 0 4px;
    font: 500 16px/1.4 var(--font-ui);
  }

  .share {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 54px;
    margin-top: 20px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--gradient);
    color: #fff;
    font: 600 17px var(--font-ui);
  }

  .cancel {
    display: block;
    width: 100%;
    min-height: var(--touch-target);
    margin-top: 6px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    font: 500 15px var(--font-ui);
  }

  .share:focus-visible,
  .cancel:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  /* Beside the map, in the side panel: the sheet stands above the button it came from, inside the panel's column. */
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
