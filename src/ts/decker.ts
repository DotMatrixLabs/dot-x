import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useDeckerStore } from "../store/deckerStore.ts";
import ConfigStore from './config.ts';
class Decker {
    private comPort: string = "";
    // private debug: boolean;
    public sliders: Array<number> = [];

    constructor() {
        this.comPort = "";
    }

    public retryConnection(){
        this.init(this.comPort);
    }


    public async init(comPort: string){
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

        await listen('connection-change', (event: any) => {
            if(event.payload.message === "connected"){
                deckerStore.setConnected(true);
            } else if (event.payload.message === "disconnected"){
                deckerStore.setConnected(false);
            }
        })
        
        const unlisten = await listen('slider-change', (event: any) => {
            deckerStore.setConnected(true);
            // Split event.payload.message on comma and add it to sliders array
            const jsonString = event.payload.message;
            const jsonObject = JSON.parse(jsonString);
            const sliderArray: Array<number> = Object.values(jsonObject);
            this.sliders = sliderArray;
            deckerStore.setSliders(this.sliders);
            // console.log(this.sliders);
        })

        console.log(unlisten)

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
        const outputName = await ConfigStore.get("midiOutputPort");
        return await invoke('attach_midi_device', { outputName, outputPort });
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

