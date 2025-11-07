import Plugin, { runPlugin } from "../../plugin-sdk/src/index";
import { MQTTClient } from "./src/mqtt-client";
import { HomeAssistantDiscovery } from "./src/homeassistant";
import { buildSettingsUI } from "./src/settings";
import { MQTTSettings, ConnectionState, DeviceUpdateData } from "./src/types";

export default class MQTTPlugin extends Plugin {
  private settings!: MQTTSettings;
  private mqttClient!: MQTTClient;
  private haDiscovery!: HomeAssistantDiscovery;
  private channelButton: any; // SystemUtilButton handle
  private connectionState: ConnectionState = 'disconnected';
  private settingsUIUpdateFn?: (state: ConnectionState) => void;

  async onLoad() {
    console.log("[MQTT Plugin] Loading...");
    
    // Initialize config
    this.initConfig();
    this.loadSettings();
    
    // Initialize MQTT client
    this.mqttClient = new MQTTClient(this.settings);
    
    // Initialize Home Assistant discovery
    this.haDiscovery = new HomeAssistantDiscovery(
      this.mqttClient,
      this.settings.topicPrefix,
      'DotX Device',
      'dotx_device'
    );
    
    // Set up connection state callback
    this.mqttClient.onConnectionChange((state, error) => {
      this.connectionState = state;
      console.log(`[MQTT Plugin] Connection state: ${state}`, error || '');
      
      // Update UI
      if (this.settingsUIUpdateFn) {
        this.settingsUIUpdateFn(state);
      }
      
      // Show toast notifications
      if (state === 'connected') {
        this.ui.showToast({
          message: 'Connected to MQTT broker',
          type: 'success',
          duration: 3000
        });
        
        // Publish HA discovery if enabled
        if (this.settings.homeAssistantEnabled) {
          this.publishHomeAssistantDiscovery();
        }
      } else if (state === 'disconnected') {
        this.ui.showToast({
          message: 'Disconnected from MQTT broker',
          type: 'info',
          duration: 3000
        });
      } else if (state === 'error') {
        this.ui.showToast({
          message: `MQTT connection error: ${error || 'Unknown error'}`,
          type: 'error',
          duration: 5000
        });
      }
    });
    
    // Build settings UI
    await this.settingsPage.addSettings((settings) => {
      const ui = buildSettingsUI(
        settings,
        this.settings,
        this.connectionState,
        (newSettings) => this.handleSaveSettings(newSettings),
        () => this.handleConnect(),
        () => this.handleDisconnect()
      );
      
      // Store update function for later use
      this.settingsUIUpdateFn = ui.updateConnectionState;
    });
    
    // Add system utility button for channel selection
    this.channelButton = this.actionmapper
      .addSystemUtilButton('mqttChannelSelect')
      .setTitle('MQTT Channels')
      .setIcon('fas fa-lg fa-network-wired')
      .onClick(({ selected, channel }) => {
        console.log(`[MQTT Plugin] Channel ${channel} ${selected ? 'selected' : 'deselected'}`);
        
        // Only work if in button mode
        if (this.settings.channelSelectionMode !== 'button') {
          this.ui.showToast({
            message: 'Channel selection is disabled. Enable "Use System Util Button" in settings.',
            type: 'warning',
            duration: 3000
          });
          return;
        }
        
        // Get current selected channels using built-in method
        const selectedMap = this.channelButton.getSelectedMap();
        const selectedList = Object.keys(selectedMap)
          .filter(k => selectedMap[k])
          .map(k => parseInt(k));
        
        console.log(`[MQTT Plugin] Selected channels:`, selectedList);
        
        // Show toast with current selection
        if (selectedList.length > 0) {
          this.ui.showToast({
            message: `Selected channels: ${selectedList.join(', ')}`,
            type: 'info',
            duration: 2000
          });
        } else {
          this.ui.showToast({
            message: 'No channels selected',
            type: 'info',
            duration: 2000
          });
        }
      });
    
    // Add settings to the button (required for it to be visible/functional)
    this.channelButton.addSettings((settings) => {
      settings.addSection('info').setName('Channel Selection');
      settings.addText('buttonInfo')
        .setLabel('Usage')
        .setText('Click this button on channels you want to publish to MQTT. Selected channels will be highlighted.')
        .setStyle('info');
      
      settings.addText('currentMode')
        .setLabel('Current Mode')
        .setText(this.settings.channelSelectionMode === 'button' 
          ? 'Button mode is ACTIVE' 
          : 'Button mode is DISABLED - Enable in plugin settings')
        .setStyle(this.settings.channelSelectionMode === 'button' ? 'success' : 'warning');
    });
    
    // Listen for device updates
    this.device.onUpdate((data) => {
      this.handleDeviceUpdate(data);
    });
    
    // Auto-connect if enabled
    if (this.settings.autoConnect) {
      console.log("[MQTT Plugin] Auto-connecting...");
      setTimeout(() => {
        this.handleConnect();
      }, 1000);
    }
    
    console.log("[MQTT Plugin] Loaded successfully!");
  }

