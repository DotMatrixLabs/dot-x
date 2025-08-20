<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
        <label class="label ml-2 w-full h-full">
            <span class="label-text">{{ label }}</span>
        </label>

        <!-- <label class="label-text text-xs mx-0.5">Use space as dots</label> -->

        <div class="flex flex-col w-full h-full">
            <input @focus="focusInput" :maxlength="15"
                @input="format($event.target.value)" @change="emitValue" @keyup.enter="emitValue" :input="inputValue"
                v-model="inputValue" type="text" :placeholder="placeholder" :class="IPNotValid ? 'ring ring-red-500 ring-3' : 'ring-transparent'" class="input input-bordered w-full" />
            <label v-show="IPNotValid" class="label text-red-500">
                IP is not valid!
            </label>
        </div>
    </div>
</template>
  
<script>


export default {
    props: {
        label: {
            type: Number,
            default: 'MAC'
        },
        placeholder: {
            type: String,
            default: 'Type here'
        },
        value: {
            type: String,
            default: ''
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
            IPNotValid: false
        }
    },

    methods: {
        format() {
            this.IPNotValid = false;

            let value = this.inputValue;
            
            if(value[value.length - 1] == ' ') {
                return this.inputValue = value.replace(' ', '.');
            }

            this.inputValue = value;
        },

        isValidIP(ip) {
            let regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
            return regex.test(ip);
        },

        emitValue(event) {
            if(!this.isValidIP(event.target.value)) return this.IPNotValid = true;
            this.$emit('apply', event.target.value);
        },
    },
}
</script>
  
<style>
</style>