<template>
  <div class="form-control w-full">
    <label v-if="label || description" class="label">
      <span v-if="label" class="label-text">{{ label }}</span>
      <span v-if="description" class="label-text-alt opacity-70">{{ description }}</span>
    </label>
    <input
      class="input input-bordered w-full"
      :placeholder="placeholder || ''"
      type="text"
      v-model="internalValue"
      @change="handleChange"
    />
  </div>
  
</template>

<script>
export default {
  name: 'UiTextInput',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    label: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      internalValue: this.modelValue,
    };
  },
  watch: {
    modelValue(newVal) {
      this.internalValue = newVal;
    },
  },
  methods: {
    handleChange() {
      this.$emit('update:modelValue', this.internalValue);
      this.$emit('change', this.internalValue);
    },
  },
};
</script>


