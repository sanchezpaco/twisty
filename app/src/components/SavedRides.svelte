<script lang="ts">
  import { tick } from 'svelte'
  import { dayLabel } from '../lib/dayLabel'
  import { formatDuration, formatKm } from '../lib/format'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import type { SavedRide } from '../lib/savedRide'
  import {
    addFolder,
    deleteFolder,
    deleteRide,
    moveRide,
    renameFolder,
    renameRide,
    ridesIn,
    folderNamed,
    type SavedStore,
    sortedFolders,
  } from '../lib/savedRides'
  import { changeSaved, savedRides } from '../lib/savedRidesState.svelte'
  import { showToast } from '../lib/toastState.svelte'
  import RideIcon from './RideIcon.svelte'
  import RideThumb from './RideThumb.svelte'

  interface Props {
    /** The folder shown, or null for the top of the list: the folders, then the rides in none. */
    folderId: string | null
    /** Beside the map the list sits inside the panel; on the phone it takes the whole screen. */
    inline: boolean
    onfolder: (folderId: string | null) => void
    onopen: (ride: SavedRide) => void
    onback: () => void
  }

  let { folderId, inline, onfolder, onopen, onback }: Props = $props()

  const store = $derived(savedRides.store)
  const folder = $derived(folderId === null ? null : (store.folders.find((candidate) => candidate.id === folderId) ?? null))
  const folders = $derived(sortedFolders(store, i18n.locale))
  const rides = $derived(ridesIn(store, folder?.id ?? null))

  /** The ⋯ menu that is open: a ride's, or the folder's in the title bar. */
  let menu = $state<{ ride: SavedRide; moving: boolean } | { folder: true } | null>(null)
  /** What is being renamed in place: a ride by id, the folder, or a new folder being named. */
  let editing = $state<{ ride: string } | { folder: true } | { newFolder: true } | null>(null)
  let draft = $state('')
  let field = $state<HTMLInputElement | null>(null)
  let foot = $state<HTMLElement | null>(null)
  let openMenu = $state<HTMLElement | null>(null)

  // Near the bottom of a long list a menu opens below the fold: it is brought into view.
  $effect(() => {
    openMenu?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  })

  // A folder deleted (or undone away) while open leaves the rider at the top of the list.
  $effect(() => {
    if (folderId !== null && !folder) onfolder(null)
  })

  const change = (next: SavedStore, done: string | null = null) => changeSaved(next, done, foot)

  async function startEditing(what: NonNullable<typeof editing>, text: string) {
    menu = null
    editing = what
    draft = text
    await tick()
    field?.focus()
    field?.select()
  }

  function finishEditing() {
    const what = editing
    editing = null
    if (!what || !draft.trim()) return
    const clash = folderNamed(store, draft)
    if ('ride' in what) change(renameRide(store, what.ride, draft))
    else if ('folder' in what && folder && clash && clash.id !== folder.id) showToast(i18n.t.saved.folderExists(clash.name), foot, { kind: 'problem' })
    else if ('folder' in what && folder) change(renameFolder(store, folder.id, draft))
    else if ('newFolder' in what && clash) showToast(i18n.t.saved.folderExists(clash.name), foot, { kind: 'problem' })
    else if ('newFolder' in what) change(addFolder(store, draft, crypto.randomUUID(), Date.now()).store)
  }

  function editKey(event: KeyboardEvent) {
    if (event.key === 'Enter') finishEditing()
    else if (event.key === 'Escape') {
      event.stopPropagation()
      editing = null
    }
  }

  function removeRide(ride: SavedRide) {
    menu = null
    change(deleteRide(store, ride.id), i18n.t.saved.rideDeleted(ride.name))
  }

  function moveTo(ride: SavedRide, target: string | null) {
    menu = null
    change(moveRide(store, ride.id, target))
  }

  function removeFolder() {
    menu = null
    if (!folder) return
    const name = folder.name
    change(deleteFolder(store, folder.id), i18n.t.saved.folderDeleted(name))
  }

  const meta = (ride: SavedRide) => `${dayLabel(ride.savedAt, Date.now(), i18n.locale, i18n.t.history)} · ${formatDuration(ride.ride.timeS)}`
