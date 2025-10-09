<template>
    <div class="flex flex-col gap-4 w-full h-64 overflow-y-scroll p-2">
        <div class="grid grid-cols-3 w-1/2 m-auto gap-2">
            <div class="flex flex-col justify-start items-center" v-for="utility in mergedUtilities" :key="utility.id">
                <button :disabled="(utility.id === 'output' && deviceSelectors.output.devices.length === 0) || (utility.id === 'input' && deviceSelectors.input.devices.length === 0)" @click="setActiveUtility(utility.id)" class="btn btn-circle"
                    :class="getUtilityActiveClass(utility)">
                    <i :class="utility.icon"></i>
                </button>
                <span class="text-base-content text-xs text-center capitalize my-1 h-10"> {{ utility.title }}</span>
            </div>
        </div>

        <div v-if="activeUtilities?.includes('output') || activeUtilities?.includes('input')" class="divider label-text">Settings</div>

        <!-- Combined device selector -->
        <div v-show="activeUtilities?.includes(type)" v-for="(selector, type) in deviceSelectors" :key="type" class="w-4/5 m-auto">
            <h3 class="text-base-content text-sm font-semibold mb-2">{{ selector.title }}</h3>
            <div class="dropdown w-full">
                <div tabindex="0" role="button" class="btn w-full justify-between">
                    <span>{{ getDeviceDisplayCount(type, selector.selectedDevices) }}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div tabindex="0" class="dropdown-content border-2 border-base-300 z-50 menu p-2 shadow bg-base-200 rounded-xl w-full max-h-60 overflow-y-auto">
                    <div v-if="selector.loading" class="flex justify-center items-center p-4">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div v-else>
                        <!-- Master/Mic option -->
                        <div class="form-control">
                            <label class="label cursor-pointer justify-between hover:bg-base-300 rounded-md p-2">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" class="checkbox checkbox-sm" 
                                        :checked="activeUtilities?.includes(type === 'output' ? 'master' : 'mic')"
                                        @change="setActiveUtility(type === 'output' ? 'master' : 'mic')" />
                                    <span class="label-text">{{ type === 'output' ? 'Master - Default Output' : 'Mic - Default Input' }}</span>
                                </div>
                                <div class="tooltip tooltip-left z-50 before:-translate-y-2" 
                                    :data-tip="type === 'output' ? 
                                        'This option follows the default audio output device. If you change your system\'s output device, this will always control the active device.' : 
                                        'This option follows the default audio input device. If you change your system\'s input device, this will always control the active device.'">
                                    <i class="fas fa-info-circle text-info text-sm"></i>
                                </div>
                            </label>
                        </div>
                        <div v-if="selector.devices.length > 0" class="divider divider-start m-1 p-1 label-text text-xs text-left">{{ type === 'output' ? 'Output Devices' : 'Input Devices' }}</div>
                        <!-- Other device options -->
                        <div v-for="device in selector.devices" :key="device" class="form-control">
                            <label v-if="device !== 'master' && device !== 'mic'" class="label cursor-pointer justify-start gap-2 hover:bg-base-300 rounded-md p-2">
                                <input type="checkbox" class="checkbox checkbox-sm" 
                                    :checked="selector.selectedDevices.includes(device)"
                                    @change="toggleDeviceSelection(device, type)" />
                                <span class="label-text" v-html="formatDeviceName(device, type)"></span>
                            </label>
                        </div>
                        <div v-if="selector.devices.length === 0" class="p-2 text-center text-sm opacity-70">
                            No {{ type }} devices found
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Plugin per-button settings -->
        <div v-if="selectedPluginButtonsWithSettings.length" class="divider label-text">Plugin Settings</div>
        <div v-for="btn in selectedPluginButtonsWithSettings" :key="btn.actionId || btn.id" class="w-4/5 m-auto">
            <h3 class="text-base-content text-sm font-semibold mb-2">{{ btn.title }}</h3>
            <PluginSettingsRenderer :sections="btn.settings" :pluginId="btn.pluginId" />
        </div>
    </div>
