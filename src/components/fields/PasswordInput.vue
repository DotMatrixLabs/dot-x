<template>
    <div class="flex gap-12">
        <label class="label">
            <span class="label-text">{{ label }}</span>
        </label>
        <label @click="scrollToTop" for="passwordField" class="btn btn-md">
            {{ label }}
        </label>
        <input type="checkbox" id="passwordField" class="modal-toggle" />
        <div for="passwordField" class="modal">
            <div class="modal-box realtive">
                <label @click="pin = ''" for="passwordField" class="btn btn-sm btn-circle absolute right-2 top-2">✕</label>
                <h3 class="text-base md:text-xl lg:text-3xl font-bold text-center pb-6">{{ options.title }}</h3>
                <div class="flex flex-col justify-center items-center text-sm">
                    <div class="max-w-sm mx-auto flex flex-col">

                        <input @input="checkPin" v-model="pin" type="text" maxlength="12" inputmode="numeric" placeholder="Pin" class="input input-sm input-bordered w-48 mb-6" />

                        <div class="grid grid-cols-3 gap-2 lg:gap-4">
                            <button @click="buttonClick('1')" class="btn btn-circle btn-primary">1</button>
                            <button @click="buttonClick('2')" class="btn btn-circle btn-primary">2</button>
                            <button @click="buttonClick('3')" class="btn btn-circle btn-primary">3</button>
                            <button @click="buttonClick('4')" class="btn btn-circle btn-primary">4</button>
                            <button @click="buttonClick('5')" class="btn btn-circle btn-primary">5</button>
                            <button @click="buttonClick('6')" class="btn btn-circle btn-primary">6</button>
                            <button @click="buttonClick('7')" class="btn btn-circle btn-primary">7</button>
                            <button @click="buttonClick('8')" class="btn btn-circle btn-primary">8</button>
                            <button @click="buttonClick('9')" class="btn btn-circle btn-primary">9</button>
                            <button @click="buttonClick('back')" class="btn btn-circle btn-primary"> 
                                <font-awesome-icon icon="fa-solid fa-delete-left" size="lg" />
                            </button>
                            <button @click="buttonClick('0')" class="btn btn-circle btn-primary" >0</button>
                            <button class="btn btn-circle btn-primary" > </button>
                        </div>
                        <!-- <button class="btn btn-secondary mt-4 xl:mt-8">Send</button> -->
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {

    emits: ['apply', 'scrollToTop'],

    props: {
        options: {
            type: Object,
            default: {}
        },
        label: {
            type: String,
            default: 'Login'
        },
        value: {},
    },

    data() {
        return {
            pin: ''
        }
    },

    methods: {
        buttonClick(click){
            if(click === 'back') return this.pin = this.pin.slice(0, -1);
            this.pin += click;
            this.checkPin()
        },

        checkPin(){
            if(this.value - 1337 == this.pin) {
                this.$emit('apply', true); 
                this.pin = '';
                const modal = document.getElementById("passwordField");
                modal.click()
            }
        },
        scrollToTop() {
            this.$emit('scrollToTop', true);
        }

    },
}
</script>

<style scoped></style>