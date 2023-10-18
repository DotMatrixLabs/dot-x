import { invoke } from '@tauri-apps/api/tauri';

class SystemVolumeController {
    static async getVolume(): Promise<number> {
        return invoke<number>('get_volume');
    }

    async getAllSessionNames(): Promise<void> {
        const result = await invoke('get_all_session_names');
        return result;
    }

    async setVolume(name: string, volume: number): Promise<void> {
        await invoke('set_application_volume', { name, volume });
    }

    static async mute(): Promise<void> {
        await invoke('mute');
    }

    static async unmute(): Promise<void> {
        await invoke('unmute');
    }
}

export default new SystemVolumeController();

// Example usage:
// (async () => {
//     const currentVolume = await SystemVolumeController.getVolume();
//     console.log('Current system volume:', currentVolume);

//     await SystemVolumeController.setVolume(50); // Set the volume to 50%
//     console.log('Volume set to 50%');

//     await SystemVolumeController.mute();
//     console.log('System muted');

//     await SystemVolumeController.unmute();
//     console.log('System unmuted');
// })();
