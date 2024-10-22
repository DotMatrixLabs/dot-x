<template>
    <div class="flex flex-col justify-start items-center w-full h-full overflow-y-auto">
        <Confirmation ref="confirmationModal"/>
        <!-- <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Theme: </span>
            <select @change="setTheme" v-model="currentTheme"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(theme, index) in themes" :value="theme" :key="index">
                    {{ theme }}
                </option>
            </select>
        </div> -->
        <!-- <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Run in background: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" checked />
        </div> -->
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Run on startup: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="autoStartStatus" @change="toggleAutostart" />
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Act when Decker disconnects: <br></span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="actOnDeckerDisconnect" @change="toggleActOnDeckerDisconnect" />
        </div>
        <div v-if="actOnDeckerDisconnect" v-for="slider in sliderAmount" :key="slider" class="flex flex-row w-full justify-between px-2 mt-2">
            <span class="shrink-0 pt-1">Slider {{slider}}: </span>
            <select @change="sliderDisconnectHandle" v-model="selectedValues[slider - 1]"
                class="select select-bordered select-sm w-2/3 mx-2 truncate">
                <option class="w-full" v-for="(option, index) in sliderOptions" :value="option" :key="index">
                    {{ option }}
                </option>
            </select>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4 mb-2">
            <span class="my-auto">Inverted sliders: <br></span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="invertedSliders" @change="toggleInvertedSliders" />
        </div>
        <div class="divider"><span class="opacity-50">Reset</span></div>
        <div class="flex flex-row w-full justify-between px-2 mt-2">
            <div>
                <label class="my-auto">Reset Channel Settings: <br></label>
                <label class="text-xs opacity-50">Resets all selected apps and channel labels <br></label>
            </div>
            <button class="btn btn-xs btn-error btn-outline" @click="resetChannelSettings">Reset</button>
        </div>
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <div>
                <label class="my-auto">Reset All Settings <br></label>
                <label class="text-xs opacity-50">Resets all user settings and channels to their default values<br></label>
            </div>
            <button class="btn btn-xs btn-error btn-outline" @click="resetAll">Reset All</button>
        </div>
    </div>
</template>

<script>

import ConfigStore from "../ts/config.ts";
import SystemSettings from "../ts/systemSettings.ts";
import decker from "../ts/decker.ts";
import { useDeckerStore } from "../store/deckerStore";
import { mapState } from "pinia"; 
import { resetAllSettings, resetChannelSettings } from "../ts/helpers.ts";
import Confirmation from "../components/Confirmation.vue";

export default {
    name: "General",

    components: {
        Confirmation
    },

    data() {
        return {
            themes: ["light", "dark"],
            currentTheme: "",
            autoStartStatus: false,
            actOnDeckerDisconnect: false,
            sliderOptions: ["Do nothing", "Mute", "Maximize volume"],
            sliderAmount: 3,
            selectedValues: [], // Array to store selected values for each slider,
            invertedSliders: false
        }
    },
    computed: {
    ...mapState(useDeckerStore, {
      sliders: 'getSliders',
    }),
  },
    methods: {

        async resetAll() {
            try {
                const message = "This will reset all user settings, configured channels, and channel labels back to their default state as when the app was first installed.";
                await this.$refs.confirmationModal.openConfirmation("Are you sure?", message, "Reset all")
                await resetAllSettings();
            } catch (error) {
                console.log(error); 
            }
        },

       async resetChannelSettings() {
            try {
                const message = "This will reset all selected items on all channels, including custom labels, but will keep other settings and configurations.";
                await this.$refs.confirmationModal.openConfirmation("Are you sure?", message, "Reset channels");
                await resetChannelSettings();
            } catch (error) {
                console.log(error);
            }
        },

        // async getTheme() {
        //     this.currentTheme = await ConfigStore.get("theme") || "dark";
        //     document.documentElement.setAttribute("data-theme", this.currentTheme);
        //     return this.currentTheme;
        // },
        // async setTheme(event) {
        //     ConfigStore.setTheme("light");
        //     // document.documentElement.setAttribute("data-theme", event.target.value);
        // },
        async getAutostartStatus() {
            this.autoStartStatus = await SystemSettings.checkAutostartStatus();
        },
        
        async getActOnDeckerDisconnect() {
            this.actOnDeckerDisconnect = await ConfigStore.get("actOnDeckerDisconnect");
        },

        async getInvertedSlidersStatus() {
            this.invertedSliders = await ConfigStore.get("invertedSliders");
        },

        async toggleAutostart() {
            if(this.autoStartStatus){
                await SystemSettings.disableAutostart();
                this.getAutostartStatus();
                return;
            }
            else await SystemSettings.enableAutostart();
            this.getAutostartStatus();
        },

        async toggleActOnDeckerDisconnect() {
            if(this.actOnDeckerDisconnect){
                await ConfigStore.set("actOnDeckerDisconnect", false);
                ConfigStore.save();
                this.getActOnDeckerDisconnect();
                return;
            }
            else await ConfigStore.set("actOnDeckerDisconnect", true);
            ConfigStore.save();
            this.getActOnDeckerDisconnect();
        },

        async toggleInvertedSliders() {
            const comPort = await ConfigStore.get("comPort");
            if(this.invertedSliders){
                await ConfigStore.set("invertedSliders", false);
                ConfigStore.save();
                this.getInvertedSlidersStatus();
                decker.init(comPort);
                return;
            }
            else await ConfigStore.set("invertedSliders", true);
            ConfigStore.save();
            this.getInvertedSlidersStatus();
            decker.init(comPort);
        },

        // Update the selected option for each slider, i.e do nothing, mute, maximize volume
        async sliderDisconnectHandle() {
            console.log(this.selectedValues);
            await ConfigStore.set("sliderDisconnectHandleOptions", this.selectedValues);
            ConfigStore.save();
        },
        async getDisconnectHandleSelectedValues() {
            const storedValues = await ConfigStore.get("sliderDisconnectHandleOptions");
            if(storedValues) this.selectedValues = storedValues;
            else this.selectedValues = Array(this.sliderAmount).fill(this.sliderOptions[0]);
        }
    },
    mounted() {
        // this.getTheme();
        this.getAutostartStatus();
        this.getActOnDeckerDisconnect();
        this.getDisconnectHandleSelectedValues();
        this.getInvertedSlidersStatus();

        this.sliderAmount = this.sliders.length; // Set the amount of sliders to the amount of sliders in the store
        if(this.sliderAmount === 0) this.sliderAmount = 5;
    },
}
</script>

<style lang="scss" scoped></style>