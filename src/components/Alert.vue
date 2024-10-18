<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
        <div class="modal-box">
            <h3 class="font-bold text-lg">{{ title }}</h3>
            <p class="py-4">{{ message }}
            </p>
            <div class="modal-action">
                <button for="my-modal" @click="closeAlert" class="btn btn-primary">
                    Ok
                </button>
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
        openAlert(title, message){
            this.title = title;
            this.message = message;
            this.modalOpen = true;
        },
        closeAlert(){
            this.modalOpen = false;
        },
    },

}
</script>

<style scoped>

</style>


