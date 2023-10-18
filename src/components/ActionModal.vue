<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
        <div class="modal-box">
            <h3 class="font-bold text-lg">{{ modalSettings.title }}</h3>
            <p class="py-4">{{ modalSettings.message }}
            </p>
            <div v-if="modalSettings.modalType === 'input'">
                <template v-for="input in modalSettings.inputs">
                    <label class="label label-text">{{ input?.label }}</label>
                    <input class="input w-full input-sm input-primary" :type="input?.type"
                        :placeholder="input?.placeholder" v-model="outputObject[input.variableName]" />

                </template>
            </div>
            <div class="modal-action">
                <button for="my-modal" @click="$emit('closeModal')" class="btn">
                    {{ modalSettings.closeButton }}
                </button>
                <button v-if="modalSettings.confirmButton" for="my-modal" @click="submit" class="btn btn-primary">
                    {{ modalSettings.confirmButton }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {

    emits: ['closeModal', 'outputData'],

    props: {
        modalOpen: {
            type: Boolean,
            default: false
        },
        modalSettings: {
            type: Object,
            default: {
                title: '',
                message: '',
                modalType: 'text',
                closeButton: 'Close',
                confirmButton: ''
            }
        },
    },

    data() {
        return {
            outputObject: {}
        }
    },

    methods: {
        submit() {
            this.$emit('outputData', this.outputObject);
            this.$emit('closeModal')
        }
    },

}
</script>

<style scoped>

</style>