</template>

<script>
import SelectedApps from "../ts/appsToControl.ts";
import SystemVolumeController from "../ts/volumeControl.ts";
import pluginAPI from "../plugin-api/pluginAPI";
import EventBus from "../js/eventBus.js";
import PluginSettingsRenderer from "../components/PluginSettingsRenderer.vue";

export default {
    components: { PluginSettingsRenderer },
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
            pluginButtons: [],
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

    computed: {
        mergedUtilities() {
            return [
                ...this.utilities,
                ...(this.pluginButtons || []).map(btn => ({ id: btn.actionId || btn.id, title: btn.title || btn.id, icon: btn.icon || 'fas fa-lg fa-bolt', isPlugin: true, raw: btn }))
            ];
        },
        selectedPluginButtonsWithSettings() {
            const channelKey = String(this.currentSliderID);
            return (this.pluginButtons || []).filter((b) => {
                const selected = b?.selectedByChannel && typeof b.selectedByChannel === 'object' ? !!b.selectedByChannel[channelKey] : false;
                const hasSettings = b && b.settings && Array.isArray(b.settings.sections) && b.settings.sections.length > 0;
                return selected && hasSettings;
            });
        },
        getDeviceDisplayCount() {
            return (type, selectedDevices) => {
                let count = selectedDevices.length;                
                // Add 1 to count if master/mic is selected
                if (type === 'output' && this.activeUtilities?.includes('master')) {
                    count += 1;
                } else if (type === 'input' && this.activeUtilities?.includes('mic')) {
                    count += 1;
                }
                
                return count ? `${count} ${count === 1 ? 'device' : 'devices'} selected` : this.deviceSelectors[type].placeholder;
            };
        }
    },

    methods: {
        async loadPluginButtons() {
            try {
                // Load buttons from all connected plugins and flatten
                const plugins = await pluginAPI.getConnectedPlugins();
                const all = [];
                for (const p of (plugins || [])) {
                    const actions = await pluginAPI.getPluginActions(p.id);
                    if (actions && actions.buttons && actions.buttons.length) {
                        console.log('actions.buttons', actions.buttons);
                        all.push(...actions.buttons.map(b => ({ ...b, pluginId: p.id })));
                        console.log('all', all);
                    }
                }
                this.pluginButtons = all;
            } catch (e) {
                console.error('Failed to load plugin slider actions', e);
                this.pluginButtons = [];
            }
        },
        getUtilityActiveClass(utility){
            if(utility.isPlugin){
                const btn = utility?.raw || {};
                const channelKey = String(this.currentSliderID);
                const selectedForChannel = btn?.selectedByChannel && typeof btn.selectedByChannel === 'object'
                    ? !!btn.selectedByChannel[channelKey]
                    : false;
                return selectedForChannel ? 'btn-primary' : '';
            }
            return this.activeUtilities?.includes(utility.id) ? 'btn-primary' : '';
        },
        async setActiveUtility(utility) {
            // If this is a plugin button (actionId) fire action to plugin
            const pluginBtn = (this.pluginButtons || []).find(b => (b.actionId || b.id) === utility);
            if (pluginBtn) {
                try {
                    const channelKey = String(this.currentSliderID);
                    const currentlySelected = pluginBtn?.selectedByChannel && typeof pluginBtn.selectedByChannel === 'object'
                        ? !!pluginBtn.selectedByChannel[channelKey]
                        : false;
                    await pluginAPI.emitAction(
                        pluginBtn.pluginId,
                        pluginBtn.actionId || pluginBtn.id,
                        { selected: !currentlySelected, channel: this.currentSliderID }
                    );
                } catch (e) {
                    console.error('Failed to emit plugin action for slider button', e);
                }
                return;
            }
            
            // default behavior for built-in utilities
            await SelectedApps.toggleApps(this.currentSliderID.toString(), utility);
            await this.getActiveUtilities();

            // If output/input auto-select logic
            if (utility === 'output') {
                if(!this.activeUtilities.some(item => item === 'output')){  
                    this.removeDevicesToggledApps('output');
                } else {
                    await SelectedApps.toggleApps(this.currentSliderID.toString(), 'master');
                    await this.getActiveUtilities();
                }
            }
            else if (utility === 'input') {
                if(!this.activeUtilities.some(item => item === 'input')){
                    this.removeDevicesToggledApps('input');
                } else {
                    await SelectedApps.toggleApps(this.currentSliderID.toString(), 'mic');
                    await this.getActiveUtilities();
                }
            }
        },

        async removeDevicesToggledApps(type){
            const allApps = await SelectedApps.getApps(this.currentSliderID);
            const prefix = `${type}: `;
            const filteredApps = allApps.filter(app => app.startsWith(prefix));
            if(this.activeUtilities.includes(type === 'output' ? 'master' : 'mic')){
                filteredApps.push(type === 'output' ? 'master' : 'mic');
            }
            await SelectedApps.toggleApps(this.currentSliderID?.toString(), filteredApps);
        },


        //get active utilities - if currentSliderID is null, return
        //for backward compatibility map master to output and mic to input
        //if master is active, select output
        //if mic is active, select input

        async getActiveUtilities(){
            if(this.currentSliderID === null) return;
            this.activeUtilities = await SelectedApps.getApps(this.currentSliderID?.toString());
        }, 

        async mapMasterToOutput(){
            await this.getActiveUtilities();
            //for backward compatibility map master to output and mic to input
            //if master is active, select output
            if(this.activeUtilities.includes('master') && !this.activeUtilities.includes('output')){
                await SelectedApps.toggleApps(this.currentSliderID?.toString(), 'output');
                await this.getActiveUtilities();
            }
            //if mic is active, select input
            if(this.activeUtilities.includes('mic') && !this.activeUtilities.includes('input')){
                await SelectedApps.toggleApps(this.currentSliderID?.toString(), 'input');
                await this.getActiveUtilities();
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
                    if (JSON.stringify(this.deviceSelectors.output.selectedDevices) === JSON.stringify(savedSelections) && !update) {
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
            
            if (type === 'output') {
                await this.loadOutputDevices(true);
            } else if (type === 'input') {
                await this.loadInputDevices(true);
            }
        },

        formatDeviceName(device, type = 'output') {
            const prefix = type === 'input' ? 'input: ' : 'output: ';
            let name = device;
            
            // Remove prefix if present
            if (name.startsWith(prefix)) {
                name = name.substring(prefix.length);
            }
            
            // Replace default output/input suffixes with bolded text
            name = name.replace(/ \(default_output\)$/, ' <b>- Default Output</b>');
            name = name.replace(/ \(default_input\)$/, ' <b>- Default Input</b>');
            
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
        this.mapMasterToOutput();
        this.loadOutputDevices();
        this.loadInputDevices();
        this.setupDeviceUpdateInterval();
        this.loadPluginButtons();

        // Listen for plugin action updates to refresh action buttons
        this._actionsUpdatedHandler = ({ pluginId }) => {
            // We currently refresh all plugin buttons for simplicity
            this.loadPluginButtons();
        };
        EventBus.on('plugin:actionsUpdated', this._actionsUpdatedHandler);
    },
    
    beforeUnmount() {
        // Clean up interval when component is destroyed
        if (this.deviceUpdateInterval) {
            clearInterval(this.deviceUpdateInterval);
        }
        if (this._actionsUpdatedHandler) {
            EventBus.off('plugin:actionsUpdated', this._actionsUpdatedHandler);
        }
    },
}
</script>

<style lang="scss" scoped>
</style>