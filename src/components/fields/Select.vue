<template>
  <div :class="disabled ? 'opacity-50' : ''" class="w-full flex flex-row max-w-lg m-auto items-center justify-between">
    <label class="label w-1/3">
      <div class="flex flex-col">
        <span class="label-text">
          {{ label }}
          <span v-if="required" class="text-error">*</span>
        </span>
        <span v-if="description" class="label-text-alt opacity-60">{{ description }}</span>
        <span v-if="help" class="label-text-alt opacity-60">{{ help }}</span>
      </div>
    </label>
    <div class="w-1/2 ml-0 flex flex-col">
      <select
        class="select select-bordered select-sm"
        v-model="internalValue"
        :disabled="disabled"
        :required="required"
        @change="emitApply"
        @input="onInput"
      >
        <option v-if="placeholder" disabled value="__placeholder__">{{ placeholder }}</option>
        <option v-for="(opt, idx) in normalizedOptions" :key="opt.value ?? idx" :value="opt.value" class="px-2 text-sm cursor-pointer rounded-lg">{{ opt.label }}</option>
      </select>
      <div class="h-5 mt-1 text-error text-xs">
        <span :class="requiredError ? '' : 'opacity-0'">{{ errorText }}</span>
      </div>
    </div>
  </div>

</template>

<script>
export default {
  props: {
    label: { type: String, default: 'Select' },
    placeholder: { type: String, default: '' },
    value: { type: [String, Number, Boolean], default: '' },
    description: { type: String, default: '' },
    help: { type: String, default: '' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    options: { type: Array, default: () => [] },
  },

  emits: ['apply'],

  computed: {
    normalizedOptions() {
      if (!Array.isArray(this.options)) return [];
      return this.options.map((opt) => {
        if (opt && typeof opt === 'object' && 'value' in opt && 'label' in opt) {
          return opt;
        }
        return { value: opt, label: String(opt) };
      });
    },
  },

  watch: {
    value(newValue) {
      this.internalValue = newValue;
    }
  },

  data() {
    return {
      internalValue: this.value,
      requiredError: false,
      errorText: 'This field is required!',
    };
  },

  methods: {
    emitApply() {
      const current = this.internalValue;
      const isUnset = current === undefined || current === null || current === '' || current === '__placeholder__';
      if (this.required && isUnset) {
        this.requiredError = true;
        return;
      }
      this.$emit('apply', this.internalValue);
    },
    onInput() {
      this.requiredError = false;
    }
  },
}
</script>

<style lang="scss" scoped></style>