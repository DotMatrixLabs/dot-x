<template>
    <div>
        <div v-if="settings?.selectedLabelType === 'text'" class="rounded-full w-24 h-12 bg-gray-500 dark:bg-gray-400 border-0 bg-opacity-40 dark:bg-opacity-30 dark:ring-opacity-50 px-0 btn">
            {{settings?.labelText}}
        </div>
    </div>
</template>

<script>
import { useDeckerStore } from "../store/deckerStore";
import { mapState } from "pinia";

    export default {
        name: "ChannelLabel",
        props: {
            channel: {
                type: Number,
                required: true
            }
        },
        data() {
            return {
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
            loadImage() {
                if (this.settings.labelImage) {
                    getImage(this.settings.labelImage).then((image) => {
                        this.imageSrc = image;
                    });
                }
            },
        },
    }
</script>

<style lang="scss" scoped>

</style>