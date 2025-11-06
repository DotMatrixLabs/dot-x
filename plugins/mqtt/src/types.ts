/**
 * MQTT connection settings interface
 */
export interface MQTTSettings {
  // Connection
  brokerIP: string;
  brokerPort: number;
  topicPrefix: string;
  
  // Authentication
  username: string;
  password: string;
  clientId: string;
  
  // Advanced
  useSsl: boolean;
  keepalive: number;
  qos: 0 | 1 | 2;
  cleanSession: boolean;
  autoReconnect: boolean;
  reconnectInterval: number;
  publishRateLimit: number;
  
  // Home Assistant
  homeAssistantEnabled: boolean;
  
  // Connection behavior
  autoConnect: boolean;
}

/**
 * MQTT connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Channel selection tracking
 */
export interface ChannelSelection {
  [channelIndex: number]: boolean;
}

/**
 * Home Assistant sensor configuration
 */
export interface HASensorConfig {
  name: string;
  unique_id: string;
  state_topic: string;
  unit_of_measurement: string;
  value_template: string;
  device: {
    identifiers: string[];
    name: string;
    manufacturer: string;
    model: string;
  };
}

/**
 * Device update data from device.onUpdate
 */
export interface DeviceUpdateData {
  changes: Array<{
    index: number;
    oldValue: number;
    newValue: number;
  }>;
  values: Array<{ value: number }>;
}

