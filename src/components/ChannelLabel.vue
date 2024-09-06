<template>
    <div class="rounded-full w-24 h-12 bg-gray-500 dark:bg-gray-400 border-0 bg-opacity-40 dark:bg-opacity-30 dark:ring-opacity-50 px-0 btn">
        <div v-if="settings?.selectedLabelType === 'text'" :class="labelTextInputTextSize(settings?.labelText)">
            {{settings?.labelText}}
        </div>
        <div v-else-if="settings?.selectedLabelType === 'icon'" :key="settings?.labelIcon" >
            <i class="fa-2xl" :class="settings?.labelIcon"></i>
        </div>
        <div v-else-if="settings?.selectedLabelType === 'image'">
            <img class="object-cover max-h-12 p-0.5" v-if="imageSrc" :src="imageSrc"/>
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
                standardChannelName: ''
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
        },



        methods: {
            async loadImage(filePath) {
                if(!filePath || filePath === "") return;
                this.imageSrc = await getImage(filePath);
            },

            getSliderChannelName(apps = this.apps){
                if(!apps) return;
                //get the number of duplicates in the array - Duplicates have a (1), (2), (3), etc at the end of the name
                const duplicates = apps.filter((app) => app.match(/\(\d+\)$/));
                //remove the number and keep the original
                if((apps.length - duplicates.length) > 1) return this.standardChannelName = `${apps[0]}+${(apps.length - 1) - duplicates.length}`;
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
        },

        mounted() {
            this.loadImage(this.settings?.labelImage);
            this.getSliderChannelName();
        }

    }
</script>

<style lang="scss" scoped>

</style>