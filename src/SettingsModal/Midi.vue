<template>
    <div class="flex flex-col items-center h-full w-full gap-4">

        <!-- Enable Midi -->
        <div data-setting="Enable MIDI Output" class="flex flex-row w-full justify-between px-2">
            <span class="my-auto">Enable MIDI Output: </span>
            <input type="checkbox" class="toggle toggle-primary mr-2" :checked="midiEnabled" @change="toggleMidi" />
        </div>
        <div data-setting="MIDI Port" class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">Port: </span>
            <select @change="portSelected" v-model="selectedPort"
                class="select select-bordered select-sm w-2/3 mx-2 capitalize truncate">
                <option class="w-full" v-for="(device, index) in devices" :value="device" :key="index">
                    {{ device }}
                </option>
            </select>
        </div>
        <div data-setting="MIDI documentation" class="flex flex-row w-full justify-between px-2">
            <span class="shrink-0 pt-1">MIDI documentation: </span>
            <div class="flex justify-evenly items-center">
                <button @click="openLink('https://dml.gg/midi')" class="btn btn-sm">Docs<i class="fa-solid fa-book fa-lg"></i></button>
            </div>
        </div>
    </div>
</template>

<script>
import { toast } from "vue-sonner";
import Decker from "../ts/decker.ts";
import ConfigStore from "../ts/config.ts";
import decker from "../ts/decker.ts";
import { trackTelemetryEvent } from "../ts/telemetry";
import { openLink } from "../ts/helpers.ts";

const openLinkMethod = openLink;
const VIRTUAL_MIDI_PORT = "Dot X Virtual MIDI";


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
        openLink: openLinkMethod,
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
                if (!this.selectedPort || !this.devices.includes(this.selectedPort)) {
                    this.selectedPort = this.devices.includes(VIRTUAL_MIDI_PORT)
                        ? VIRTUAL_MIDI_PORT
                        : this.devices[0] || null;

                    if (this.selectedPort) {
                        ConfigStore.set("midiOutputPort", this.selectedPort);
                        ConfigStore.set("midiOutputPortNumber", this.devices.findIndex((device) => device === this.selectedPort));
                        ConfigStore.save();
                    }
                }
            });
        },


        async getConnectedDevice() {
            const storedPort = await ConfigStore.get("midiOutputPort");
            this.selectedPort = storedPort;
            this.getMidiDevices();

        },

        async getMidiEnabledStatus() {
            this.midiEnabled = await ConfigStore.get("midiEnabled");
        },

        async toggleMidi() {
            if(this.midiEnabled){
                await ConfigStore.set("midiEnabled", false);
                trackTelemetryEvent("midi_toggled", { enabled: "false" });
                this.update();
                ConfigStore.save();
                decker.detachMidiDevice();
                return;
            }
            await ConfigStore.set("midiEnabled", true);
            trackTelemetryEvent("midi_toggled", { enabled: "true" });
            ConfigStore.save();
            this.update();
            this.connectMidiDevice();
        },
        connectMidiDevice(){
            const outputPort = this.devices.findIndex((device) => device === this.selectedPort);
            if(outputPort < 0){
                toast.error("Select a MIDI port before enabling MIDI output.");
                return;
            }
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
