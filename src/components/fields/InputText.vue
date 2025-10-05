<template>
    <div :class="disabled ? 'opacity-50' : ''" class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto items-center justify-between">
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
        <div class="w-1/2 ml-0 md:ml-1 flex flex-col">
            <input
                :disabled="disabled"
                @input="onInput"
                @change="emitApply"
                @keyup.enter="emitApply"
                v-model="inputValue"
                type="text"
                :placeholder="placeholder"
                :maxlength="max"
                :minlength="min"
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
    name: 'InputText',
    props: {
        label: { type: String, default: 'Label' },
        placeholder: { type: String, default: '' },
        value: { type: String, default: '' },
        description: { type: String, default: '' },
        help: { type: String, default: '' },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        type: { type: String, default: 'text' },
        max: { type: Number, default: null },
        min: { type: Number, default: null },
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
            const current = (this.inputValue ?? '').toString();
            if (this.required && current.trim() === '') {
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


