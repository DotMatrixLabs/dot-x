<template>
    <div class="grid grid-cols-1 w-1/2 m-auto gap-4 p-2">
        
        <div class="flex flex-col justify-center items-center" v-for="device in devices">
            <button :disabled="(device.id === 'master' || device.id === 'mic') && !sessions?.includes(device.id)" @click="setActiveDevice(device.id)" class="btn btn-wide"
                :class="activeDevices?.includes(device.id) ? 'btn-primary' : ''">
                <div v-if="activeDevices?.includes(device.id)">
                    <span class="my-auto">MIDI Enabled</span> 
                </div>
                <div v-else>
                    <span class="my-auto">MIDI Disabled</span> 
                <!-- <i :class="device.icon"></i> -->
                </div>
            </button>
            <!-- <span class="text-base-content text-xs text-center capitalize my-1"> {{ device.title }}</span> -->
            
        </div>
    </div>
    <div class="grid grid-cols-1 w-1/2 m-auto gap-1">
        <label class="form-control w-full max-w-xs">
            <div class="label">
                <span class="label-text">Channel</span>
                <span v-if="channelInvalidInput" class="label-text-alt text-red-600 text-sm">Must be a valid number 1-16!</span>
            </div>
            <input v-model.trim="channelInput" @change="setChannel" type="text" placeholder="Channel" class="input input-sm input-bordered w-full max-w-xs" />
        </label>

        <label class="form-control w-full max-w-xs">
            <div class="label">
                <span class="label-text">CC Value</span>
                <span v-if="CCValueInvalidInput" class="label-text-alt text-red-600 text-sm">Must be a valid number 0-127!</span>
            </div>
            <input v-model.trim="CCValueInput" @change="setCCValue" type="text" placeholder="CC Value" class="input input-sm input-bordered w-full max-w-xs" />
        </label>

        <div class="flex w-full justify-center px-2 mt-4 opacity-50">
            <i class="fa-solid fa-book fa-lg mr-2"></i>
            <span @click="openLink('https://dml.gg/midi')" class="mb-2 text-sm hover:underline opacity-80 text-center first-letter: cursor-pointer">MIDI documentation</span>
        </div>
    </div>
</template>

<script>


import SelectedApps from "../ts/appsToControl.ts";
import SystemVolumeController from "../ts/volumeControl.ts";
import Decker from "../ts/decker.ts";
import config from "../ts/config";
import { openLink } from "../ts/helpers.ts";

const openLinkMethod = openLink;

export default {

    props: {
        currentSliderID: Number,
    },

    data() {
        return {
            devices: [
                { title: "midi", icon: "fas fa-volume-up fa-lg", id: "midi" },
            ],
            activeDevices: [],
            sessions: [],
            channelInput: "",
            CCValueInput: "",
            MIDIConfiguration: [], // Store the MIDI configuration for every slider, so reference the current slider ID when setting the MIDI configuration
            CCValueInvalidInput: false,
            channelInvalidInput: false,
        }
    },

    methods: {
        openLink: openLinkMethod,
        async setActiveDevice(device) {
            await SelectedApps.toggleApps(this.currentSliderID.toString(), device);
            this.getActiveDevices();
            this.reconnectMIDI();
        },

        async reconnectMIDI(){
            /** This looks like it shouldn't work, and I agree. But it does. 
            The reason it does is because if you try to detach from MIDI without the midiEnabled in the settings modal being set to false, it will automatically reconnect. How convenient! 🔥
            Totally intended behaviour. */
            await Decker.detachMidiDevice();
        },

        async getActiveDevices(){
            if(this.currentSliderID === null) return;
            this.activeDevices = await SelectedApps.getApps(this.currentSliderID?.toString());
        },

        async getSessions() {
            this.sessions = await SystemVolumeController.getAllSessionNames(true);
        },

        async getMIDISettings() {
            // Read MIDIConfiguration from config.get(MIDIConfiguration), if it exists. If not, set it to default values.
            this.MIDIConfiguration = await config.get("midiConfiguration") ?? [];
            if(this.MIDIConfiguration[this.currentSliderID] === undefined || this.MIDIConfiguration[this.currentSliderID] === null) {
                this.MIDIConfiguration[this.currentSliderID] = {};
                this.MIDIConfiguration[this.currentSliderID].channel = `${this.currentSliderID + 1}`; // By default, the channel is the slider ID/number
                this.MIDIConfiguration[this.currentSliderID].CCValue = `7`; // By default, the CC value is 7
                await config.set("midiConfiguration", this.MIDIConfiguration);
            }
            this.channelInput = this.MIDIConfiguration[this.currentSliderID]?.channel ?? `${this.currentSliderID + 1}`; // By default, the channel is the slider ID/number
            this.CCValueInput = this.MIDIConfiguration[this.currentSliderID]?.CCValue ?? `7`; // By default, the CC value is 7
        },

        async setCCValue() {
            // MIDI CC value regex, must be a valid decimal number between 0 and 127
            const numberPattern = /^(?:\d{1,2}|1[0-1]\d|12[0-7])$/;
            if(!numberPattern.test(this.CCValueInput) && this.CCValueInput !== "") {
                console.error("Invalid CC Value.Must be a valid number between 0 and 127.");
                this.CCValueInvalidInput = true;
                this.getMIDISettings();
                return;
            }
            this.MIDIConfiguration[this.currentSliderID].CCValue = this.CCValueInput !== "" ? this.CCValueInput : `7`;
            this.CCValueInvalidInput = false;
            await config.set(`midiConfiguration`, this.MIDIConfiguration);
            this.getMIDISettings();
            this.reconnectMIDI();
        },

        async setChannel() {
            // MIDI channel value regex, must be a valid decimal number between 1 and 16
            const numberPattern = /^(?:[1-9]|1[0-6])$/;
            
            if (!numberPattern.test(this.channelInput) && this.channelInput !== "") {
                console.error("Invalid Channel Value. Must be a valid number between 1 and 16.");
                this.channelInvalidInput = true;
                this.getMIDISettings();
                return;
            }

            const channelValue = this.channelInput !== "" ? this.channelInput : `${this.currentSliderID + 1}`;
            
            this.MIDIConfiguration[this.currentSliderID].channel = channelValue;
            this.channelInvalidInput = false;

            await config.set(`midiConfiguration`, this.MIDIConfiguration);
            this.getMIDISettings();
            this.reconnectMIDI();
        },

        
        refreshData() {
            this.getActiveDevices();
            this.getMIDISettings();
            this.CCValueInvalidInput = false;
            this.channelInvalidInput = false;
        }
        
    },

    mounted() {
        this.getActiveDevices();
        this.getSessions();
        this.getMIDISettings();
    },

}
</script>

<style lang="scss" scoped></style>