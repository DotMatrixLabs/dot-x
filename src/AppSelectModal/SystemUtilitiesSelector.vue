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
                    <span>{{ selector.selectedDevices.length ? `${selector.selectedDevices.length} ${selector.selectedDevices.length === 1 ? 'device' : 'devices'} selected` : selector.placeholder }}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-full max-h-60 overflow-y-auto">
                    <div v-if="selector.loading" class="flex justify-center items-center p-4">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div v-else>
                        <div v-for="device in selector.devices" :key="device" class="form-control">
                            <label class="label cursor-pointer justify-start gap-2 hover:bg-base-300 rounded-md p-2">
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
            },
            deviceUpdateInterval: null,
        }
    },

    methods: {
        async setActiveUtility(utility) {
            await SelectedApps.toggleApps(this.currentSliderID.toString(), utility);
            await this.getActiveUtilities();
            
            // If output was just selected, check if we need to auto-select default device
            if (utility === 'output') {
                //if output was deselected, remove all devices toggled, else select default device
                if(!this.activeUtilities.some(item => item === 'output')){  
                    this.removeDevicesToggledApps('output');
                } else {
                    this.selectDefaultOutputDevice();
                }
            }
            // If input was just selected, check if we need to auto-select default device
            else if (utility === 'input') {
                //if input was deselected, remove all devices toggled, else select default device
                if(!this.activeUtilities.some(item => item === 'input')){
                    this.removeDevicesToggledApps('input');
                } else {
                    this.selectDefaultInputDevice();
                }
            }
        },

        async removeDevicesToggledApps(type){
            const allApps = await SelectedApps.getApps(this.currentSliderID);
            const prefix = `${type}: `;
            const filteredApps = allApps.filter(app => app.startsWith(prefix));
            await SelectedApps.toggleApps(this.currentSliderID?.toString(), filteredApps);
        },

        async selectDefaultOutputDevice() {
            // Make sure output devices are loaded
            if (this.deviceSelectors.output.devices.length === 0) {
                await this.loadOutputDevices(true);
            }

            // Find the default output device
            const defaultDevice = this.deviceSelectors.output.devices.find(
                device => device.endsWith('(default_output)')
            );
            
            // If found, select it
            if (defaultDevice) {
                await this.toggleDeviceSelection(defaultDevice, 'output');
            }
        },

        async selectDefaultInputDevice() {
            // Make sure input devices are loaded
            if (this.deviceSelectors.input.devices.length === 0) {
                await this.loadInputDevices(true);
            }

            // Find the default input device
            const defaultDevice = this.deviceSelectors.input.devices.find(
                device => device.endsWith('(default_input)')
            );
            
            // If found, select it
            if (defaultDevice) {
                await this.toggleDeviceSelection(defaultDevice, 'input');
            }
        },

        //get active utilities - if currentSliderID is null, return
        //for backward compatibility map master to output and mic to input
        //if master is active, select output
        //if mic is active, select input

        async getActiveUtilities(){
            if(this.currentSliderID === null) return;
            this.activeUtilities = await SelectedApps.getApps(this.currentSliderID?.toString());

            //for backward compatibility map master to output and mic to input
            if (this.activeUtilities?.includes('master')) {
                // change master to output
                await SelectedApps.toggleApps(this.currentSliderID.toString(), 'output');
                await SelectedApps.toggleApps(this.currentSliderID?.toString(), 'master');
                this.activeUtilities = await SelectedApps.getApps(this.currentSliderID?.toString()); 
                await this.selectDefaultOutputDevice();
            }
            if (this.activeUtilities?.includes('mic')) {
                // change mic to input
                await SelectedApps.toggleApps(this.currentSliderID.toString(), 'input');
                await SelectedApps.toggleApps(this.currentSliderID?.toString(), 'mic');
                this.activeUtilities = await SelectedApps.getApps(this.currentSliderID?.toString()); 
                await this.selectDefaultInputDevice();
            }
        }, 

        //load output devices - if update is true, don't show loading indicator and only update if there is a change to the device list
        async loadOutputDevices(update = false) {
            if(!update){
                this.deviceSelectors.output.loading = true;
            }
            try {
                const devices = await SystemVolumeController.getOutputDevices();
                const allApps = await SelectedApps.getApps(this.currentSliderID);
                
                // Filter saved devices from all apps
                const savedSelections = allApps ? allApps.filter(app => app.startsWith('output: ')) : [];

                if(savedSelections.length === 0){
                    this.deviceSelectors.output.selectedDevices = [];
                }
                
                // Merge current devices with saved selections that aren't in the current list
                const mergedDevices = [...devices];
                if (savedSelections && savedSelections.length) {
                    savedSelections.forEach(device => {
                        if (!mergedDevices.includes(device)) {
                            mergedDevices.push(device);
                        }
                    });

                    //if there is no change to the device list, don't update the devices
                    if(JSON.stringify(this.deviceSelectors.output.selectedDevices) === JSON.stringify(savedSelections) && !update){
                        return;
                    }

                    this.deviceSelectors.output.selectedDevices = savedSelections;
                }
                
                this.deviceSelectors.output.devices = mergedDevices;
            } catch (error) {
                console.error("Failed to load output devices:", error);
            } finally {
                this.deviceSelectors.output.loading = false;
            }
        },
        
        //load input devices - if update is true, don't show loading indicator and only update if there is a change to the device list
        async loadInputDevices(update = false) {
            if(!update){
                this.deviceSelectors.input.loading = true;
            }
            try {
                const devices = await SystemVolumeController.getInputDevices();
                const allApps = await SelectedApps.getApps(this.currentSliderID);
                
                // Filter saved devices from all apps
                const savedSelections = allApps ? allApps.filter(app => app.startsWith('input: ')) : [];

                if(savedSelections.length === 0){
                    this.deviceSelectors.input.selectedDevices = [];
                }
                
                // Merge current devices with saved selections that aren't in the current list
                const mergedDevices = [...devices];
                if (savedSelections && savedSelections.length) {
                    savedSelections.forEach(device => {
                        if (!mergedDevices.includes(device)) {
                            mergedDevices.push(device);
                        }
                    });

                    //if there is no change to the device list, don't update the devices
                    if(JSON.stringify(this.deviceSelectors.input.selectedDevices) === JSON.stringify(savedSelections) && !update){
                        return;
                    }

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
            await SelectedApps.toggleApps(this.currentSliderID?.toString(), device);
            await this.loadOutputDevices(true);
            await this.loadInputDevices(true);
        },


        formatDeviceName(device, type = 'output') {
            const prefix = type === 'input' ? 'input: ' : 'output: ';
            let name = device;
            
            // Remove prefix if present
            if (name.startsWith(prefix)) {
                name = name.substring(prefix.length);
            }
            
            // Remove default output/input suffixes and replace with - Default Output/Input
            name = name.replace(/ \(default_output\)$/, ' - Default Output');
            name = name.replace(/ \(default_input\)$/, ' - Default Input');
            
            return name;
        }, 

        // Check and update devices based on active utilities
        updateActiveDevices() {
            if (this.activeUtilities?.includes('output')) {
                this.loadOutputDevices(true);
            }
            
            if (this.activeUtilities?.includes('input')) {
                this.loadInputDevices(true);
            }
        },
        
        // Setup interval for device updates
        setupDeviceUpdateInterval() {
            // Clear existing interval if it exists
            if (this.deviceUpdateInterval) {
                clearInterval(this.deviceUpdateInterval);
            }
            
            // Create new interval that runs every second
            this.deviceUpdateInterval = setInterval(() => {
                this.updateActiveDevices();
            }, 1000);
        },
    },

    mounted() {
        this.getActiveUtilities();
        this.loadOutputDevices();
        this.loadInputDevices();
        this.setupDeviceUpdateInterval();
    },
    
    beforeUnmount() {
        // Clean up interval when component is destroyed
        if (this.deviceUpdateInterval) {
            clearInterval(this.deviceUpdateInterval);
        }
    },
}
</script>

<style lang="scss" scoped>
</style>