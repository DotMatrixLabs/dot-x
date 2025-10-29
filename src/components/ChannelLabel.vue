<template>
    <div class="rounded-full w-24 h-12 btn backdrop-blur-md bg-base-100/10 shadow-sm px-0 channel-glass-btn hover:bg-base-100/20">
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
@property --c1 {
  syntax: "<color>";
  inherits: false;
  initial-value: #dddddd;
}
@property --c2 {
  syntax: "<color>";
  inherits: false;
  initial-value: #555555;
}
@property --c3 {
  syntax: "<color>";
  inherits: false;
  initial-value: #333333;
}

.channel-glass-btn {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(3px);
  color: white;
}

.channel-glass-btn:before {
  content: "";
  position: absolute;
  pointer-events: none;
  inset: 0px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    to bottom right,
    var(--c1) 0%,
    var(--c3) 33%,
    var(--c2) 62%,
    var(--c3) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  transition: --c1 300ms ease, --c2 300ms ease, --c3 300ms ease;
}

.channel-glass-btn:hover:before {
  --c1: #525252;
  --c2: #878787;
  --c3: #414141;
}

.channel-glass-btn:active:before {
  --c1: #525252;
  --c2: #414141;
  --c3: #414141;
}

@media (prefers-color-scheme: light) {
  .channel-glass-btn {
    background: rgba(0, 0, 0, 0.06);
    color: #111111;
  }
  .channel-glass-btn:before {
    --c1: #8a8a8a;
    --c2: #5e5e5e;
    --c3: #7a7a7a;
  }
}
</style>