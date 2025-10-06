<template>
    <div class="w-full flex flex-row max-w-lg m-auto items-center justify-between">
      <label class="label w-1/3">
        <div class="flex flex-col">
          <span class="label-text">{{ label }}</span>
          <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
        </div>
      </label>
      <div class="w-1/2 ml-0 flex flex-col items-end">
        <div :class="['badge', styleClass]">{{ displayedText }}</div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'Badge',
    props: {
      label: { type: String, default: 'Label' },
      description: { type: String, default: '' },
      value: { type: String, default: '' },
      text: { type: String, default: '' },
      style: { type: String, default: 'default' }, // default | muted | info | success | warning | error
    },
    computed: {
      displayedText() {
        return (this.text ?? this.value) || '';
      },
      styleClass() {
        switch (this.style) {
          case 'muted':
            return 'badge-neutral';
          case 'info':
            return 'badge-info';
          case 'success':
            return 'badge-success';
          case 'warning':
            return 'badge-warning';
          case 'error':
            return 'badge-error';
          default:
            return '';
        }
      }
    }
  }
  </script>
  
  <style lang="scss" scoped></style>

