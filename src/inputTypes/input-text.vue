<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
        <label class="label mx-2 w-full">
            <span class="label-text">{{ label }}</span>
        </label>
        <!-- <input :maxlength="extras.maxlength" @input="uppercase" @change="emitValue" @keyup.enter="emitValue" v-model="inputValue" type="text" :placeholder="placeholder"
            class="input input-bordered w-full max-w-xs" /> -->


        <input :maxlength="maxlength" @input="uppercase" @change="emitValue"
            @keyup.enter="emitValue" :input="inputValue" v-model="inputValue" type="text" :placeholder="placeholder"
            class="input input-bordered w-full ml-0 md:ml-1" ref="keyboard" />
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
            // keyboardFocus: false,
            // touchscreen: false
        }
    },

    methods: {

        // focusInput() {
        //     if(!this.touchscreen) return;
        //     this.keyboardFocus = true;
        // },

        uppercase(value) {
            this.inputValue = this.inputValue.charAt(0).toUpperCase() + this.inputValue.slice(1);
        },

        emitValue(event) {
            this.$emit('apply', event.target.value);
        },
        // openKeyboard() {
        //     if(!this.touchscreen) return;
        //     KioskBoard.run(this.$refs.keyboard, {
        //         language: "no",
        //         capsLockActive: false,
        //         allowRealKeyboard: true,
        //         allowMobileKeyboard: true,
        //         // autoScroll: true,
        //         theme: "dark",
        //         keysFontSize: '18px',
        //         keysFontWeight: 'normal',
        //         keysIconSize: '18px',
        //         keysArrayOfObjects: [
        //             {
        //                 "0": "1",
        //                 "1": "2",
        //                 "2": "3",
        //                 "3": "4",
        //                 "4": "5",
        //                 "5": "6",
        //                 "6": "7",
        //                 "7": "8",
        //                 "8": "9",
        //                 "9": "0"
        //             },
        //             {
        //                 "0": "Q",
        //                 "1": "W",
        //                 "2": "E",
        //                 "3": "R",
        //                 "4": "T",
        //                 "5": "Y",
        //                 "6": "U",
        //                 "7": "I",
        //                 "8": "O",
        //                 "9": "P"
        //             },
        //             {
        //                 "0": "A",
        //                 "1": "S",
        //                 "2": "D",
        //                 "3": "F",
        //                 "4": "G",
        //                 "5": "H",
        //                 "6": "J",
        //                 "7": "K",
        //                 "8": "L"
        //             },
        //             {
        //                 "0": "Z",
        //                 "1": "X",
        //                 "2": "C",
        //                 "3": "V",
        //                 "4": "B",
        //                 "5": "N",
        //                 "6": "M"
        //             }
        //         ]
        //     });
        // },
    },

    mounted() {
        // this.touchscreen = (('ontouchstart' in window) ||
        //     (navigator.maxTouchPoints > 0) ||
        //     (navigator.msMaxTouchPoints > 0))
        // this.openKeyboard(); 

    }
}
</script>
  
<style>
/* #KioskBoard-VirtualKeyboard { */
    /* transform: scaleY(0.7); */

    /* transform: scaleX(0.8); */

    /* transform-origin: bottom; */
/* } */
</style>