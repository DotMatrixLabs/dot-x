<template>
    <div class="flex flex-col justify-between items-center w-full">
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
    </div>
</template>

<script>

import ConfigStore from "../ts/config.ts";
import SystemSettings from "../ts/systemSettings.ts";
import { useDeckerStore } from "../store/deckerStore";
import { mapState } from "pinia"; 

export default {
    name: "General",
    data() {
        return {
            themes: ["light", "dark"],
            currentTheme: "",
            autoStartStatus: false,
            actOnDeckerDisconnect: false,
            sliderOptions: ["Do nothing", "Mute", "Maximize volume"],
            sliderAmount: 3,
            selectedValues: [], // Array to store selected values for each slider
        }
    },
    computed: {
    ...mapState(useDeckerStore, {
      sliders: 'getSliders',
    }),
  },
    methods: {
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

        this.sliderAmount = this.sliders.length; // Set the amount of sliders to the amount of sliders in the store
    },
}
</script>

<style lang="scss" scoped></style>