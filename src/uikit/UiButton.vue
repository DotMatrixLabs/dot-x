<template>
  <button class="btn btn-primary btn-sm" :disabled="disabled" @click="$emit('click')">
    <slot>{{ label }}</slot>
  </button>
  
</template>

<script>
export default {
  name: 'UiButton',
  props: {
    label: {
      type: String,
      default: 'Submit',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
};
</script>


