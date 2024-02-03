import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useDeckerStore } from "../store/deckerStore.ts";
import SystemVolumeController from "./volumeControl.ts";
import ConfigStore from './config.ts';
import appsToControl from './appsToControl.ts';

class Decker {
    private comPort: string = "";
    private initiated: boolean;
    // private debug: boolean;
    public sliders: Array<number> = [];

    constructor() {
        this.comPort = "";
        this.initiated = false;
    }

    private async initClass() {
        const deckerStore = useDeckerStore();
        await listen('connection-change', (event: any) => {
            if(event.payload.message === "connected"){
                deckerStore.setConnected(true);
                this.updateSliders();
            } else if (event.payload.message === "disconnected"){
                this.handleSliderDisconnect();
                deckerStore.setConnected(false);
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
                console.log("Muting slider", index);
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
        console.log({actOnDeckerDisconnect});
        const sliders = useDeckerStore().sliders;
        if(actOnDeckerDisconnect === true){
            sliders.forEach((_sliderVol, index) => {
                console.log("Setting slider", index, "to 0.001");
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

        const deckerStore = useDeckerStore();
        this.comPort = comPort;

        console.log("Connecting to Decker...", comPort)

        await invoke('connect_decker', { portName: comPort }).then(() => {
            console.log("Decker Connected!")
            deckerStore.setConnected(true);
        }).catch((error) => {
            console.log("Error connecting to Decker😭😭",error)
            deckerStore.setConnected(false);
        });
        // await invoke('init_process');


        
        const unlisten = await listen('slider-change', (event: any) => {
            deckerStore.setConnected(true);
            // Split event.payload.message on comma and add it to sliders array
            const jsonString = event.payload.message;
            const jsonObject = JSON.parse(jsonString);
            const sliderArray: Array<number> = Object.values(jsonObject);
            this.sliders = sliderArray;
            deckerStore.setSliders(this.sliders);
            // console.log(this.sliders);
        });

        const detachListener = await listen('midi_detached', async () => {
            console.log("[Midi.rs backend]: Midi was detached");
            const midiEnabled = await ConfigStore.get("midiEnabled");
            const midiOutputPortNumber = await ConfigStore.get("midiOutputPortNumber");
            if(!midiEnabled) return;
            if(!midiOutputPortNumber) return;
            this.attachMidiDevice(midiOutputPortNumber);
        });

        console.log(unlisten)
        console.log(detachListener)

        // setTimeout(() => {
        //     emit('slider-change', { value: 10 });
        //     console.log('emittd');
        // }, 2500);
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
        let sliderApps: Array<string>[] = [];
        let midiSliders: Array<Number> = [];
        
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
        return await invoke('attach_midi_device', { outputName, outputPort, midiSliders });
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
        console.log("MIDI Enabled?", midiEnabled);
        if(!midiEnabled) return;
        const midiOutputPort = await ConfigStore.get("midiOutputPort");
        console.log("MIDI Output port?", midiOutputPort);
        if(!midiOutputPort) return;
        const midiOutputPortNumber = await ConfigStore.get("midiOutputPortNumber");
        console.log("Connecting to MIDI Device...", midiOutputPort, "on port number", midiOutputPortNumber);
        this.attachMidiDevice(midiOutputPortNumber);
    }

    public async sendCommand(command: string, options: Object) {
        return await invoke('send_decker_command', { command, options });
    }

}

export default (new Decker());

