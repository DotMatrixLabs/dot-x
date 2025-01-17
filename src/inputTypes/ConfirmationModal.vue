<template>
    <div class="w-full flex flex-col md:flex-row max-w-sm md:max-w-lg m-auto">
        <label class="label mx-2 w-full">
            <span class="label-text">{{ label }}</span>
        </label>
        <label @click="$emit('scrollToTop')" for="confirmationModal" class="btn btn-md btn-outline m-auto" :class="modalType ? `btn-${modalType} text-${modalType}` : ''" >
            {{ buttonTitle || label }}
        </label>
        <input type="checkbox" id="confirmationModal" class="modal-toggle w-full" />
        <label for="confirmationModal" class="modal cursor-pointer w-full">
            <div class="modal-box relative" :class="modalType ? `ring-4 ring-${modalType}` : ''">
                <h3 class="text-3xl font-bold text-center pb-6">{{ title }}</h3>
                <div class="flex flex-col justify-center items-center">
                    <span v-html="message"></span>
                    <div class="modal-action">
                        <label v-if="actionClose" @click="close()" for="alert" class="btn">
                            {{ actionClose}}
                        </label>
                        <label v-if="actionConfirm" @click="confirm()" for="alert"
                            class="btn btn-success hover:opacity-80">{{ actionConfirm }}</label>
                    </div>
                </div>
            </div>
        </label>
    </div>
</template>

<script>

export default {
    props: {
        //Takes in the following parameters:
        // message: message to display in modal
        // title: title of modal
        // actionConfirm: text on button to confirm action
        // actionClose: text on button to close modal
        // modalType: 'error', 'warning', 'success'
        message: {
            type: String,
            default: 'Are you sure you want to do this?'
        },
        title: {
            type: String,
            default: 'Confirmation Modal'
        },
        actionConfirm: {
            type: String,
            default: 'Confirm'
        },
        actionClose: {
            type: String,
            default: 'Close'
        },
        modalType: {
            type: String,
        },
        label: {
            type: String,
            default: 'Confirmation Modal'
        },
        buttonTitle: {
            type: String,
        }
    },

    emits: ['apply', 'scrollToTop'],

    data() {
        return {

        }
    },

    methods: {
        close(){
            const modal = document.getElementById("confirmationModal");
            modal.click();
        },

        confirm(){
            this.$emit('apply');
            this.close(); 
        }
    }

}
</script>

<style scoped>
.centerVertical {
    position: absolute;
    left: 50%;
    transform: translate(-50%, 0);
}
</style>