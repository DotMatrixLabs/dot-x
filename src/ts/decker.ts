import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useDeckerStore } from "../store/deckerStore.ts";
import SystemVolumeController from "./volumeControl.ts";
import ConfigStore from './config.ts';
import appsToControl from './appsToControl.ts';
import { trackEvent } from "@aptabase/tauri";
import EventBus from '../js/eventBus.js';
import { createLogger } from './logger.ts';

const log = createLogger('decker');

class Decker {
    private comPort: string = "";
    private initiated: boolean;
    // private debug: boolean;
    public sliders: Array<number> = [];
    sliderListenerDetatcher: any;
    MIDIListenerDetatcher: any;

    constructor() {
        this.comPort = "";
        this.initiated = false;
        this.sliderListenerDetatcher = null;
        this.MIDIListenerDetatcher = null;
    }

    private async initClass() {
        const deckerStore = useDeckerStore();
        await listen('connection-change', (event: any) => {
            if(event.payload.message === "connected"){
                deckerStore.setConnected(true);
                this.updateSliders();
                EventBus.emit('connectionChange', {connected: true});
            } else if (event.payload.message === "disconnected"){
                this.handleSliderDisconnect();
                deckerStore.setConnected(false);
                EventBus.emit('connectionChange', {connected: false});
            }
        })
    }

    public retryConnection(){
        this.init(this.comPort);
    }

    private async handleSliderDisconnect(){
        const actOnDeckerDisconnect = await ConfigStore.get("actOnDeckerDisconnect"); // Get the value of actOnDeckerDisconnect from config
        if(!actOnDeckerDisconnect) return; // If actOnDeckerDisconnect is false, don't do anything

        const sliderOptions = await ConfigStore.get("sliderDisconnectHandleOptions");

        sliderOptions.forEach( (sliderOption: string, index: number) => {
            sliderOption = sliderOption.toLowerCase();
            if(sliderOption === "do nothing") return;

            if(sliderOption === "mute"){
                log.debug("Muting slider", index);
                SystemVolumeController.setChannelVolume(index, 0.001); // Set the volume to 0.001 to mute it, since WSAPI is a piece of work.
            }

            if(sliderOption === "maximize volume"){
                SystemVolumeController.setChannelVolume(index, 1.0);
            }
            
        });
    }

    // Update sliders after reconnecting the Decker.
    private async updateSliders(){
        const actOnDeckerDisconnect = await ConfigStore.get("actOnDeckerDisconnect"); // Get the value of actOnDeckerDisconnect from config
        const sliders = useDeckerStore().sliders;
        if(actOnDeckerDisconnect === true){
            sliders.forEach((_sliderVol, index) => {
                log.debug("Setting slider", index, "to 0.001");
                SystemVolumeController.setChannelVolume(index, 0.001);
            });
        }

        sliders.forEach((sliderVol, index) => {
          if (sliderVol === 0) sliderVol = 0.1;
        
          const targetVolume = sliderVol / 100;
          const initialVolume = sliderVol;
          const increment = 0.5; // Adjust the increment value as needed
          let currentVolume = initialVolume;
          if(currentVolume + increment > targetVolume) currentVolume = targetVolume; // If the current volume + increment is greater than the target volume, set the current volume to the target volume.
        
          const graduallyIncreaseVolume = () => {
            SystemVolumeController.setChannelVolume(index, currentVolume);
            currentVolume += increment;
        
            if (currentVolume <= targetVolume) {
              setTimeout(graduallyIncreaseVolume, 50); // Adjust the timeout value as needed
            }
          };
        
          graduallyIncreaseVolume();
        });
    }


    public async init(comPort: string){
        if(!this.initiated) this.initClass();
        this.initiated = true;

        const newDevices:any = await this.getDevices();
        const device = newDevices.find((device:any) => device.port_name === comPort);
        if(device && (device.pid === 58918 && device.vid === 1240)) trackEvent("decker_connected");

        const deckerStore = useDeckerStore();
        this.comPort = comPort;

        log.info("Connecting to Decker...", comPort)
        const inverted = await ConfigStore.get("invertedSliders");
        await invoke('connect_decker', { portName: comPort, inverted: inverted ?? false }).then(async () => {
            log.info("Decker connected")
            deckerStore.setConnected(true);
            if(await ConfigStore.get("midiEnabled")) this.attachMidiDevice(await ConfigStore.get("midiOutputPortNumber"));
        }).catch((error) => {
            log.error("Error connecting to Decker", error)
            deckerStore.setConnected(false);
        });
        // await invoke('init_process');


        
        this.sliderListenerDetatcher = await listen('slider-change', (event: any) => {
            deckerStore.setConnected(true);
            // Split event.payload.message on comma and add it to sliders array
            const jsonString = event.payload.message;
            const jsonObject = JSON.parse(jsonString);
            const sliderArray: Array<number> = Object.values(jsonObject);
            this.sliders = sliderArray;
            deckerStore.setSliders(this.sliders);
        });

        this.MIDIListenerDetatcher = await listen('midi_detached', async () => {
            log.debug("MIDI was detached");
            const midiEnabled = await ConfigStore.get("midiEnabled");
            const midiOutputPortNumber = await ConfigStore.get("midiOutputPortNumber");
            if(!midiEnabled) return;
            if(!midiOutputPortNumber) return;
            this.attachMidiDevice(midiOutputPortNumber);
        });
    }

