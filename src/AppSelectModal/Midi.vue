<template>
    <div class="grid grid-cols-1 w-1/2 m-auto gap-4 p-2">
        
        <div class="flex flex-col justify-center items-center" v-for="device in devices">
            <button :disabled="(device.id === 'master' || device.id === 'mic') && !sessions?.includes(device.id)" @click="setActiveDevice(device.id)" class="btn btn-wide"
                :class="activeDevices?.includes(device.id) ? 'btn-primary' : ''">
                <div v-if="activeDevices?.includes(device.id)">
                    <span class="my-auto">Enabled</span> 
                </div>
                <div v-else>
                    <span class="my-auto">Disabled</span> 
                <!-- <i :class="device.icon"></i> -->
                </div>
            </button>
            <!-- <span class="text-base-content text-xs text-center capitalize my-1"> {{ device.title }}</span> -->
            
        </div>
    </div>
    <div class="grid grid-cols-2 w-1/2 m-auto gap-2">
        <span class="my-auto">Channel: </span>
        <input type="text" placeholder="Type here" class="input input-bordered w-full max-w-xs" />
        <span class="my-auto">CC value: </span>
        <input type="text" placeholder="Type here" class="input input-bordered w-full max-w-xs" />
    </div>
</template>

<script>


import SelectedApps from "../ts/appsToControl.ts";
import SystemVolumeController from "../ts/volumeControl.ts";

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