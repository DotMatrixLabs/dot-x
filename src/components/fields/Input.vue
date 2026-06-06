<template>
    <component
        :is="resolvedComponent"
        v-bind="forwardedProps"
        @apply="onApply"
    />
</template>

<script>
import InputText from './InputText.vue';
import InputNumber from './InputNumber.vue';
import NumberSelect from './NumberSelect.vue';
import IPInput from './IPInput.vue';

const typeToComponent = {
    text: InputText,
    number: InputNumber,
    number_select: NumberSelect,
    ip_address: IPInput,
};

export default {
    name: 'Input',
    props: {
        type: { type: String, default: 'text' },
        label: { type: String, default: 'Label' },
        placeholder: { type: String, default: '' },
        value: { type: [String, Number], default: '' },
        description: { type: String, default: '' },
        help: { type: String, default: '' },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        max: { type: Number, default: null },
        min: { type: Number, default: null },
        step: { type: Number, default: 1 },
        unit: { type: String, default: '' },
    },

    emits: ['apply'],

    computed: {
        resolvedComponent() {
            return typeToComponent[this.type] || InputText;
        },
        forwardedProps() {
            const base = {
                label: this.label,
                placeholder: this.placeholder,
                value: this.value,
                description: this.description,
                help: this.help,
                required: this.required,
                disabled: this.disabled,
            };

            if (this.type === 'number') {
                return { ...base, maxlength: this.max ?? undefined };
            }

            if (this.type === 'number_select') {
                return { ...base, max: this.max ?? 100, min: this.min ?? 0, step: this.step ?? 1, unit: this.unit };
            }

            if (this.type === 'ip_address') {
                return { ...base };
            }

            // text and default
            return { ...base, max: this.max, min: this.min };
        },
    },

    methods: {
        onApply(payload) {
            this.$emit('apply', payload);
        },
    },
};
</script>

<style>
</style>


