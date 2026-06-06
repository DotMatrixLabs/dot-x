<template>
    <div class="form-control w-64">
        <label class="label">
            <span class="label-text">{{ label }}</span>
        </label>
        <input :maxlength="maxlength" @input="toMac" @change="emitValue" @keyup.enter="emitValue" v-model="inputValue" type="text" :placeholder="placeholder"
            class="input input-bordered w-full max-w-xs" />
        <label class="label">
        </label>
    </div>
</template>
  
<script>
export default {
    props: {
        label: {
            type: Number,
            default: 'Toggle'
        },
        placeholder: {
            type: String,
            default: 'Type here'
        },
        value: {
            type: String,
            default: ''
        },
        maxlength: {
            type: Number,
            default: 17
        },

    },

    watch: {
        value(newValue) {
            this.inputValue = newValue;
            this.toMac();
        }
    },


    emits: ['apply'],


    data() {
        return {
            inputValue: this.value
        }
    },

    methods: {
        toMac() {
            if(!this.inputValue) return;
            this.inputValue = 
            (this.inputValue.toUpperCase()
            .replace(/[^\d|A-Z]/g, '')
            .match(/.{1,2}/g) || [])
            .join(":")
        },

        emitValue() {
            const value = this.inputValue.replace(/:/g, '');
            this.$emit('apply', value)
        }
    },

    mounted() {
        this.toMac();
    }
}
</script>
  
<style lang="scss" scoped></style>