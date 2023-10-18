<template>
  <svg :class="[size === 'small' ? 'h-3 w-3' : 'w-6 h-6', 'spinner',]" viewBox="0 0 50 50">
    <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
  </svg>
</template>

<script>
export default {

  props: ['size'],
  name: "loadingSpinner",
};
</script>

<style  scoped>
.spinner {
  animation: rotate 2s linear infinite;
}

.path {
  stroke: rgb(255, 255, 255);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }

  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>