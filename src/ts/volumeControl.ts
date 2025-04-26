import { invoke } from '@tauri-apps/api/tauri';
import SelectedApps from './appsToControl';

/**
 * Class for controlling system volume and audio sessions.
 */
class SystemVolumeController {
    private lastActiveWindowExecutionTime: number;
    private lastSetVolumeExecutionTime: number;
    private lastActiveWindowExecutionResult: any;
    private lastSetVolumeApp: string;
    
    constructor() {
        this.lastActiveWindowExecutionTime = 0;
        this.lastActiveWindowExecutionResult = "";
        this.lastSetVolumeExecutionTime = 0;
        this.lastSetVolumeApp = "";
    }

    /**
     * Gets the current system volume.
     * @returns {Promise<number>} The current system volume.
     */
    static async getVolume(): Promise<number> {
        return invoke<number>('get_volume');
    }

    /**
     * Gets the names of all audio sessions.
     * @param {boolean} includeSystemFeatures - Whether or not to include system features.
     * @returns {Promise<string[]>} A promise that resolves with an array of session names.
     */
    async getAllSessionNames(includeSystemFeatures: boolean | undefined): Promise<string[]> {
        const systemFeatures = ['master', 'output', 'mic', 'system_sounds'];
        const result: string[] = await invoke('get_all_session_names');

        // Filter out system features
        if(!includeSystemFeatures) return result.filter((sessionName: string) => !systemFeatures.includes(sessionName));

        return result as string[];
    }

    /**
     * Gets the names of all audio devices (both input and output).
     * @returns {Promise<string[]>} A promise that resolves with an array of all device names.
     */
    async getAllDeviceNames(): Promise<string[]> {
        return invoke<string[]>('get_all_device_names');
    }

    /**
     * Gets the names of all output audio devices.
     * @returns {Promise<string[]>} A promise that resolves with an array of output device names.
     */
    async getOutputDeviceNames(): Promise<string[]> {
        return invoke<string[]>('get_output_device_names');
    }

    /**
     * Gets the names of all input audio devices.
     * @returns {Promise<string[]>} A promise that resolves with an array of input device names.
     */
    async getInputDeviceNames(): Promise<string[]> {
        return invoke<string[]>('get_input_device_names');
    }

    /**
     * Sets the volume for a specific application.
     * @param {string} name - The name of the application.
     * @param {number} volume - The volume level to set.
     */
    async setVolume(name: string, volume: number): Promise<void> {
        try {
            // Handle renamed "master" to "output" for backward compatibility
            const sessionName = name === 'output' ? 'master' : name;
            
            // debounce the volume change, max 1 change per 50ms to prevent audio glitches, unless volume is less than 1% (which is a mute)
            const currentTime = Date.now();
            if (this.lastSetVolumeApp === sessionName && (currentTime - this.lastSetVolumeExecutionTime < 50) && volume > 0.01) return;
            this.lastSetVolumeExecutionTime = currentTime;
            this.lastSetVolumeApp = sessionName;
            await invoke('set_application_volume', { name: sessionName, volume });
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Sets the volume for all applications in a specified channel.
     * @param {number} channel - The channel ID.
     * @param {number} volume - The volume level to set.
     */
    async setChannelVolume(channel: number, volume: number): Promise<void> {
        if(Number.isNaN(volume) || !volume) return;
        let apps: string[] | null = await SelectedApps.getApps(channel);
        if(!apps) return;
        
        // Check if output is selected and set volume for selected output devices
        if(apps.includes("output")) {
            const outputDevices = await SelectedApps.getOutputDevices(channel.toString());
            if(outputDevices && outputDevices.length > 0) {
                for(const device of outputDevices) {
                    await this.setVolume(device, volume);
                }
            } else {
                // If no specific output devices selected, default to master
                await this.setVolume("output", volume); // Use 'output' for consistency
            }
        }

        // Check if mic is selected and set volume/mute for selected input devices
        if(apps.includes("mic")) {
            const inputDevices = await SelectedApps.getInputDevices(channel.toString());
            if(inputDevices && inputDevices.length > 0) {
                for(const device of inputDevices) {
                    await this.setVolume(device, volume);
                }
            } else {
                // If no specific input devices selected, default to mic
                await this.setVolume("mic", volume);
            }
        }
        
        if(apps.includes("activeWindow")) {
            const currentActiveWindow = await this.getActiveWindowAppName();
            this.setVolume(currentActiveWindow, volume);
        }
        if(apps.includes("unmapped")) {
            //get all apps and remove the ones that are already mapped
            apps = await this.getAllSessionNames(false);
            //remove system features
            const mappedApps = await SelectedApps.getMappedApps();
            if(!mappedApps) return;
            apps = apps.filter((app) => !mappedApps.includes(app));
            const channelApps: string[] | null = await SelectedApps.getApps(channel);
            //add back the apps that are mapped to same channel
            if(channelApps) apps = [...apps, ...channelApps];
        }
        let sessionNames = await this.getAllSessionNames(true);
        apps = apps.map((str) => str.toLowerCase());

        for (const app of apps) {
            if (!app) continue;
            // Skip system features already handled above
            if (app === 'output' || app === 'mic') continue; 
            let session = sessionNames.find((session) => session.toLowerCase() === app);
            if (!session) continue;
            try {
                await this.setVolume(session, volume);
            } catch (e) {
                console.error(e);
            }
        }
    }


    async getActiveWindowAppName(): Promise<string> {
        const currentTime = Date.now();

        if (currentTime - this.lastActiveWindowExecutionTime >= 500) {
            const appName: any = await invoke('get_active_app_name');
            console.log('Active window:', appName);
            this.lastActiveWindowExecutionTime = currentTime;
            this.lastActiveWindowExecutionResult = appName;
            return appName;
        } else {
            return this.lastActiveWindowExecutionResult;
        }
    }

    /**
     * Mutes the system audio.
     */
    // static async mute(): Promise<void> {
    //     await invoke('mute');
    // }

    /**
     * Unmutes the system audio.
     */
    // static async unmute(): Promise<void> {
    //     await invoke('unmute');
    // }
}

export default new SystemVolumeController();

// Example usage:
// (async () => {
//     const currentVolume = await SystemVolumeController.getVolume();
//     console.log('Current system volume:', currentVolume);

//     await SystemVolumeController.setVolume('YourAppName', 50); // Set the volume to 50%
//     console.log('Volume set for YourAppName to 50%');

//     await SystemVolumeController.mute();
//     console.log('System muted');

//     await SystemVolumeController.unmute();
//     console.log('System unmuted');
// })();
