<template>
    <div class="w-1/2 m-auto">
        <div class="divider">Label</div>
        <div class="flex flex-col justify-start items-center w-full h-full overflow-y-auto py-2 px-1 mt-2">
            <div class="flex flex-row w-full justify-between px-2 mb-4">
                <span class="mt-2">Label Type: </span>
                <div class="flex flex-row">
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectedLabelType = 'text'" :class="selectedLabelType === 'text' ? 'btn-primary' : ''" class="btn btn-circle btn-sm mx-2">
                            <i class="fa-solid fa-align-left"></i>
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Text</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectedLabelType = 'icon'" :class="selectedLabelType === 'icon' ? 'btn-primary' : ''" class="btn btn-circle btn-sm mx-2 ">
                            <i class="fa-solid fa-icons"></i>                        
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Icon</span>
                    </div>
                </div>
            </div>
            <div v-if="selectedLabelType === 'text'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto">Text: </span>
                <input type="text" class="input input-bordered input-sm max-w-xs w-2/3 mx-2 capitalize truncate"/>
            </div>
            <div v-else class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto">Icon: </span>
                <iconPicker />
                <input type="dropdown" class="input input-bordered input-sm max-w-xs w-2/3 mx-2 capitalize truncate"/>
            </div>
        </div>
    </div>
</template>

<script>
import channelSettings from "../ts/channelSettings.ts";
import iconPicker from "./iconPicker.vue";

export default {
    data() {
        return {
            settings: {},
            selectedLabelType: 'text'
        }
    },

    components: {
        iconPicker
    },

    methods: {
        async getSettings() {
            this.settings = await channelSettings.getAllChannelSettings();
        }
    }, 
    mounted() {
        this.getSettings();
    }

    
}
</script>

<style lang="scss" scoped>

</style>