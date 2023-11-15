import { invoke } from '@tauri-apps/api/tauri';
import SelectedApps from './appsToControl';

/**
 * Class for controlling system volume and audio sessions.
 */
class SystemVolumeController {
    /**
     * Gets the current system volume.
     * @returns {Promise<number>} The current system volume.
     */
    static async getVolume(): Promise<number> {
        return invoke<number>('get_volume');
    }

    /**
     *Gets the names of all audio sessions.
     * @returns {Promise<string[]>} A promise that resolves with an array of session names.
     */
    async getAllSessionNames(): Promise<string[]> {
        const result = await invoke('get_all_session_names');
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
        if(Number.isNaN(volume) || !volume) return;
        let apps: string[] | null = await SelectedApps.getApps(channel);
        if(!apps) return;
        if(apps.includes("unmapped")) {
            //get all apps and remove the ones that are already mapped
            apps = await this.getAllSessionNames();
            //remove master
            apps = apps.filter((app) => app !== "master");
            const mappedApps = await SelectedApps.getMappedApps();
            if(!mappedApps) return;
            apps = apps.filter((app) => !mappedApps.includes(app));
            const channelApps: string[] | null = await SelectedApps.getApps(channel);
            //add back the apps that are mapped to same channel
            if(channelApps) apps = [...apps, ...channelApps];
        }

        let sessionNames = await this.getAllSessionNames();
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
