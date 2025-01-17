import * as mqtt from 'mqtt';
import extensionStore from '../../ts/extensions';

class MQTTHandler {
    constructor() {
        this.client = null;
        this.config = null;
        this.connected = false;
        this.deviceInfo = {
            identifiers: ["dotMatrixLabs_dot_x"],
            manufacturer: "DotMatrixLabs",
            model: "Dot X",
            name: "Dot X",
            sw_version: "0.0.1",
        };
    }

    async init() {
        try {
            this.config = await extensionStore.getAllValues('mqtt-config.json');
            if (!this.config) {
                console.error('MQTT configuration not found');
                return;
            }

            const brokerUrl = `mqtt://${this.config.brokerIp}:${this.config.brokerPort}`;
            const options = {
                clientId: this.config.clientId || `dot_x_${Math.random().toString(16).slice(2, 8)}`,
                username: this.config.username,
                password: this.config.password,
                clean: true,
            };

            this.client = mqtt.connect(brokerUrl, options);

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker');
                this.connected = true;
                this.client.publish('dot_x/status', 'online', { retain: true });
                
                if (this.config.enableHaDiscovery) {
                    this.setupHomeAssistantDiscovery();
                }
            });

            this.client.on('error', (error) => {
                console.error('MQTT error:', error);
                this.connected = false;
            });

            this.client.on('close', () => {
                console.log('MQTT connection closed');
                this.connected = false;
            });
        } catch (error) {
            console.error('Failed to initialize MQTT:', error);
        }
    }

    setupHomeAssistantDiscovery() {
        const baseTopic = this.config.haDiscoveryPrefix || 'homeassistant';
        const deviceId = 'dot_x_slider_values';

        // Discovery for slider values
        const discoveryTopic = `${baseTopic}/sensor/${deviceId}/config`;
        const discoveryPayload = {
            name: "Dot X Slider Values",
            state_topic: `${this.config.topic}/slider_values`,
            device: this.deviceInfo,
            availability: [{
                topic: "dot_x/status",
            }],
            enabled_by_default: true,
            object_id: deviceId,
            unique_id: deviceId,
            json_attributes_topic: `${this.config.topic}/slider_values`,
        };

        this.client.publish(discoveryTopic, JSON.stringify(discoveryPayload), { retain: true });
    }

    updateSliderValues(values) {
        if (!this.connected || !this.client) {
            console.warn('MQTT not connected, cannot send slider values');
            return;
        }

        try {
            // Send the raw values
            const topic = `${this.config.topic}/slider_values`;
            this.client.publish(topic, JSON.stringify(values), { retain: true });

            // You might want to also send individual values for better HA integration
            Object.entries(values).forEach(([key, value]) => {
                const individualTopic = `${this.config.topic}/slider_values/${key}`;
                this.client.publish(individualTopic, value.toString(), { retain: true });
            });
        } catch (error) {
            console.error('Failed to publish slider values:', error);
        }
    }

    disconnect() {
        if (this.client) {
            this.client.publish('dot_x/status', 'offline', { retain: true });
            this.client.end();
            this.connected = false;
        }
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
