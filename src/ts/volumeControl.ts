import { invoke } from '@tauri-apps/api/tauri';
import SelectedApps from './appsToControl';
import ConfigStore from "../ts/config.ts";

/**
 * Class for controlling system volume and audio sessions.
 */
class SystemVolumeController {
    private lastActiveWindowExecutionTime: number;
    private lastActiveWindowExecutionResult: any;
    
    constructor() {
        this.lastActiveWindowExecutionTime = 0;
        this.lastActiveWindowExecutionResult = "";
    }

    /**
     * Gets the current system volume.
     * @returns {Promise<number>} The current system volume.
     */
    static async getVolume(): Promise<number> {
        return invoke<number>('get_volume');
    }

    /**
     *Gets the names of all audio sessions.
     * @param {boolean} includeSystemFeatures - Whether or not to include system features.
     * @returns {Promise<string[]>} A promise that resolves with an array of session names.
     */
    async getAllSessionNames(includeSystemFeatures: boolean | undefined): Promise<string[]> {
        const systemFeatures = ['master', 'mic', 'system_sounds'];
        const result: string[] = await invoke('get_all_session_names');

        // Filter out system features
        if(!includeSystemFeatures) return result.filter((sessionName: string) => !systemFeatures.includes(sessionName));

        return result as string[];
    }


    /**
     * Sets the volume for a specific application.
     * @param {string} name - The name of the application.
     * @param {number} volume - The volume level to set.
     */
    async setVolume(name: string, volume: number): Promise<void> {
        await invoke('set_application_volume', { name, volume });
    }

    /**
     * Sets the volume for all applications in a specified channel.
     * @param {number} channel - The channel ID.
     * @param {number} volume - The volume level to set.
     */
    async setChannelVolume(channel: number, volume: number): Promise<void> {
        if(await ConfigStore.get("midiEnabled")) return;
        if(Number.isNaN(volume) || !volume) return;
        let apps: string[] | null = await SelectedApps.getApps(channel);
        if(!apps) return;
        const currentActiveWindow = await this.getActiveWindowName();
        console.log("Current active window:", currentActiveWindow);
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

        for (const session of sessionNames) {
            if (!session) continue;
            let app = session.toLowerCase();
            if (!apps.includes(app)) continue;
            try {
                await this.setVolume(session, volume);
            } catch (e) {
                console.error(e);
            }
        }
    }


    async getActiveWindowName(): Promise<string> {
        const currentTime = Date.now();

        if (currentTime - this.lastActiveWindowExecutionTime >= 500) {
            const appName: any = invoke('get_active_app_name');
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
