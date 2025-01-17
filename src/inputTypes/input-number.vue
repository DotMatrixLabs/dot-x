<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto items-center">
        <label class="label w-1/3">
            <span class="label-text">{{ label }}</span>
        </label>
        <input :maxlength="maxlength" @input="uppercase" @change="emitValue"
            @keyup.enter="emitValue" :input="inputValue" v-model="inputValue" type="text" :placeholder="placeholder"
            class="input input-bordered input-sm w-full ml-0 md:ml-1" ref="keyboard" />
    </div>
</template>
  
<script>


export default {
    props: {
        label: {
            type: String,
            default: 'Label'
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
            default: 100
        }

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


        uppercase(value) {
            this.inputValue = this.inputValue.charAt(0).toUpperCase() + this.inputValue.slice(1);
        },

        emitValue(event) {
            this.$emit('apply', event.target.value);
        },

    },

    mounted() {
    }
}
</script>
  
<style>

</style>