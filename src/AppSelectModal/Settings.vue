<template>
    <div class="w-2/3 m-auto">
        <Alert ref="alert" />
        <div class="divider label-text">Channel label</div>
        <div class="flex flex-col justify-start items-center w-full h-full overflow-y-auto py-2 px-1 mt-2">
            <div class="flex flex-row w-full justify-between px-2 mb-8">
                <span class="mt-4 label-text">Label Type: </span>
                <div class="flex flex-row gap-2">
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('text')" :class="settings?.selectedLabelType === 'text' ? 'btn-primary' : ''" class="btn btn-circle mx-2">
                            <i class="fa-lg fa-solid fa-align-left"></i>
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Text</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('icon')" :class="settings?.selectedLabelType === 'icon' ? 'btn-primary' : ''" class="btn btn-circle mx-2 ">
                            <i class="fa-lg fa-solid fa-icons"></i>                        
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Icon</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <button @click="selectLabelType('image')" :class="settings?.selectedLabelType === 'image' ? 'btn-primary' : ''" class="btn btn-circle mx-2 ">
                            <i class="fa-lg fa-solid fa-image"></i>                        
                        </button>
                        <span class="text-base-content text-xs text-center capitalize my-0.5">Image</span>
                    </div>
                </div>
            </div>
            <div v-if="settings?.selectedLabelType === 'text'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto label-text w-24 mr-3 mt-1">Text: </span>
                <div class="w-full flex flex-col justify-center items-center">
                    <input v-model="settings.labelText" :class="labelTextInputTextSize" maxlength="12" @change="inputChange('labelText', $event.target.value)" type="text" placeholder="Enter name" class="input rounded-full w-24 h-12 bg-base-300 border-0 bg-opacity-40 dark:ring-opacity-50 px-0 cursor-text btn"/>
                </div>
            </div>
            <div v-else-if="settings?.selectedLabelType === 'icon'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto label-text mt-1 w-24 mr-3">Icon: </span>
                <iconPicker :selectedIcon="settings.labelIcon" @icon-selected="inputChange('labelIcon', $event)"/>
            </div>
            <div v-else-if="settings?.selectedLabelType === 'image'" class="flex flex-row w-full justify-between px-2 ">
                <span class="my-auto label-text mt-1 w-12">Image: </span>
                <div class="flex flex-col items-center justify-center">
                    <button @click="requestFile" class="rounded-full w-24 h-12 bg-base-300 border-0 bg-opacity-40 dark:ring-opacity-50 px-0 btn">
                        <img :class="imageClass" v-if="imageSrc" :src="imageSrc" @load="checkImageWidth"/>
                        <span v-else>Select</span>
                    </button>
                    <button @click="removeFile" :disabled="!imageSrc" class="btn btn-xs btn-ghost mt-1">Remove</button>
                    <label class="label-text mt-1 text-center">Image cannot be larger than 100x50px</label>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import channelSettings from "../ts/channelSettings.ts";
import IconPicker from "../components/IconPicker.vue";
import { open } from '@tauri-apps/api/dialog';
import { copyFileToAppdata, getImage, getImageSize, removeFileFromAppdata } from '../ts/helpers.ts';
import Alert from "../components/Alert.vue";


export default {
    data() {
        return {
            settings: {
                selectedLabelType: '',
                labelText: '',
                labelIcon: '',
                labelImage: ''
            },
            imageSrc: '',
            isImageWide: false
        }
    },

    // detect if the current slider id has changed
    watch: {
        currentSliderID: {
            handler: function() {
                this.getChannelSettings(this.currentSliderID).then(() => {
                    this.loadImage();
                });
            },
            immediate: true
        }
    },

    props: {
        currentSliderID: {
            type: Number,
            required: true
        }
    },

    components: {
        IconPicker,
        Alert
    },

    computed: {
        labelTextInputTextSize(){
            const textLength = this.settings?.labelText?.length ?? 0;
            if(textLength === 0) return 'text-xs';
            if(textLength > 8) return 'text-xs';
            if(textLength > 6) return 'text-sm';
            if(textLength > 4) return 'text-base';
            if(textLength > 2) return 'text-xl';
            return 'text-2xl';
        },
        imageClass() {
            return this.isImageWide ? 'rounded-full' : 'object-cover max-h-12';
        }
    },

    methods: {
        async getChannelSettings() {
            const newSettings = await channelSettings.getChannelSettings(this.currentSliderID);
            if(!newSettings) return;
            this.settings = newSettings;
        },

        selectLabelType(type){
            if(type === this.settings?.selectedLabelType) type = '';
            this.settings.selectedLabelType = type;
            if(type === 'image') this.loadImage();
            this.inputChange('selectedLabelType', type);
        },

        async inputChange(key, value){
            await channelSettings.updateChannelSettings(this.currentSliderID, key, value);
            this.settings[key] = value;
        },

        async requestFile() {
            open({
                multiple: false,
                directory: false,
                filters: [{
                    name: 'Images',
                    title: 'Select channel icon',
                    extensions: ['png']
                }]
            }).then(result => {
                getImageSize(result).then(size => {
                    if(size.width > 100 || size.height > 50) {
                        this.$refs.alert.openAlert('Image too big', 'Image cannot be larger than 100x50px. Please resize the image and try again.');
                        return;
                    }
                    //if the image is smaller than 100x50px we can copy it to the local folder (appdata) and update the settings
                    this.copyAndSaveFile(result);
                });
            });
        },

        async copyAndSaveFile(filePath){
            const newPath = await copyFileToAppdata(filePath, 'channelIcons', `channel-${this.currentSliderID}.png`)
            //update the settings with the new path to channelSettings.json
            this.inputChange('labelImage', newPath);
            this.loadImage(newPath);
        },

        removeFile() {
            removeFileFromAppdata(this.settings.labelImage);
            this.inputChange('labelImage', '');
            this.imageSrc = '';
        },

        async loadImage(filePath = this.settings?.labelImage) {
            if(!filePath || filePath === "") return;
            this.imageSrc  = await getImage(filePath);
        },
        
        checkImageWidth(event) {
            const img = event.target;
            this.isImageWide = img.naturalWidth > 80;
        }
    }, 
    mounted() {
        this.getChannelSettings(this.currentSliderID).then(() => {
            this.loadImage();
        });
    }

    
}
</script>

<style lang="scss" scoped>

</style>