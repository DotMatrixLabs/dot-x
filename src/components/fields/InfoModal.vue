<template>
    <div class="w-full flex flex-row max-w-lg m-auto">
        <label class="cursor-pointer label mx-2 w-full">
            <span class="label-text">{{ label }}</span>
        </label>
        <label for="storeInfoModal" class="btn btn-md btn-outline m-auto">
            {{ buttonTitle }}
        </label>
        <input type="checkbox" id="storeInfoModal" class="modal-toggle" />
        <label for="storeInfoModal" class="modal cursor-pointer">
            <div class="modal-box realtive h-1/3">
                <h3 class="text-3xl font-bold text-center pb-6">{{ title }}</h3>
                <div class="flex flex-col justify-center items-center text-sm">
                    <template class="flex text-left justify-between" v-for="(value, key) in value" :key="key">
                        <!-- {{ key }} -->
                        <div class="flex flex-between w-full border-t-2 border-opacity-70 border-gray-600 ">
                            <p class="text-sm mr-2 font-bold text-left w-full">{{ key }}:</p>
                            <p class="text-right w-full ">{{ value }}</p>
                        </div>
                    </template>
                </div>
            </div>
        </label>
    </div>
</template>

<script>

export default {

    props: {
        title: {
            type: Object,
            default: 'Title'
        },
        label: {
            type: String,
            default: 'Label title'
        },
        value: {
            default: {}   
        },
        buttonTitle: {
            type: String,
            default: 'Open'
        }
    },

    data() {
        return {
        }
    },

    methods: {

    },
}
</script>

<style scoped>
.centerVertical {
    position: absolute;
    left: 50%;
    transform: translate(-50%, 0);
}
</style>