</script>

<section class="saved" class:saved--inline={inline} aria-labelledby="saved-title">
  {#if menu}
    <div class="scrim" onclick={() => (menu = null)} role="presentation"></div>
  {/if}
  <div class="bar">
    <button class="icon" onclick={folder ? () => onfolder(null) : onback} aria-label={i18n.t.saved.back}>
      <RideIcon name="back" />
    </button>
    {#if editing && 'folder' in editing}
      <input class="rename rename--title" bind:value={draft} bind:this={field} onkeydown={editKey} onblur={finishEditing} aria-label={i18n.t.saved.renameFolder} />
    {:else}
      <h2 id="saved-title">{folder?.name ?? i18n.t.saved.heading}</h2>
    {/if}
    {#if folder}
      <button class="icon" onclick={() => (menu = { folder: true })} aria-label={i18n.t.saved.more(folder.name)} aria-haspopup="menu">
        <RideIcon name="more" />
      </button>
    {/if}
  </div>

  {#if menu && 'folder' in menu}
    <div class="menu menu--bar" role="menu" bind:this={openMenu}>
      <button role="menuitem" onclick={() => startEditing({ folder: true }, folder?.name ?? '')}>{i18n.t.saved.renameFolder}</button>
      <button role="menuitem" class="danger" onclick={removeFolder}>{i18n.t.saved.deleteFolder}</button>
    </div>
  {/if}

  <div class="list">
    {#if !folder}
      {#if folders.length > 0}<h3>{i18n.t.saved.folders}</h3>{/if}
      <ul>
        {#each folders as each (each.id)}
          <li>
            <button class="row" onclick={() => onfolder(each.id)}>
              <span class="tile"><RideIcon name="folder" /></span>
              <span class="text">
                <span class="name">{each.name}</span>
                <span class="meta">{i18n.t.saved.rides(ridesIn(store, each.id).length)}</span>
              </span>
              <span class="chevron"><RideIcon name="chevron" /></span>
            </button>
          </li>
        {/each}
      </ul>
      {#if editing && 'newFolder' in editing}
        <input class="rename" bind:value={draft} bind:this={field} onkeydown={editKey} onblur={finishEditing} placeholder={i18n.t.saved.newFolderName} aria-label={i18n.t.saved.newFolderName} />
      {:else}
        <button class="new" onclick={() => startEditing({ newFolder: true }, '')}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          {i18n.t.saved.newFolder}
        </button>
      {/if}
      {#if rides.length > 0 && folders.length > 0}<h3>{i18n.t.saved.loose}</h3>{/if}
    {:else if rides.length === 0}
      <p class="empty">{i18n.t.saved.emptyFolder}</p>
    {/if}

    <ul>
      {#each rides as ride (ride.id)}
        <li>
          {#if editing && 'ride' in editing && editing.ride === ride.id}
            <div class="row">
              <RideThumb {ride} />
              <input class="rename" bind:value={draft} bind:this={field} onkeydown={editKey} onblur={finishEditing} aria-label={i18n.t.saved.rename} />
            </div>
          {:else}
            <button class="row" onclick={() => onopen(ride)}>
              <RideThumb {ride} />
              <span class="text">
                <span class="name">{ride.name}</span>
                <span class="meta">{meta(ride)} · <b>{i18n.t.saved.curves(formatKm(ride.ride.twistyM))}</b></span>
              </span>
            </button>
            <button class="icon" onclick={() => (menu = { ride, moving: false })} aria-label={i18n.t.saved.more(ride.name)} aria-haspopup="menu">
              <RideIcon name="more" />
            </button>
          {/if}
          {#if menu && 'ride' in menu && menu.ride.id === ride.id}
            <div class="menu" role="menu" bind:this={openMenu}>
              {#if menu.moving}
                <button role="menuitemradio" aria-checked={ride.folderId === null} onclick={() => moveTo(ride, null)}>{i18n.t.saved.noFolder}</button>
                {#each folders as each (each.id)}
                  <button role="menuitemradio" aria-checked={ride.folderId === each.id} onclick={() => moveTo(ride, each.id)}>{each.name}</button>
                {/each}
              {:else}
                <button role="menuitem" onclick={() => startEditing({ ride: ride.id }, ride.name)}>{i18n.t.saved.rename}</button>
                {#if folders.length > 0}
                  <button role="menuitem" onclick={() => (menu = { ride, moving: true })}>{i18n.t.saved.move}</button>
                {/if}
                <button role="menuitem" class="danger" onclick={() => removeRide(ride)}>{i18n.t.saved.delete}</button>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <!-- Where the toasts stand: the foot of the list. -->
  <div class="foot" bind:this={foot}></div>
</section>


<style>
  /* On the phone the list takes the whole screen, as the place search does. */
  .saved {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    background: var(--surface-sheet-solid);
    animation: enter 0.24s var(--ease-out) both;
  }

  .saved--inline {
    position: relative;
    z-index: auto;
    inset: auto;
    padding-top: 0;
    background: none;
    animation: none;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 56px;
    padding: 4px 20px 0 8px;
  }

  /* 14: in the side panel the list follows the fields at the usual section spacing. */
  .saved--inline .bar {
    min-height: var(--touch-target);
    padding: 0;
    margin: 0 0 0 -10px;
  }

  h2 {
    flex: 1;
    min-width: 0;
    margin: 0 0 0 4px;
    overflow: hidden;
    font: 600 19px var(--font-display);
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 24px;
  }

  .saved--inline .list {
    overflow: visible;
    padding: 0;
  }

  h3 {
    margin: 16px 0 2px;
    color: var(--text-faint);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    position: relative;
    display: flex;
    align-items: center;
    border-top: 1px solid var(--border);
  }

  li:first-child {
    border-top: 0;
  }

  .row {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: 60px;
    padding: 8px 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--amber);
  }

  .text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .name,
  .meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    font: 500 15px var(--font-ui);
  }

  .meta {
    margin-top: 2px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .meta b {
    color: var(--amber);
    font-weight: 500;
  }

  .chevron {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--touch-target);
    color: var(--text-muted);
  }

  .chevron :global(svg) {
    transform: rotate(-90deg);
  }

  .icon {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    border: 0;
    background: none;
    color: var(--text-muted);
  }

  .bar .icon {
    color: var(--text);
  }

  .new {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--touch-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--amber);
    font: 500 14px var(--font-ui);
  }

  .rename {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 44px;
    margin: 6px 0;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1.5px var(--amber);
    color: var(--text);
    font: 500 15px var(--font-ui);
  }

  .rename:focus {
    outline: none;
  }

  .rename--title {
    margin: 0 0 0 4px;
  }

  .empty {
    margin: 20px 0;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .scrim {
    position: fixed;
    z-index: 21;
    inset: 0;
  }

  .menu {
    position: absolute;
    z-index: 22;
    top: calc(100% - 6px);
    right: 0;
    min-width: 210px;
    padding: 6px;
    border-radius: 14px;
    background: var(--surface-sheet-solid);
    box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow);
  }

  .menu--bar {
    top: 56px;
    right: 12px;
  }

  /* In the side panel the list scrolls inside the panel, which would clip a floating menu: it opens in the flow. */
  .saved--inline li {
    flex-wrap: wrap;
  }

  .saved--inline .menu {
    position: static;
    width: 100%;
    margin: 0 0 8px;
  }

  .menu button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    font: 500 15px var(--font-ui);
    text-align: left;
  }

  .menu button[aria-checked='true'] {
    color: var(--amber);
  }

  .menu .danger {
    color: var(--coral);
  }

  .foot {
    flex: none;
    height: env(safe-area-inset-bottom);
  }

  @media (hover: hover) {
    .row:hover .name,
    .icon:hover {
      color: var(--amber);
    }

    .menu button:hover {
      background: var(--surface-hover);
    }
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .saved {
      animation: none;
    }
  }
</style>
