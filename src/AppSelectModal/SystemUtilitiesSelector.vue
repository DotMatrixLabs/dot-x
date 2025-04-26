<template>
    <div class="flex flex-col gap-4 w-full h-full overflow-y-scroll p-2 mb-12">
        <div class="grid grid-cols-3 w-1/2 m-auto gap-4">
            <div class="flex flex-col justify-center items-center" v-for="device in devices" :key="device.id">
                <button :disabled="(device.id === 'output' && outputDevices.length === 0) || (device.id === 'mic' && inputDevices.length === 0)" @click="setActiveDevice(device.id)" class="btn btn-circle"
                    :class="activeDevices?.includes(device.id) ? 'btn-primary' : ''">
                    <i :class="device.icon"></i>
                </button>
                <span class="text-base-content text-xs text-center capitalize my-1"> {{ device.title }}</span>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Output device selector -->
        <div v-if="activeDevices?.includes('output')" class="w-4/5 m-auto">
            <h3 class="text-base-content text-sm font-semibold mb-2">Select Output Devices</h3>
            <div class="dropdown w-full">
                <div tabindex="0" role="button" class="btn w-full justify-between">
                    <span>{{ selectedOutputDevices.length ? `${selectedOutputDevices.length} device(s) selected` : 'Select output devices' }}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-full max-h-60 overflow-y-auto">
                    <div v-if="loadingDevices" class="flex justify-center items-center p-4">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div v-else>
                        <div v-for="device in outputDevices" :key="device" class="form-control">
                            <label class="label cursor-pointer justify-start gap-2">
                                <input type="checkbox" class="checkbox checkbox-sm" 
                                    :checked="selectedOutputDevices.includes(device)"
                                    @change="toggleOutputDevice(device)" />
                                <span class="label-text">{{ formatDeviceName(device) }}</span>
                            </label>
                        </div>
                        <div v-if="outputDevices.length === 0" class="p-2 text-center text-sm opacity-70">
                            No output devices found
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Input device selector -->
        <div v-if="activeDevices?.includes('mic')" class="w-4/5 m-auto">
            <h3 class="text-base-content text-sm font-semibold mb-2">Select Input Devices</h3>
            <div class="dropdown w-full">
                <div tabindex="0" role="button" class="btn w-full justify-between">
                    <span>{{ selectedInputDevices.length ? `${selectedInputDevices.length} device(s) selected` : 'Select input devices' }}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-full max-h-60 overflow-y-auto">
                    <div v-if="loadingInputDevices" class="flex justify-center items-center p-4">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div v-else>
                        <div v-for="device in inputDevices" :key="device" class="form-control">
                            <label class="label cursor-pointer justify-start gap-2">
                                <input type="checkbox" class="checkbox checkbox-sm" 
                                    :checked="selectedInputDevices.includes(device)"
                                    @change="toggleInputDevice(device)" />
                                <span class="label-text">{{ formatDeviceName(device, 'input') }}</span>
                            </label>
                        </div>
                        <div v-if="inputDevices.length === 0" class="p-2 text-center text-sm opacity-70">
                            No input devices found
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
                { title: "output", icon: "fas fa-volume-up fa-lg", id: "output" },
                { title: "microphone", icon: "fas fa-lg fa-microphone", id: "mic" },
                { title: "unmapped", icon: "fas fa-lg fa-question-circle", id: "unmapped"},
                { title: "active window", icon: "fas fa-lg fa-window-maximize", id: "activeWindow"},
                { title: "screen brightness", icon: "fas fa-lg fa-sun", id: "screen brightness"},
            ],
            activeDevices: [],
            sessions: [],
            outputDevices: [],
            selectedOutputDevices: [],
            loadingDevices: false,
            inputDevices: [],
            selectedInputDevices: [],
            loadingInputDevices: false,
        }
    },

    methods: {
        async setActiveDevice(device) {
            await SelectedApps.toggleApps(this.currentSliderID.toString(), device);
            this.getActiveDevices();

            // Load devices when corresponding system feature is selected
            if (device === 'output' && this.activeDevices?.includes('output')) {
                this.loadOutputDevices();
            }
            if (device === 'mic' && this.activeDevices?.includes('mic')) {
                this.loadInputDevices();
            }
        },

        async getActiveDevices(){
            if(this.currentSliderID === null) return;
            this.activeDevices = await SelectedApps.getApps(this.currentSliderID?.toString());
            
            // Initialize devices if corresponding system feature is already selected
            if (this.activeDevices?.includes('output')) {
                this.loadOutputDevices();
            }
            if (this.activeDevices?.includes('mic')) {
                this.loadInputDevices();
            }
        },

        async getSessions() {
            const sessionNames = await SystemVolumeController.getAllSessionNames(true);
            
            // Map "master" to "output" for backward compatibility
            this.sessions = sessionNames.map(session => 
                session === 'master' ? 'output' : session
            );
        },

        async loadOutputDevices() {
            this.loadingDevices = true;
            try {
                this.outputDevices = await SystemVolumeController.getOutputDeviceNames();
                const savedSelections = await SelectedApps.getOutputDevices(this.currentSliderID?.toString());
                if (savedSelections && savedSelections.length) {
                    this.selectedOutputDevices = savedSelections;
                }
            } catch (error) {
                console.error("Failed to load output devices:", error);
            } finally {
                this.loadingDevices = false;
            }
        },
        
        async loadInputDevices() {
            this.loadingInputDevices = true;
            try {
                this.inputDevices = await SystemVolumeController.getInputDeviceNames();
                const savedSelections = await SelectedApps.getInputDevices(this.currentSliderID?.toString());
                if (savedSelections && savedSelections.length) {
                    this.selectedInputDevices = savedSelections;
                }
            } catch (error) {
                console.error("Failed to load input devices:", error);
            } finally {
                this.loadingInputDevices = false;
            }
        },

        async toggleOutputDevice(device) {
            if (this.selectedOutputDevices.includes(device)) {
                this.selectedOutputDevices = this.selectedOutputDevices.filter(d => d !== device);
            } else {
                this.selectedOutputDevices.push(device);
            }
            await SelectedApps.setOutputDevices(this.currentSliderID?.toString(), this.selectedOutputDevices);
        },

        async toggleInputDevice(device) {
            if (this.selectedInputDevices.includes(device)) {
                this.selectedInputDevices = this.selectedInputDevices.filter(d => d !== device);
            } else {
                this.selectedInputDevices.push(device);
            }
            await SelectedApps.setInputDevices(this.currentSliderID?.toString(), this.selectedInputDevices);
        },

        formatDeviceName(device, type = 'output') {
            const prefix = type === 'input' ? 'input: ' : 'output: ';
            return device.replace(prefix, '');
        }
    },

    mounted() {
        this.getActiveDevices();
        this.getSessions();
    },
}
</script>

<style lang="scss" scoped></style>
<style lang="scss" scoped></style>