<script lang="ts" module>
  /** Where the ride goes: a folder, a new folder by name, or none. */
  export type FolderChoice = { id: string } | { newName: string } | null
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { isSidePanel, onLayoutChange } from '../lib/layout'
  import { portal } from '../lib/portal'
  import { sheetCover } from '../lib/sheetCover.svelte'
  import { sortedFolders } from '../lib/savedRides'
  import { savedRides } from '../lib/savedRidesState.svelte'
  import RideIcon from './RideIcon.svelte'

  interface Props {
    /** The name to start from: the trip's, or the saved ride's own. */
    name: string
    /** The folder to start from (null: none). */
    folderId: string | null
    /** The ride is already saved: the sheet renames, moves or removes it. */
    editing: boolean
    /** The row of buttons the sheet opens from: in the side panel it stands above it. */
    anchor: HTMLElement | null
    onsave: (name: string, folder: FolderChoice) => void
    onremove: () => void
    onclose: () => void
  }

  let { name: initialName, folderId, editing, anchor, onsave, onremove, onclose }: Props = $props()

  // svelte-ignore state_referenced_locally
  let name = $state(initialName)
  // svelte-ignore state_referenced_locally
  let chosen = $state<string | null>(folderId)
  /** The "New folder" chip turned into a field. */
  let creating = $state(false)
  let newName = $state('')
  let newField = $state<HTMLInputElement | null>(null)

  const folders = $derived(sortedFolders(savedRides.store, i18n.locale))

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

  // The name field does not take the focus: the keyboard would cover the folders and Save, and most saves keep the name.
  let dialog: HTMLElement
  onMount(() => {
    const opener = document.activeElement
    dialog.querySelector<HTMLElement>('.chip--on')?.focus()
    return () => opener instanceof HTMLElement && opener.focus()
  })

  $effect(() =>
    onBackButton(() => {
      onclose()
      return true
    }),
  )

  $effect(() => {
    if (creating) newField?.focus()
  })

  function save() {
    const folder: FolderChoice = creating && newName.trim() ? { newName: newName.trim() } : chosen === null ? null : { id: chosen }
    onsave(name.trim() || initialName, folder)
  }

  function choose(id: string | null) {
    chosen = id
    creating = false
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div class="scrim" class:scrim--clear={placement !== null} use:portal onclick={onclose} role="presentation"></div>
<div class="sheet" class:sheet--anchored={placement !== null} style={placement} use:portal bind:this={dialog} bind:offsetHeight={sheetHeight} role="dialog" aria-modal="true" aria-labelledby="save-ride-title">
  <div class="grab" aria-hidden="true"></div>
  <h3 id="save-ride-title">{editing ? i18n.t.saved.editTitle : i18n.t.saved.sheetTitle}</h3>

  <label class="label" for="save-ride-name">{i18n.t.saved.name}</label>
  <input id="save-ride-name" class="field" type="text" autocomplete="off" bind:value={name} onkeydown={(event) => event.key === 'Enter' && save()} />

  <span class="label">{i18n.t.saved.folder}</span>
  <div class="chips" role="radiogroup" aria-label={i18n.t.saved.folder}>
    <button class="chip" class:chip--on={!creating && chosen === null} role="radio" aria-checked={!creating && chosen === null} onclick={() => choose(null)}>
      {i18n.t.saved.noFolder}
    </button>
    {#each folders as folder (folder.id)}
      <button class="chip" class:chip--on={!creating && chosen === folder.id} role="radio" aria-checked={!creating && chosen === folder.id} onclick={() => choose(folder.id)}>
        <RideIcon name="folder" />
        {folder.name}
      </button>
    {/each}
    {#if creating}
      <input
        class="chip chip--field"
        type="text"
        autocomplete="off"
        placeholder={i18n.t.saved.newFolderName}
        aria-label={i18n.t.saved.newFolderName}
        bind:value={newName}
        bind:this={newField}
        onkeydown={(event) => event.key === 'Enter' && save()}
        onblur={() => !newName.trim() && (creating = false)}
      />
    {:else}
      <button class="chip chip--new" onclick={() => (creating = true)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        {i18n.t.saved.newFolder}
      </button>
    {/if}
  </div>

  <button class="save" onclick={save}>{editing ? i18n.t.saved.done : i18n.t.saved.save}</button>
  {#if editing}
    <button class="remove" onclick={onremove}>{i18n.t.saved.remove}</button>
  {/if}
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
    padding: 10px 20px calc(16px + env(safe-area-inset-bottom));
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
    margin: 0 0 4px;
    font: 600 17px var(--font-display);
  }

  .label {
    display: block;
    margin: 14px 0 6px;
    color: var(--text-muted);
    font: 600 11px var(--font-ui);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field {
    box-sizing: border-box;
    width: 100%;
    height: 48px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border-strong);
    color: var(--text);
    font: 500 15px var(--font-ui);
  }

  .field:focus {
    outline: none;
    box-shadow: inset 0 0 0 1.5px var(--amber);
  }

  /* About three rows of folders; more scroll. */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 148px;
    overflow-y: auto;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 22px;
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text);
    font: 500 14px var(--font-ui);
  }

  .chip--on {
    background: rgba(255, 181, 71, 0.14);
    box-shadow: inset 0 0 0 1.5px var(--amber);
    color: var(--amber);
  }

  .chip--new {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--border-strong);
    color: var(--text-muted);
  }

  .chip--field {
    width: 180px;
    box-shadow: inset 0 0 0 1.5px var(--amber);
  }

  .chip:focus-visible,
  .save:focus-visible,
  .remove:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  /* The field's own ring says it has the focus. */
  .chip--field:focus,
  .chip--field:focus-visible {
    outline: none;
  }

  .save {
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

  .remove {
    display: block;
    width: 100%;
    min-height: var(--touch-target);
    margin-top: 6px;
    border: 0;
    background: transparent;
    color: var(--coral);
    font: 500 14px var(--font-ui);
  }

  /* Beside the map, in the side panel: the sheet stands above the button it came from, inside the panel's column. */
  .scrim--clear {
    background: transparent;
  }

  .sheet--anchored {
    right: auto;
    padding-bottom: 16px;
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
