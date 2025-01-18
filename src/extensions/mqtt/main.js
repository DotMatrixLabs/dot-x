import { invoke } from '@tauri-apps/api/tauri';
import extensionStore from '../../ts/extensions';

class MQTTHandler {
    async init() {
        const config = await extensionStore.getAllValues('mqtt-config.json');
        try {
            await invoke('init_mqtt', { config });
        } catch (error) {
            console.error('Failed to initialize MQTT:', error);
        }
    }

    async updateSliderValues(values) {
        await invoke('mqtt_publish_values', { values });
    }

    async disconnect() {
        await invoke('mqtt_disconnect');
    }
}

// Create and export a singleton instance
const mqttHandler = new MQTTHandler();

// Export the public methods
export function init() {
    return mqttHandler.init();
}

export function updateSliderValues(values) {
    return mqttHandler.updateSliderValues(values);
}

export function disconnect() {
    return mqttHandler.disconnect();
}
