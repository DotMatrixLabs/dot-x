<template>
    <div class="w-full flex flex-row max-w-lg m-auto items-center justify-between">
      <label class="label w-1/3">
        <div class="flex flex-col">
          <span class="label-text">{{ label }}</span>
          <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
        </div>
      </label>
      <div class="w-1/2 ml-0 flex flex-col items-end">
        <div :class="['text-sm', 'text-right', styleClass]">{{ displayedText }}</div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'TextDisplay',
    props: {
      label: { type: String, default: 'Label' },
      description: { type: String, default: '' },
      value: { type: String, default: '' },
      text: { type: String, default: '' },
      variant: { type: String, default: 'default' }, // default | muted | info | success | warning | error
    },
    computed: {
      displayedText() {
        return (this.text ?? this.value) || '';
      },
      styleClass() {
        switch (this.variant) {
          case 'muted':
            return 'opacity-60';
          case 'info':
            return 'text-info';
          case 'success':
            return 'text-success';
          case 'warning':
            return 'text-warning';
          case 'error':
            return 'text-error';
          default:
            return '';
        }
      }
    }
  }
  </script>
  
  <style lang="scss" scoped></style>