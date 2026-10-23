<script lang="ts">
  interface Props {
    name: 'open' | 'gpx' | 'pin' | 'more' | 'chevron' | 'share' | 'check' | 'bookmark' | 'bookmarked' | 'folder' | 'replan' | 'back'
  }

  let { name }: Props = $props()
</script>

<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'open'}
    <path d="M7 17 17 7M9 7h8v8" />
  {:else if name === 'gpx'}
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  {:else if name === 'pin'}
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  {:else if name === 'more'}
    <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
  {:else if name === 'share'}
    <!-- The Android glyph, three nodes and two lines: the iOS box with an arrow would read as a second "open in". -->
    <circle cx="18" cy="5.5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="18.5" r="2.6" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  {:else if name === 'check'}
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  {:else if name === 'bookmark' || name === 'bookmarked'}
    <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" fill={name === 'bookmarked' ? 'currentColor' : 'none'} />
  {:else if name === 'folder'}
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />
  {:else if name === 'replan'}
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5" />
  {:else if name === 'back'}
    <path d="M19 12H5M11 6l-6 6 6 6" />
  {:else}
    <path d="m6 9 6 6 6-6" />
  {/if}
</svg>
