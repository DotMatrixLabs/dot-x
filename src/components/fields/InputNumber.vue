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
            <input
                :disabled="disabled"
                :min="min"
                :max="max"
                :step="step"
                @input="onInput"
                @change="emitApply"
                @keyup.enter="emitApply"
                v-model.number="inputValue"
                type="number"
                :placeholder="placeholder"
                class="input input-bordered input-sm"
            />
            <div class="h-5 mt-1 text-error text-xs">
                <span :class="requiredError ? '' : 'opacity-0'">{{ errorText }}</span>
            </div>
        </div>
    </div>
</template>
  
<script>
export default {
    name: 'InputNumber',
    props: {
        label: { type: String, default: 'Label' },
        placeholder: { type: String, default: '' },
        value: { type: [String, Number], default: '' },
        description: { type: String, default: '' },
        help: { type: String, default: '' },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        step: { type: Number, default: 1 },
    },

    emits: ['apply'],

    watch: {
        value(newValue) {
            this.inputValue = newValue;
        },
    },

    data() {
        return {
            inputValue: this.value,
            requiredError: false,
            errorText: 'This field is required!'
        };
    },

    methods: {
        emitApply() {
            if (this.required && (this.inputValue === '' || this.inputValue === null || this.inputValue === undefined || Number.isNaN(this.inputValue))) {
                this.requiredError = true;
                return;
            }
            this.$emit('apply', this.inputValue);
        },
        onInput() {
            this.requiredError = false;
        },
    },
};
</script>
  
<style>

</style>