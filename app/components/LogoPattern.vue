<template>
  <!-- Size & interactivity come from parent classes -->
  <div class="scribble-badge relative isolate grid place-items-center">
    <!-- Put your number (or any content) here -->
    <slot>0</slot>
  </div>
</template>

<script setup>
// no props needed — style via classes on the component usage
</script>

<style scoped>
/* Apply the mask to the host element so regular backgrounds get clipped too */
.scribble-badge {
  -webkit-mask-image: var(--mask-url, url("/website/images/pattern-square.svg"));
  mask-image: var(--mask-url, url("/website/images/pattern-square.svg"));
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: var(--mask-position, center);
  mask-position: var(--mask-position, center);
  -webkit-mask-size: var(--mask-size, contain);
  mask-size: var(--mask-size, contain);
}

/* Use ::before for the masked fill, ::after for an optional overlay (scrim) */
.scribble-badge::before,
.scribble-badge::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;

  /* Mask shape (user can override URL via a CSS var) */
  -webkit-mask-image: var(--mask-url, url("/website/images/pattern-square.svg"));
  mask-image: var(--mask-url, url("/website/images/pattern-square.svg"));
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: var(--mask-position, center);
  mask-position: var(--mask-position, center);
  -webkit-mask-size: var(--mask-size, contain);
  mask-size: var(--mask-size, contain);
}

/* Base fill; you’ll usually override with Tailwind (e.g., before:bg-primary-500 or before:bg-[url(...)] ) */
.scribble-badge::before {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Overlay/scrim (set with after:bg-black/40, etc.) */
.scribble-badge::after {
  background: transparent;
}
</style>
