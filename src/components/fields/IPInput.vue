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
                <span :class="IPNotValid ? '' : 'opacity-0'">{{ errorText }}</span>
            </div>
        </div>
    </div>
</template>
  
<script>


export default {
    props: {
        label: { type: String, default: 'Host or IP' },
        placeholder: { type: String, default: '' },
        value: { type: String, default: '' },
        description: { type: String, default: '' },
        help: { type: String, default: '' },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        type: { type: String, default: 'text' },
        max: { type: Number, default: 253 },
        min: { type: Number, default: null },

    },

    watch: {
        value(newValue) {
            this.inputValue = newValue;
        }
    },


    emits: ['apply'],


    data() {
        return {
            inputValue: this.value,
            IPNotValid: false,
            errorText: 'Invalid host or IP!'
        }
    },

    methods: {
        focusInput() {},
        onInput() {
            // live formatting: replace a trailing space with a dot
            this.IPNotValid = false;
            let value = this.inputValue || '';
            if (value.length > 0 && value[value.length - 1] === ' ') {
                this.inputValue = value.replace(' ', '.');
                return;
            }
        },

        isValidIPv4(ip) {
            let regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
            return regex.test(ip);
        },
        isValidHostname(host) {
            if (!host) return false;
            let value = String(host).trim();
            if (value === '') return false;
            if (value.toLowerCase() === 'localhost') return true;
            if (value.endsWith('.')) value = value.slice(0, -1);
            if (value.length > 253) return false;
            const labels = value.split('.');
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                if (label.length < 1 || label.length > 63) return false;
                if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
                if (label.startsWith('-') || label.endsWith('-')) return false;
                if (/^\d+$/.test(label) && i === labels.length - 1) {
                    // avoid all-numeric TLDs
                    return false;
                }
            }
            return true;
        },

        emitApply() {
            const value = (this.inputValue || '').trim();
            if (!(this.isValidIPv4(value) || this.isValidHostname(value))) {
                this.IPNotValid = true;
                return;
            }
            this.$emit('apply', value);
        },
    },
}
</script>
  
<style>
</style>