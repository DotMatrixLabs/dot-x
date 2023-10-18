import { invoke } from '@tauri-apps/api/tauri';
import SelectedApps from './appsToControl';
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

    async setChannelVolume(channel: number, volume: number): Promise<void> {
        let apps: string[] = await SelectedApps.getApps(channel);
        let sessionNames = await this.getAllSessionNames();
        console.log('Session names:', sessionNames);
        console.log('Apps:', apps);
        if(!apps) return;
        apps = apps.map((str) => str.toLowerCase());
        for(const session of sessionNames){
            if(!session) continue;
            let app = session.toLowerCase();
            console.log(app)
            console.log(apps)
            console.log(apps.includes(app))
            if(!apps.includes(app)) continue;
            console.log('Setting volume for', session)
            console.log('Setting volume for', app)

            try {
                await this.setVolume(session, volume);
            } catch (e) {
                console.error(e);
            }
        }
    
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
