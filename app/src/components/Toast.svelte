<script lang="ts">
  import { onMount } from 'svelte'
  import { portal } from '../lib/portal'
  import type { ToastKind } from '../lib/toastState.svelte'
  import RideIcon from './RideIcon.svelte'

  interface Props {
    message: string
    /** The row the toast stands above (or below), centred on it. */
    anchor: HTMLElement | null
    /** Under the anchor instead of above it, for a toast that must not cover what is above. */
    below?: boolean
    /** It has faded out. */
    ondone: () => void
    /** A way back from what the toast reports, such as Undo. */
    action?: { label: string; run: () => void }
    /** Only something done gets a check mark. */
    kind?: ToastKind
  }

  let { message, anchor, ondone, action, kind = 'done', below = false }: Props = $props()

  const SHOWN_MS = 2400
  // Long enough to reach for Undo with a thumb.
  const SHOWN_WITH_ACTION_MS = 5000
  const FADE_MS = 200

  let leaving = $state(false)
  const placement = $derived.by(() => {
    if (!anchor) return null
    const { left, width, top, bottom } = anchor.getBoundingClientRect()
    return below ? `left:${left + width / 2}px;top:${bottom + 10}px` : `left:${left + width / 2}px;bottom:${innerHeight - top + 10}px`
  })

  onMount(() => {
    const shownMs = action ? SHOWN_WITH_ACTION_MS : SHOWN_MS
    const fade = setTimeout(() => (leaving = true), shownMs)
    const done = setTimeout(ondone, shownMs + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  })
</script>

<div class="toast" class:toast--leaving={leaving} class:toast--action={action} style={placement} use:portal role="status" aria-live="polite">
  {#if kind === 'done'}<RideIcon name="check" />{/if}
  {message}
  {#if action}
    <button
      onclick={() => {
        action.run()
        ondone()
      }}>{action.label}</button
    >
  {/if}
</div>

<style>
  /* Above the pinned footer (11), below the sheets (40). */
  .toast {
    position: fixed;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: var(--surface-sheet-solid);
    box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow);
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    transform: translateX(-50%);
    animation: rise 0.2s var(--ease-out) both;
    transition: opacity 0.2s;
  }

  .toast :global(svg) {
    width: 16px;
    height: 16px;
    color: var(--amber);
  }

  .toast--leaving {
    opacity: 0;
  }

  /* Undo is a full touch target. */
  .toast--action {
    height: var(--touch-target);
    padding-right: 4px;
    border-radius: 22px;
  }

  .toast button {
    min-height: var(--touch-target);
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--amber);
    font: 600 14px var(--font-ui);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
