<script lang="ts">
  let { size = 30 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <defs>
    <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffb547" />
      <stop offset=".5" stop-color="#ff6b57" />
      <stop offset="1" stop-color="#ff2e6e" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="9" fill="#0b0e14" stroke="rgba(255,255,255,0.1)" />
  <path
    d="M5 22C9 22 9 10 13 10S17 22 21 22 25 10 27 10"
    fill="none"
    stroke="url(#logo-gradient)"
    stroke-width="3.2"
    stroke-linecap="round"
  />
</svg>
