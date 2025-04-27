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
    private brightnessTimeoutId: NodeJS.Timeout | null = null;
    private latestBrightnessValue: number;

    constructor() {
        this.lastActiveWindowExecutionTime = 0;
        this.lastActiveWindowExecutionResult = "";
        this.lastSetVolumeExecutionTime = 0;
        this.lastSetVolumeApp = "";
        this.brightnessTimeoutId = null;
        this.latestBrightnessValue = 0;
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
    async getAllDevices(): Promise<string[]> {
        const result = await invoke<string[]>('get_all_audio_devices');
        return result;
    }

    /**
     * Gets the names of all output audio devices.
     * @returns {Promise<string[]>} A promise that resolves with an array of output device names.
     */
    async getOutputDevices(): Promise<string[]> {
        const result = await invoke<string[]>('get_output_devices');
        return result;
    }

    /**
     * Gets the names of all input audio devices.
     * @returns {Promise<string[]>} A promise that resolves with an array of input device names.
     */
    async getInputDevices(): Promise<string[]> {
        const result = await invoke<string[]>('get_input_devices');
        return result;
    }

    /**
     * Sets the volume for a specific application.
     * @param {string} name - The name of the application.
     * @param {number} volume - The volume level to set.
     */
    async setVolume(name: string, volume: number): Promise<void> {
        try {
            // Handle renamed "master" to "output" for backward compatibility
            const sessionName = name;
            
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
        if (apps.includes("screen brightness")) {
            const currentTime = Date.now();
        
            // Store the latest brightness value
            this.latestBrightnessValue = volume;
        
            // If the throttling interval has passed, send the brightness value immediately
            if (currentTime - this.lastSetVolumeExecutionTime >= 500) {
                this.lastSetVolumeExecutionTime = currentTime;
                await invoke('set_screen_brightness', { brightness: this.latestBrightnessValue, screens: ["all"] });
            }
        
            // Clear the previous timeout if it exists
            if (this.brightnessTimeoutId) {
                clearTimeout(this.brightnessTimeoutId);
            }
        
            // Schedule the last value to be sent after the throttling interval
            this.brightnessTimeoutId = setTimeout(async () => {
                this.lastSetVolumeExecutionTime = Date.now();
                await invoke('set_screen_brightness', { brightness: this.latestBrightnessValue, screens: ["all"] });
            }, 500 - (currentTime - this.lastSetVolumeExecutionTime));
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