    public async disconnect() {
        log.info("Disconnecting from Decker...");
        await invoke('disconnect_decker');
        this.sliderListenerDetatcher();
        this.MIDIListenerDetatcher();
    }


    
    public async getDevices() {
        return await invoke('get_devices');
    }

    /**
     * Get the names of all available MIDI devices.
     * @returns {Promise<string[]>} A promise that resolves with an array of session names.
     */
    public async getMidiDevices() {
        return await invoke('get_available_midi_output_port_names');
    }

    /**
     * Open a MIDI connection to the selected device.
     * @returns 
     */
    public async attachMidiDevice(outputPort: number) {
        const deckerStore = useDeckerStore();
        const outputName = await ConfigStore.get("midiOutputPort");
        const MAX_RETRIES = 5;
        let retries = 0;
        let sliderApps: Array<string>[] = [];
        let midiSliders: Array<Number> = [];

        // Wait for deckerStore.getSliders to not return an empty array. This takes some time when the app is first started.
        while (deckerStore.getSliders.length === 0) {
            log.debug('Waiting for deckerStore.getSliders to not return an empty array.');
            retries++;
            if (retries > MAX_RETRIES) {
                log.error("Failed to get sliders from deckerStore, no sliders are MIDI enabled.");
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before checking again
        }

        // Iterate over all sliders and get the apps for each slider
        for (let i = 0; i < deckerStore.getSliders.length; i++) {
            const apps = await appsToControl.getApps(i) || [];  // Use empty array if apps is null
            sliderApps.push(apps);
        }
        
        // Iterate over sliderApps, look for "midi" in all arrays inside sliderApps array and if found, add it to the midiSliders array
        sliderApps.forEach((sliderApp, index) => {
            if(sliderApp == null) return;
            if(sliderApp.includes("midi")){
                midiSliders.push(index);
            }
        });

        let midiConfiguration = await ConfigStore.get("midiConfiguration");
        if(midiConfiguration?.length === 0) midiConfiguration = [];
        log.debug("Attaching MIDI with configuration", midiConfiguration);
        trackEvent("midi_attached🔊");
        return await invoke('attach_midi_device', { outputName, outputPort, midiSliders, midiConfiguration });
    }

    /**
     * Disables the MIDI connection
     * @returns 
     */
        public async detachMidiDevice() {
            return await invoke('detach_midi_device');
        }


    public detectDeviceChanges() {
        const deckerStore = useDeckerStore();

        setInterval(async () => {
            if(deckerStore.connected) return;
            const comPort = await ConfigStore.get("comPort");
            const newDevices:any = await this.getDevices();
            const device = newDevices.find((device:any) => device.port_name === comPort);
            if(!device) return;
            if(device.port_name === comPort && !deckerStore.connected){
                this.init(comPort);
            }
        }, 1000);
    }

    public async initMidi() {
        const midiEnabled = await ConfigStore.get("midiEnabled");
        log.debug("MIDI enabled?", midiEnabled);
        if(!midiEnabled) return;
        const midiOutputPort = await ConfigStore.get("midiOutputPort");
        log.debug("MIDI output port?", midiOutputPort);
        if(!midiOutputPort) return;
        const midiOutputPortNumber = await ConfigStore.get("midiOutputPortNumber");
        log.info("Connecting to MIDI device...", midiOutputPort, "on port number", midiOutputPortNumber);
        this.attachMidiDevice(midiOutputPortNumber);
    }

    public async sendCommand(command: string, options: Object) {
        return await invoke('send_decker_command', { command, options });
    }

    /**
     * Get the device info from the Decker
     * @returns {Promise<any>} A promise that resolves with the device info.
     * deviceInfo = {
     * "firmware_version": "1.0.0",
     * "serial_number": "A1-B123-0001",
     * "model": "VM-5SW"
     * }
     * @example
     * const deviceInfo = await Decker.getDeviceInfo();
     * console.log(deviceInfo);
     */

    public async getDeviceInfo() {
        const command = "get-device-info";
        //wait for the device info to be updated, clears the listener after 2 seconds
        return new Promise(async (resolve, reject) => {
            const unlisten = await listen('device-info', (event: any) => {
                const deviceInfo = JSON.parse(event.payload.message);
                resolve(deviceInfo);
            });

            invoke('send_decker_command', { command }).catch(error => {
                reject(new Error(`Failed to send command: ${error.message}`));
            });

            setTimeout(() => {
                unlisten();
                reject(new Error("Timeout: Device info not received within 2 seconds"));
            }, 2000);
        });
    }

}

export default (new Decker());

