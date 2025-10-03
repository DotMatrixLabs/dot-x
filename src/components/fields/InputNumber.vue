<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto items-center">
        <label class="label w-1/3">
            <span class="label-text">{{ label }}</span>
        </label>
        <input
            :maxlength="maxlength"
            :min="min"
            :max="max"
            :step="step"
            @change="emitApply"
            @keyup.enter="emitApply"
            v-model.number="inputValue"
            type="number"
            :placeholder="placeholder"
            class="input input-bordered input-sm w-full ml-0 md:ml-1"
        />
    </div>
</template>
  
<script>


export default {
    props: {
        label: {
            type: String,
            default: 'Label'
        },
        placeholder: { type: String, default: 'Type here' },
        value: { type: [String, Number], default: '' },
        maxlength: {
            type: Number,
            default: 100
        },
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        step: { type: Number, default: 1 }

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
        }
    },

    methods: {
        emitApply() {
            this.$emit('apply', this.inputValue);
        },

    },

    mounted() {
    }
}
</script>
  
<style>

</style>