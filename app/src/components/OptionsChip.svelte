<script lang="ts">
  import { i18n } from '../lib/i18n/i18n.svelte'

  interface Props {
    includeTracks: boolean
    ontracks: (include: boolean) => void
    /** Whether the options are unfolded under the chip. */
    open?: boolean
  }

  let { includeTracks, ontracks, open = $bindable(false) }: Props = $props()
</script>

<button class="chip" class:chip--on={includeTracks} aria-expanded={open} aria-controls="options-panel" onclick={() => (open = !open)}>
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="16" cy="7" r="2.5" fill="none" stroke="currentColor" stroke-width="2" />
    <circle cx="8" cy="17" r="2.5" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
  <span>{includeTracks ? i18n.t.options.withTracks : i18n.t.options.label}</span>
  <svg class="chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>

{#if open}
  <div class="disclosure" id="options-panel">
    <button class="switch-row" role="switch" aria-checked={includeTracks} onclick={() => ontracks(!includeTracks)}>
      <span class="text">
        <span class="label">{i18n.t.tracks.label}</span>
        <span class="description">{i18n.t.tracks.off}</span>
      </span>
      <span class="switch" aria-hidden="true"><span></span></span>
    </button>
    {#if includeTracks}<p>{i18n.t.tracks.on}</p>{/if}
  </div>
{/if}

<style>
  /* 32 px to look at, 44 px to hit. */
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    transition: background 0.25s, color 0.25s, box-shadow 0.25s;
  }

  .chip::before {
    content: '';
    position: absolute;
    inset: -6px 0;
  }

  .chip--on {
    background: rgba(210, 168, 110, 0.12);
    box-shadow: inset 0 0 0 1px rgba(210, 168, 110, 0.5);
    color: var(--earth);
  }

  .chevron {
    transition: transform 0.2s var(--ease-out);
  }

  .chip[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  .disclosure {
    margin-top: 8px;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: var(--touch-target);
    padding: 8px 0;
    border: 0;
    background: transparent;
    text-align: left;
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 14.5px;
    font-weight: 500;
  }

  .description {
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .switch {
    flex: none;
    width: 40px;
    height: 24px;
    padding: 2px;
    border-radius: 999px;
    background: var(--border-strong);
    transition: background 0.2s;
  }

  .switch span {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s var(--ease-out);
  }

  [aria-checked='true'] .switch {
    background: var(--earth);
  }

  [aria-checked='true'] .switch span {
    transform: translateX(16px);
  }

  p {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--earth);
  }
</style>
