<template>
    <div class="flex flex-col items-center h-full w-full gap-4">

        <!-- Enable Midi -->
        <div class="flex flex-row w-full justify-between px-2 mt-4">
            <span class="my-auto">Enable MIDI Output: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="midiEnabled" @change="toggleMidi" />
        </div>
        <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Port: </span>
            <select @change="portSelected" v-model="selectedPort"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(device, index) in devices" :value="device" :key="index">
                    {{ device }}
                </option>
            </select>
        </div>
        <div class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">MIDI documentation: </span>
            <div class="flex justify-evenly items-center">
                <i class="fa-solid fa-book fa-lg mr-2"></i>
                <a href="https://dml.gg/midi" target="_blank" rel="noopener noreferrer" class="text-md hover:underline text-center first-letter: link link-secondary">dml.gg/midi</a>
            </div>
        </div>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
import Decker from "../ts/decker.ts";
import ConfigStore from "../ts/config.ts";
import decker from "../ts/decker.ts";
import { trackEvent } from "@aptabase/tauri";

const toast = useToast();


export default {
    name: "Devices",
    data() {
        return {
            devices: [],
            selectedPort: null,
            midiEnabled: false,
        }
    },


    methods: {
        deviceName(device){
            return `${device}`;
        },

        portSelected() {
            ConfigStore.set("midiOutputPort", this.selectedPort);
            const outputPort = this.devices.findIndex((device) => device === this.selectedPort);
            ConfigStore.set("midiOutputPortNumber", outputPort);
            ConfigStore.save();
            this.getMidiDevices();
            this.getConnectedDevice();
            if(this.midiEnabled) this.reconnectMidi();

        },

        reconnectMidi(){
            decker.detachMidiDevice();
            this.connectMidiDevice();
        },

        getMidiDevices() {
            decker.getMidiDevices().then((devices) => {
                this.devices = devices.names;
            });
        },


        async getConnectedDevice() {
            const storedPort = await ConfigStore.get("midiOutputPort");
            this.selectedPort = storedPort;
            console.log({selectedPortThis: this.selectedPort});
            this.getMidiDevices();

        },

        async getMidiEnabledStatus() {
            this.midiEnabled = await ConfigStore.get("midiEnabled");
        },

        async toggleMidi() {
            if(this.midiEnabled){
                await ConfigStore.set("midiEnabled", false);
                trackEvent("midi_toggled", { enabled: "false" });
                this.update();
                ConfigStore.save();
                decker.detachMidiDevice();
                return;
            }
            await ConfigStore.set("midiEnabled", true);
            trackEvent("midi_toggled", { enabled: "true" });
            ConfigStore.save();
            this.update();
            this.connectMidiDevice();
        },
        connectMidiDevice(){
            const outputPort = this.devices.findIndex((device) => device === this.selectedPort);
            decker.attachMidiDevice(outputPort);
        },

        update() {
            this.getConnectedDevice();
            this.getMidiEnabledStatus();
        }
        

    },
    mounted() {
        this.update();
    },
}
</script>

<style scoped>
.colorpicker {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  border: none;
  cursor: pointer;
  margin-right: 5px;
  box-shadow: 2cap;
}
.colorpicker::-webkit-color-swatch {
  border-radius: 15px;
  border: none;
}
.colorpicker::-moz-color-swatch {
  border-radius: 15px;
  border: none;
}

</style>