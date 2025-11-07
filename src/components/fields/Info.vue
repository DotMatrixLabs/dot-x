<template>
  <div class="w-full max-w-lg m-auto">
    <div :class="['alert', 'border', 'flex', 'items-start', 'gap-3', 'my-1', alertClass, borderClass]">
      <svg 
        v-if="variant !== 'default'"
        xmlns="http://www.w3.org/2000/svg" 
        :class="['flex-shrink-0', 'w-5', 'h-5', 'mt-0.5', iconClass]" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          v-if="variant === 'info'"
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path 
          v-else-if="variant === 'success'"
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path 
          v-else-if="variant === 'warning'"
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
        <path 
          v-else-if="variant === 'error'"
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span :class="['text-sm', textClass]">{{ displayedText }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Info',
  props: {
    value: { type: String, default: '' },
    text: { type: String, default: '' },
    variant: { type: String, default: 'default' }, // default | info | success | warning | error
  },
  computed: {
    displayedText() {
      return (this.text ?? this.value) || '';
    },
    alertClass() {
      return 'bg-transparent';
    },
    borderClass() {
      switch (this.variant) {
        case 'info':
          return 'border-info';
        case 'success':
          return 'border-success';
        case 'warning':
          return 'border-warning';
        case 'error':
          return 'border-error';
        default:
          return 'border-base-300';
      }
    },
    iconClass() {
      switch (this.variant) {
        case 'info':
          return 'text-info opacity-80';
        case 'success':
          return 'text-success opacity-80';
        case 'warning':
          return 'text-warning opacity-80';
        case 'error':
          return 'text-error opacity-80';
        default:
          return 'opacity-70';
      }
    },
    textClass() {
      switch (this.variant) {
        case 'info':
          return 'text-info opacity-90';
        case 'success':
          return 'text-success opacity-90';
        case 'warning':
          return 'text-warning opacity-90';
        case 'error':
          return 'text-error opacity-90';
        default:
          return 'opacity-80';
      }
    }
  }
}
</script>

<style lang="scss" scoped></style>

