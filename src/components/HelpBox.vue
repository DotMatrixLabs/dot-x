<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full ">
        <div class="modal-box max-h-full h-full w-full overflow-hidden">
            <button @click="closeHelpBox" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><i class="fa-solid fa-xmark"/></button>
            <h3 class="font-bold text-lg -mt-1 pl-2">{{ title }}</h3>
            <div class="h-full overflow-y-auto whitespace-pre-line pb-6 px-2">
                <div v-html="message"></div>
            </div>
        </div>
    </div>
</template>

<script>
export default {

    emits: [],

    data() {
        return {
            modalOpen: false
        }
    },

    methods: {
        openHelpBox(title, message){
            this.title = title;
            this.message = message;
            this.modalOpen = true;
        },
        closeHelpBox(){
            this.modalOpen = false;
        },
    },

}
</script>

<style scoped>
</style>