  /**
   * Handle device slider updates
   */
  private async handleDeviceUpdate(data: DeviceUpdateData) {
    // Only process if connected
    if (!this.mqttClient.isConnected()) {
      return;
    }
    
    // Process each change
    for (const change of data.changes) {
      const channelIndex = change.index;
      const value = change.newValue;
      
      // Check channel selection mode
      if (this.settings.channelSelectionMode === 'button') {
        // In button mode, only publish selected channels
        // Use built-in isSelected method
        if (!this.channelButton.isSelected(channelIndex)) {
          continue; // Skip unselected channels
        }
      }
      // In 'all' mode, publish everything (no filtering needed)
      
      try {
        // Publish to MQTT
        if (this.settings.homeAssistantEnabled) {
          // Use Home Assistant discovery
          await this.haDiscovery.publishState(channelIndex, value);
        } else {
          // Standard MQTT publish
          const topic = `${this.settings.topicPrefix}/channel/${channelIndex}`;
          const payload = JSON.stringify({ value: value.toFixed(2) });
          await this.mqttClient.publish(topic, payload);
        }
      } catch (error) {
        console.error(`[MQTT Plugin] Error publishing channel ${channelIndex}:`, error);
      }
    }
  }

  /**
   * Handle save settings button click
   */
  private handleSaveSettings(newSettings: MQTTSettings) {
    console.log("[MQTT Plugin] Saving settings...");
    
    // Update settings
    this.settings = newSettings;
    this.config.set('settings', this.settings);
    
    // Update MQTT client settings
    this.mqttClient.updateSettings(this.settings);
    
    // Update HA discovery topic prefix
    this.haDiscovery.updateTopicPrefix(this.settings.topicPrefix);
    
    this.ui.showToast({
      message: 'Settings saved successfully',
      type: 'success',
      duration: 3000
    });
  }

  /**
   * Handle connect button click
   */
  private async handleConnect() {
    console.log("[MQTT Plugin] Connecting to MQTT broker...");
    
    try {
      await this.mqttClient.connect();
    } catch (error) {
      console.error("[MQTT Plugin] Connection failed:", error);
      // Toast is shown by connection state callback
    }
  }

  /**
   * Handle disconnect button click
   */
  private async handleDisconnect() {
    console.log("[MQTT Plugin] Disconnecting from MQTT broker...");
    
    try {
      // Remove HA discovery if enabled
      if (this.settings.homeAssistantEnabled) {
        await this.haDiscovery.removeAllDiscoveries();
      }
      
      await this.mqttClient.disconnect();
    } catch (error) {
      console.error("[MQTT Plugin] Disconnect failed:", error);
    }
  }

  /**
   * Publish Home Assistant discovery for all channels
   */
  private async publishHomeAssistantDiscovery() {
    console.log("[MQTT Plugin] Publishing Home Assistant discovery...");
    
    try {
      // Publish discovery for channels 0-7 (assuming 8 channels)
      // You can adjust this based on device capabilities
      const channels = Array.from({ length: 8 }, (_, i) => i);
      await this.haDiscovery.publishDiscoveryForChannels(channels);
      
      console.log("[MQTT Plugin] Home Assistant discovery published");
    } catch (error) {
      console.error("[MQTT Plugin] Error publishing HA discovery:", error);
    }
  }

