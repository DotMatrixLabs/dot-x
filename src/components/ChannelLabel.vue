<template>
    <div class="rounded-full w-24 h-12 bg-gray-500 dark:bg-gray-400 border-0 bg-opacity-40 dark:bg-opacity-30 dark:ring-opacity-50 hover:bg-gray-700 dark:hover:bg-gray-700 dark:hover:bg-opacity-40 hover:bg-opacity-40 px-0 btn shadow-xl">
        <div v-if="settings?.selectedLabelType === 'text'" :class="labelTextInputTextSize(settings?.labelText)">
            {{settings?.labelText}}
        </div>
        <div v-else-if="settings?.selectedLabelType === 'icon'" :key="settings?.labelIcon">
            <i class="fa-2xl" :class="settings?.labelIcon"></i>
        </div>
        <div v-else-if="settings?.selectedLabelType === 'image'">
            <img :class="imageClass" v-if="imageSrc" :src="imageSrc" @load="checkImageWidth"/>
        </div>
        <div v-else-if="apps?.length === 0">
            <span><i class="fas fa-add fa-xl"></i></span>
        </div>
        <div :key="apps" v-else>
            <span :class="labelTextInputTextSize(standardChannelName)">{{ standardChannelName }}</span>
        </div>
    </div>
</template>

<script>
import { useDeckerStore } from "../store/deckerStore";
import { mapState } from "pinia";
import { getImage } from "../ts/helpers";

export default {
    name: "ChannelLabel",
    props: {
        channel: {
            type: Number,
            required: true
        },
        apps: {
            type: Array,
            required: false,
            default: () => []
        }
    },
    data() {
        return {
            imageSrc: '',
            standardChannelName: '',
            isImageWide: false
        }
    },

    watch: {
        settings() {
            this.loadImage(this.settings?.labelImage);
        },
        apps: {
            handler(newApps) {
                this.getSliderChannelName(newApps);
            },
            deep: true // This ensures deep watching of object properties
        }
    },

    computed: {
        ...mapState(useDeckerStore, {
            channelSettings: 'channelSettings',
        }),

        settings() {
            return this.channelSettings[this.channel];
        },

        imageClass() {
            return this.isImageWide ? 'rounded-full' : 'object-cover max-h-12';
        }
    },

    methods: {
        async loadImage(filePath) {
            if (!filePath || filePath === "") return;
            this.imageSrc = await getImage(filePath);
        },

        getSliderChannelName(apps = this.apps) {
            if (!apps) return;
            //filter out output and input from the apps list - if the apps has a prefix of output: or input: then remove it
            apps = apps.filter((app) => !app.startsWith('output:') && !app.startsWith('input:'));
            //filter out master and mic from the apps list, only if output or input is in the apps list
            if (apps.some(app => app === 'output' || app === 'input')) {
                apps = apps.filter((app) => app !== 'master' && app !== 'mic');
            }
            //get the number of duplicates in the array - Duplicates have a (1), (2), (3), etc at the end of the name
            const duplicates = apps.filter((app) => app.match(/\(\d+\)$/));
            //remove the number and keep the original
            if ((apps.length - duplicates.length) > 1) return this.standardChannelName = `${apps[0]}+${(apps.length - 1) - duplicates.length}`;
            else return this.standardChannelName = apps[0];
        },

        labelTextInputTextSize(text) {
            if (!text) return 'text-xs';
            const textLength = text.length;
            if (textLength === 0) return 'text-xs';
            if (textLength > 8) return 'text-xs';
            if (textLength > 6) return 'text-sm';
            if (textLength > 4) return 'text-base';
            if (textLength > 2) return 'text-xl';
            return 'text-2xl';
        },

        checkImageWidth(event) {
            const img = event.target;
            this.isImageWide = img.naturalWidth > 80;
        }
    },

    mounted() {
        this.loadImage(this.settings?.labelImage);
        this.getSliderChannelName();
    }
}
</script>

<style scoped>
</style>