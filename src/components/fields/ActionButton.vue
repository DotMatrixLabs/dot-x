<template>
  <div class="w-full flex flex-row max-w-lg">
    <div class="label w-full flex flex-row justify-between items-center">
      <div class="flex flex-col">
        <span class="label-text">{{ label || buttonTitle }}</span>
        <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
      </div>
      <button
        :class="buttonClass"
        :disabled="disabled"
        @click="onClick"
      >{{ buttonTitle }}</button>
    </div>
  </div>
</template>

<script>
export default {

  props: {
    label: {
      type: String,
      default: 'Click'
    },
    buttonTitle: {
      type: String,
      default: 'Click'
    },
    style: {
      type: String,
      default: '', // primary, secondary, danger
      validator: (value) => ['', 'primary', 'secondary', 'danger'].includes(value)
    },
    description: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },

  computed: {
    buttonClass() {
      const baseClass = `btn btn-md ${this.disabled ? 'btn-disabled' : ''}`;
      
      switch (this.style) {
        case 'primary':
          return `${baseClass} btn-primary`;
        case 'secondary':
          return `${baseClass} btn-secondary`;
        case 'danger':
          return `${baseClass} btn-error`;
        default:
          return baseClass;
      }
    }
  },

  emits: ['apply'],

  methods: {
    onClick() {
      if (this.disabled) return;
      this.$emit('apply');
    }
  }

}
</script>

<style lang="scss" scoped></style>