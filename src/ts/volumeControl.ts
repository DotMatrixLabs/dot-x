import { invoke } from '@tauri-apps/api/core';
import SelectedApps from './appsToControl';
import { useDeckerStore } from '../store/deckerStore';
import { excludeMappedApps } from './mappingUtils';
import { createLogger } from './logger.ts';

const log = createLogger('volume');

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
    private rgbBrightnessTimeoutId: NodeJS.Timeout | null = null;
    private latestRGBBrightnessValue: number;
    private lastRGBBrightnessExecutionTime: number;

    constructor() {
        this.lastActiveWindowExecutionTime = 0;
        this.lastActiveWindowExecutionResult = "";
        this.lastSetVolumeExecutionTime = 0;
        this.lastSetVolumeApp = "";
        this.brightnessTimeoutId = null;
        this.latestBrightnessValue = 0;
        this.rgbBrightnessTimeoutId = null;
        this.latestRGBBrightnessValue = 0;
        this.lastRGBBrightnessExecutionTime = 0;
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
        const systemFeatures = ['master', 'output', 'input', 'mic', 'system_sounds'];
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
            // debounce the volume change, max 1 change per 50ms to prevent audio glitches, unless volume is less than 1% (which is a mute)
            const currentTime = Date.now();
            if (this.lastSetVolumeApp === name && (currentTime - this.lastSetVolumeExecutionTime < 50) && volume > 0.01) return;
            this.lastSetVolumeExecutionTime = currentTime;
            this.lastSetVolumeApp = name;
            // set_application_volume records the sync target itself, before applying the
            // volume. Doing it again from here would let an older overlapping slider update
            // land after a newer one and pin the session to a stale target.
            await invoke('set_application_volume', { name, volume });
        } catch (error) {
            log.error('Failed to set application volume', error);
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
            const systemFeatures = ['master', 'output', 'input', 'mic'];
            // Read the persisted source of truth. The Pinia mirror can lag behind a toggle after
            // selectedApps.json has already been updated, briefly making a mapped app look free.
            let mappedApps: string[] | null;
            try {
                mappedApps = await SelectedApps.getMappedApps();
            } catch (error) {
                log.error("Skipping unmapped channel, mapped apps unavailable", error);
                return;
            }
            if(!mappedApps) return;
            //remove system features
            apps = apps.filter((app) => !systemFeatures.includes(app));
            //remove input and output devices
            apps = apps.filter((app) => !app.toLowerCase().startsWith("input: ") && !app.toLowerCase().startsWith("output: "));
            //remove mapped apps
            apps = excludeMappedApps(apps, mappedApps);
            const channelApps: string[] | null = await SelectedApps.getApps(channel);
            //add back the apps that are mapped to same channel
            if(channelApps) apps = [...apps, ...channelApps];
        }
        let sessionNames = await this.getAllSessionNames(true);
        apps = apps.map((str) => str.toLowerCase());

        for (const app of apps) {
            if (!app) continue;
            let session = sessionNames.find((session) => session.toLowerCase() === app);
            if (!session) continue;
            try {
                await this.setVolume(session, volume);
            } catch (e) {
                log.error('Failed to set channel volume', e);
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

        if (apps.includes("device brightness")) {
            const currentTime = Date.now();
            const deckerStore = useDeckerStore();
        
            // Store the latest RGB brightness value
            this.latestRGBBrightnessValue = volume;
        
            // If the throttling interval has passed, send the RGB brightness value immediately
            if (currentTime - this.lastRGBBrightnessExecutionTime >= 100) {
                this.lastRGBBrightnessExecutionTime = currentTime;
                await this.setRGBBrightness(this.latestRGBBrightnessValue);
                await deckerStore.setBrightness(Math.round(volume * 100));
            }
        
            // Clear the previous timeout if it exists
            if (this.rgbBrightnessTimeoutId) {
                clearTimeout(this.rgbBrightnessTimeoutId);
            }
        
            // Schedule the last value to be sent after the throttling interval
            this.rgbBrightnessTimeoutId = setTimeout(async () => {
                this.lastRGBBrightnessExecutionTime = Date.now();
                await this.setRGBBrightness(this.latestRGBBrightnessValue);
                await deckerStore.setBrightness(Math.round(this.latestRGBBrightnessValue * 100));
            }, 100 - (currentTime - this.lastRGBBrightnessExecutionTime));
        }
    }

    private async setRGBBrightness(volume: number): Promise<void> {
        // Convert volume (0-1) to brightness (0-255)
        const brightness = parseInt((volume * 255).toString());
        
        // Send brightness command directly to device
        await invoke('send_decker_command', { command: 'rgb-control', options: { brightness } });
    }


    async getActiveWindowAppName(): Promise<string> {
        const currentTime = Date.now();
    
        if (currentTime - this.lastActiveWindowExecutionTime >= 500) {
            try {
                const appName: any = await invoke('get_active_app_name');
                this.lastActiveWindowExecutionTime = currentTime;
                this.lastActiveWindowExecutionResult = appName;
                return appName;
            } catch (error) {
                log.error('Failed to get active window app name:', error);
                // Return the last cached result or a default value
                return this.lastActiveWindowExecutionResult || "Unknown";
            }
        } else {
            return this.lastActiveWindowExecutionResult;
        }
    }
}

export default new SystemVolumeController();
