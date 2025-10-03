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
        <input
            :disabled="disabled"
            @change="emitApply"
            @keyup.enter="emitApply"
            v-model="inputValue"
            type="text"
            :placeholder="placeholder"
            class="input input-bordered input-sm w-1/2 ml-0 md:ml-1"
        />
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
        };
    },

    methods: {
        emitApply() {
            this.$emit('apply', this.inputValue);
        },
    },
};
</script>

<style>
</style>


