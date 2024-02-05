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
            </div>
            <input v-model.trim="channelInput" @change="setChannel" type="text" placeholder="Channel" class="input input-bordered w-full max-w-xs" />
        </label>

        <label class="form-control w-full max-w-xs">
            <div class="label">
                <span class="label-text">CC Value</span>
            </div>
            <input v-model.trim="CCValueInput" @change="setCCValue" type="text" placeholder="CC Value" class="input input-bordered w-full max-w-xs" />
        </label>
    </div>
</template>

<script>


import SelectedApps from "../ts/appsToControl.ts";
import SystemVolumeController from "../ts/volumeControl.ts";
import Decker from "../ts/decker.ts";

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
        }
    },

    methods: {
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
            console.log(this.activeDevices, this.activeDevices[this.currentSliderID?.toString()]);
        },

        async getSessions() {
            this.sessions = await SystemVolumeController.getAllSessionNames(true);
        }
        
    },

    mounted() {
        this.getActiveDevices();
        this.getSessions();
    },

}
</script>

<style lang="scss" scoped></style>