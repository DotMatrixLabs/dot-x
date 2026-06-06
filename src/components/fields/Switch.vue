<template>
  <div class="w-full flex flex-row max-w-lg m-auto">
    <div class="label w-full">
      <div class="flex flex-col">
        <span class="label-text">
          {{ label }}
          <span v-if="required" class="text-error">*</span>
        </span>
        <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
      </div>
      <input
        :disabled="disabled"
        @change="emitApply"
        v-model="inputValue"
        type="checkbox"
        class="toggle toggle-accent"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      default: 'Switch'
    },
    value: {
      type: Boolean
    },
    description: { type: String, default: '' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },

  watch: {
    value(newValue) {
            this.inputValue = newValue;
        }
  },



  emits: ['apply'],

  data() {
    return {
      inputValue: this.value
    }
  },

  methods: {
    emitApply() {
      this.$emit('apply', this.inputValue)
    }
  },


}
</script>

<style>


</style>