<template>
  <!-- Size & interactivity come from parent classes -->
  <div class="scribble-badge relative isolate grid place-items-center" :style="cssVars">
    <!-- Put your number (or any content) here -->
    <slot>0</slot>
  </div>
</template>

<script setup>
const props = defineProps({
  maskUrl: {
    type: String,
    default: 'pattern-square.svg'
  }
});

const { app } = useRuntimeConfig();
const baseURL = app.baseURL || '/';

// Construct the full pattern URL
const fullMaskPath = props.maskUrl.startsWith('http') || props.maskUrl.startsWith('/')
  ? props.maskUrl
  : `${baseURL}images/${props.maskUrl}`.replace(/\/+/g, '/');

const patternUrl = `${baseURL}images/pattern-square.svg`.replace(/\/+/g, '/');

const cssVars = {
  '--pattern-url': `url("${patternUrl}")`,
  '--mask-url': `url("${fullMaskPath}")`
};
</script>

<style scoped>
/* Apply the mask to the host element so regular backgrounds get clipped too */
.scribble-badge {
  -webkit-mask-image: var(--mask-url, var(--pattern-url));
  mask-image: var(--mask-url, var(--pattern-url));
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
  -webkit-mask-image: var(--mask-url, var(--pattern-url));
  mask-image: var(--mask-url, var(--pattern-url));
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
