<template>
    <div :class="disabled ? 'opacity-50' : ''" class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto items-center">
        <label class="label w-1/3">
            <span class="label-text">{{ label }}</span>
        </label>
        <input
            :disabled="disabled"
            :maxlength="maxlength"
            @change="emitApply"
            @keyup.enter="emitApply"
            v-model="inputValue"
            type="text"
            :placeholder="placeholder"
            class="input input-bordered input-sm w-full ml-0 md:ml-1"
        />
    </div>
</template>

<script>
export default {
    name: 'InputText',
    props: {
        label: { type: String, default: 'Label' },
        placeholder: { type: String, default: 'Type here' },
        value: { type: String, default: '' },
        maxlength: { type: Number, default: 100 },
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


