<template>
    <div class="flex flex-col gap-4 w-full h-64 overflow-y-scroll p-2">
        <div class="grid grid-cols-3 w-1/2 m-auto gap-4">
            <div class="flex flex-col justify-center items-center" v-for="utility in utilities" :key="utility.id">
                <button :disabled="(utility.id === 'output' && deviceSelectors.output.devices.length === 0) || (utility.id === 'input' && deviceSelectors.input.devices.length === 0)" @click="setActiveUtility(utility.id)" class="btn btn-circle"
                    :class="activeUtilities?.includes(utility.id) ? 'btn-primary' : ''">
                    <i :class="utility.icon"></i>
                </button>
                <span class="text-base-content text-xs text-center capitalize my-1"> {{ utility.title }}</span>
            </div>
        </div>

        <div v-if="activeUtilities?.includes('output') || activeUtilities?.includes('input')" class="divider label-text">Settings</div>

        <!-- Combined device selector -->
        <div v-show="activeUtilities?.includes(type)" v-for="(selector, type) in deviceSelectors" :key="type" class="w-4/5 m-auto">
            <h3 class="text-base-content text-sm font-semibold mb-2">{{ selector.title }}</h3>
            <div class="dropdown w-full">
                <div tabindex="0" role="button" class="btn w-full justify-between">
                    <span>{{ selector.selectedDevices.length ? `${selector.selectedDevices.length} device(s) selected` : selector.placeholder }}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-full max-h-60 overflow-y-auto">
                    <div v-if="selector.loading" class="flex justify-center items-center p-4">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div v-else>
                        <div v-for="device in selector.devices" :key="device" class="form-control">
                            <label class="label cursor-pointer justify-start gap-2">
                                <input type="checkbox" class="checkbox checkbox-sm" 
                                    :checked="selector.selectedDevices.includes(device)"
                                    @change="toggleDeviceSelection(device, type)" />
                                <span class="label-text">{{ formatDeviceName(device, type) }}</span>
                            </label>
                        </div>
                        <div v-if="selector.devices.length === 0" class="p-2 text-center text-sm opacity-70">
                            No {{ type }} devices found
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
            utilities: [
                { title: "output", icon: "fas fa-volume-up fa-lg", id: "output" },
                { title: "input", icon: "fas fa-lg fa-microphone", id: "input" },
                { title: "unmapped", icon: "fas fa-lg fa-question-circle", id: "unmapped"},
                { title: "active window", icon: "fas fa-lg fa-window-maximize", id: "activeWindow"},
                { title: "screen brightness", icon: "fas fa-lg fa-sun", id: "screen brightness"},
            ],
            activeUtilities: [],
            sessions: [],
            deviceSelectors: {
                output: {
                    title: 'Select Output Devices',
                    placeholder: 'Select output devices',
                    loading: false,
                    devices: [],
                    selectedDevices: []
                },
                input: {
                    title: 'Select Input Devices',
                    placeholder: 'Select input devices',
                    loading: false,
                    devices: [],
                    selectedDevices: []
                }
            }
        }
    },

    methods: {
        async setActiveUtility(utility) {
            await SelectedApps.toggleApps(this.currentSliderID.toString(), utility);
            this.getActiveUtilities();
            
            // If output was just selected, check if we need to auto-select default device
            if (utility === 'output') {
                this.selectDefaultOutputDevice();
            }
        },

        async selectDefaultOutputDevice() {
            // Make sure output devices are loaded
            if (this.deviceSelectors.output.devices.length === 0) {
                await this.loadOutputDevices();
            }
            
            // Only auto-select if no devices are currently selected
            if (this.deviceSelectors.output.selectedDevices.length === 0) {
                // Find the default output device
                const defaultDevice = this.deviceSelectors.output.devices.find(
                    device => device.endsWith('(default_output)')
                );
                
                // If found, select it
                if (defaultDevice) {
                    await this.toggleDeviceSelection(defaultDevice, 'output');
                }
            }
        },

        async getActiveUtilities(){
            if(this.currentSliderID === null) return;
            this.activeUtilities = await SelectedApps.getApps(this.currentSliderID?.toString());
            
            // Initialize devices if corresponding system feature is already selected
            if (this.activeUtilities?.includes('output')) {
                this.loadOutputDevices();
            }
            if (this.activeUtilities?.includes('input')) {
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
            this.deviceSelectors.output.loading = true;
            try {
                const devices = await SystemVolumeController.getOutputDevices();
                const allApps = await SelectedApps.getApps(this.currentSliderID);
                
                // Filter saved devices from all apps
                const savedSelections = allApps ? allApps.filter(app => app.startsWith('output: ')) : [];
                
                // Merge current devices with saved selections that aren't in the current list
                const mergedDevices = [...devices];
                if (savedSelections && savedSelections.length) {
                    savedSelections.forEach(device => {
                        if (!mergedDevices.includes(device)) {
                            mergedDevices.push(device);
                        }
                    });
                    this.deviceSelectors.output.selectedDevices = savedSelections;
                }
                
                this.deviceSelectors.output.devices = mergedDevices;
            } catch (error) {
                console.error("Failed to load output devices:", error);
            } finally {
                this.deviceSelectors.output.loading = false;
            }
        },
        
        async loadInputDevices() {
            console.log("loadInputDevices");
            this.deviceSelectors.input.loading = true;
            try {
                const devices = await SystemVolumeController.getInputDevices();
                const allApps = await SelectedApps.getApps(this.currentSliderID);
                
                // Filter saved devices from all apps
                const savedSelections = allApps ? allApps.filter(app => app.startsWith('input: ')) : [];
                
                // Merge current devices with saved selections that aren't in the current list
                const mergedDevices = [...devices];
                if (savedSelections && savedSelections.length) {
                    savedSelections.forEach(device => {
                        if (!mergedDevices.includes(device)) {
                            mergedDevices.push(device);
                        }
                    });
                    this.deviceSelectors.input.selectedDevices = savedSelections;
                }
                
                this.deviceSelectors.input.devices = mergedDevices;
            } catch (error) {
                console.error("Failed to load input devices:", error);
            } finally {
                this.deviceSelectors.input.loading = false;
            }
        },

        async toggleDeviceSelection(device, type) {
            const selectedDevices = [...this.deviceSelectors[type].selectedDevices];
            
            // This code toggles a device selection in the array
            // First, find the device in the selected devices array
            const index = selectedDevices.indexOf(device);
            // If the device is already selected (index > -1), remove it from the array
            if (index > -1) {
                selectedDevices.splice(index, 1);
            } else {
                // If the device is not already selected, add it to the array
                selectedDevices.push(device);
            }

            // Update the deviceSelectors object
            this.deviceSelectors[type].selectedDevices = selectedDevices;

            await this.saveDevices(selectedDevices, type);
        },

        // Save the selected devices by toggling them with all current selections
        async saveDevices(devices, type) {
            const allApps = await SelectedApps.getApps(this.currentSliderID) || [];
            
            // Remove all devices of the current type from allApps
            const prefix = `${type}: `;
            const filteredApps = allApps.filter(app => !app.startsWith(prefix));
            
            // Combine non-device apps with the new device selection
            const updatedApps = [...filteredApps, ...devices];
            
            // Set all apps at once
            await SelectedApps.toggleApps(this.currentSliderID?.toString(), allApps);
            await SelectedApps.toggleApps(this.currentSliderID?.toString(), updatedApps);
        },

        formatDeviceName(device, type = 'output') {
            console.log("formatDeviceName", device, type);
            const prefix = type === 'input' ? 'input: ' : 'output: ';
            if (device.startsWith(prefix)) {
                return device.substring(prefix.length);
            }
            return device;
        }, 

        
    },

    mounted() {
        this.getActiveUtilities();
        this.getSessions();
        this.loadOutputDevices();
        this.loadInputDevices();

    },
}
</script>

<style lang="scss" scoped></style>
<style lang="scss" scoped></style>