  /**
   * Load settings from config
   */
  private loadSettings() {
    const savedSettings = this.config.get('settings');
    
    // Generate random client ID if not set
    const clientId = savedSettings?.clientId || `dotx-mqtt-${Math.random().toString(36).substr(2, 9)}`;
    
    this.settings = {
      brokerIP: savedSettings?.brokerIP || '192.168.1.100',
      brokerPort: savedSettings?.brokerPort || 1883,
      topicPrefix: savedSettings?.topicPrefix || 'dotx',
      username: savedSettings?.username || '',
      password: savedSettings?.password || '',
      clientId: clientId,
      useSsl: savedSettings?.useSsl || false,
      keepalive: savedSettings?.keepalive || 60,
      qos: savedSettings?.qos || 0,
      cleanSession: savedSettings?.cleanSession !== false,
      autoReconnect: savedSettings?.autoReconnect !== false,
      reconnectInterval: savedSettings?.reconnectInterval || 5,
      publishRateLimit: savedSettings?.publishRateLimit || 100,
      homeAssistantEnabled: savedSettings?.homeAssistantEnabled || false,
      channelSelectionMode: savedSettings?.channelSelectionMode || 'all',
      autoConnect: savedSettings?.autoConnect || false
    };
  }

  /**
   * Initialize config schema
   */
  private initConfig() {
    this.config.init({
      schema: {
        settings: {
          type: "object",
          properties: {
            brokerIP: {
              type: "string",
              default: "192.168.1.100",
              description: "MQTT broker IP address"
            },
            brokerPort: {
              type: "number",
              default: 1883,
              description: "MQTT broker port"
            },
            topicPrefix: {
              type: "string",
              default: "dotx",
              description: "Base topic prefix"
            },
            username: {
              type: "string",
              default: "",
              description: "MQTT username"
            },
            password: {
              type: "string",
              default: "",
              description: "MQTT password"
            },
            clientId: {
              type: "string",
              default: "",
              description: "MQTT client ID"
            },
            useSsl: {
              type: "boolean",
              default: false,
              description: "Use SSL/TLS"
            },
            keepalive: {
              type: "number",
              default: 60,
              description: "Keepalive interval in seconds"
            },
            qos: {
              type: "number",
              default: 0,
              description: "Quality of Service level"
            },
            cleanSession: {
              type: "boolean",
              default: true,
              description: "Clean session flag"
            },
            autoReconnect: {
              type: "boolean",
              default: true,
              description: "Auto reconnect on connection loss"
            },
            reconnectInterval: {
              type: "number",
              default: 5,
              description: "Reconnect interval in seconds"
            },
            publishRateLimit: {
              type: "number",
              default: 100,
              description: "Publish rate limit in milliseconds"
            },
            homeAssistantEnabled: {
              type: "boolean",
              default: false,
              description: "Enable Home Assistant discovery"
            },
            channelSelectionMode: {
              type: "string",
              default: "all",
              description: "Channel selection mode: all or button"
            },
            autoConnect: {
              type: "boolean",
              default: false,
              description: "Auto connect on startup"
            }
          }
        }
      }
    });
  }

  async onUnload() {
    console.log("[MQTT Plugin] Unloading...");
    
    try {
      // Remove HA discovery if enabled
      if (this.settings.homeAssistantEnabled && this.mqttClient.isConnected()) {
        await this.haDiscovery.removeAllDiscoveries();
      }
      
      // Disconnect from MQTT
      await this.mqttClient.disconnect();
    } catch (error) {
      console.error("[MQTT Plugin] Error during unload:", error);
    }
    
    console.log("[MQTT Plugin] Unloaded");
  }
}

// Run the plugin when executed directly
if (require.main === module) {
  runPlugin(MQTTPlugin);
}

