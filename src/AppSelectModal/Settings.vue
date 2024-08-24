<template>
    <div class="w-2/3 m-auto">
        <div class="divider label-text">Channel label</div>
        <div class="flex flex-col justify-start items-center w-full h-full overflow-y-auto py-2 px-1 mt-2">
            <div class="flex flex-row w-full justify-between px-2 mb-8">
                <span class="mt-4 label-text">Label Type: </span>
                <div class="flex flex-row gap-2">
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('text')" :class="settings.selectedLabelType === 'text' ? 'btn-primary' : ''" class="btn btn-circle mx-2">
                            <i class="fa-lg fa-solid fa-align-left"></i>
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Text</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('icon')" :class="settings.selectedLabelType === 'icon' ? 'btn-primary' : ''" class="btn btn-circle mx-2 ">
                            <i class="fa-lg fa-solid fa-icons"></i>                        
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Icon</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('image')" :class="settings.selectedLabelType === 'image' ? 'btn-primary' : ''" class="btn btn-circle mx-2 ">
                            <i class="fa-lg fa-solid fa-image"></i>                        
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Image</span>
                    </div>
                </div>
            </div>
            <div v-if="settings.selectedLabelType === 'text'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto label-text">Text: </span>
                <input :value="settings.labelText" @change="inputChange('labelText', $event.target.value)" type="text" placeholder="Channel name.." class="input input-bordered max-w-xs w-2/3 mx-2 capitalize truncate"/>
            </div>
            <div v-else-if="settings.selectedLabelType === 'icon'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto label-text">Icon: </span>
                <iconPicker :selectedIcon="settings.labelIcon" @icon-selected="inputChange('labelIcon', $event)"/>
            </div>
            <div v-else-if="settings.selectedLabelType === 'image'" class="flex flex-col w-full justify-between px-2 ">
                <input type="file" class="file-input file-input-bordered file-input-sm w-full max-w-xs" />
                <label class="label-text mt-1 text-center">Image needs to be max 32x46px</label>
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
            settings: {
                selectedLabelType: '',
                labelText: '',
                labelIcon: '',
                labelImage: ''
            },
            
        }
    },

    props: {
        currentSliderID: {
            type: Number,
            required: true
        }
    },

    components: {
        iconPicker
    },

    methods: {
        async getChannelSettings() {
            console.log('getting channel settings');
            const newSettings = await channelSettings.getChannelSettings(this.currentSliderID);
            console.log(newSettings);
            this.settings = {...this.settings, ...newSettings};
        },

        selectLabelType(type){
            if(type === this.settings.selectedLabelType) type = '';
            this.settings.selectedLabelType = type;
            this.inputChange('selectedLabelType', type);
        },

        inputChange(key, value){
            console.table("InputChange", key, value);
            channelSettings.updateChannelSettings(this.currentSliderID, key, value).then(newSettings => {
            });
            console.log('input changed');
        }
    }, 
    mounted() {
        this.getChannelSettings(this.currentSliderID);
    }

    
}
</script>

<style lang="scss" scoped>

</style>