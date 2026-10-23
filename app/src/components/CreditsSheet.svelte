<script lang="ts">
  import { onMount } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { portal } from '../lib/portal'
  import { PRIVACY_URL } from '../lib/privacy'

  interface Props {
    onclose: () => void
  }

  let { onclose }: Props = $props()

  let dialog: HTMLElement
  onMount(() => {
    const opener = document.activeElement
    dialog.querySelector<HTMLElement>('.close')?.focus()
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

<div class="scrim" use:portal onclick={onclose} role="presentation"></div>
<div class="sheet" use:portal bind:this={dialog} role="dialog" aria-modal="true" aria-labelledby="credits-title">
  <div class="grab" aria-hidden="true"></div>
  <header>
    <h3 id="credits-title">{i18n.t.credits.title}</h3>
    <button class="close" onclick={onclose}>{i18n.t.credits.close}</button>
  </header>
  <div class="scroll">
    {#each i18n.t.credits.sources as source (source.heading)}
      <section>
        <h4>{source.heading}</h4>
        <p>{source.body}</p>
        <p class="links">
          {#each source.links as link (link.url)}
            <a href={link.url} target="_blank" rel="noopener">{link.label}</a>
          {/each}
        </p>
      </section>
    {/each}
    <section>
      <h4>{i18n.t.credits.risk.heading}</h4>
      <p>{i18n.t.credits.risk.body}</p>
    </section>
    <section>
      <h4>{i18n.t.credits.privacy.heading}</h4>
      <p>{i18n.t.credits.privacy.body}</p>
      <p class="links"><a href={PRIVACY_URL} target="_blank" rel="noopener">{i18n.t.credits.privacy.policy}</a></p>
    </section>
  </div>
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
    display: flex;
    flex-direction: column;
    max-height: 82dvh;
    padding: 10px 16px calc(14px + env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface-sheet-solid);
    box-shadow: var(--shadow);
    animation: rise 0.28s var(--ease-out) both;
  }

  .grab {
    flex: none;
    width: 44px;
    height: 4px;
    margin: 0 auto 10px;
    border-radius: 2px;
    background: var(--border-strong);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    margin: 0 4px 6px;
  }

  h3 {
    margin: 0;
    font: 600 17px var(--font-display);
  }

  .close {
    min-height: var(--touch-target);
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
  }

  .scroll {
    overflow-y: auto;
    padding: 0 4px;
    overscroll-behavior: contain;
  }

  section + section {
    margin-top: 16px;
  }

  h4 {
    margin: 0 0 4px;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    margin-top: 4px;
  }

  .links a {
    color: var(--amber);
    word-break: break-all;
  }

  /* Beside the map, in the side panel: a card in the middle of the screen instead of a sheet. */
  @media (min-width: 700px) {
    .sheet {
      right: auto;
      bottom: auto;
      top: 50%;
      left: 50%;
      width: 440px;
      border-radius: var(--radius-lg);
      transform: translate(-50%, -50%);
      animation: pop 0.2s var(--ease-out) both;
    }

    .grab {
      display: none;
    }
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
