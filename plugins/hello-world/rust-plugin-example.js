const WebSocket = require('ws');

class HelloWorldPlugin {
    constructor() {
        this.pluginId = 'hello-world';
        this.pluginInfo = {
            id: this.pluginId,
            name: 'Hello World Plugin',
            version: '1.0.0',
            connected_at: new Date().toISOString()
        };
        this.ws = null;
        this.isConnected = false;
    }

    async connect(serverUrl = 'ws://127.0.0.1:3001') {
        try {
            console.log(`Connecting to plugin server at ${serverUrl}...`);
            
            this.ws = new WebSocket(serverUrl);
            
            this.ws.on('open', () => {
                console.log('Connected to plugin server');
                this.isConnected = true;
                this.register();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('Disconnected from plugin server');
                this.isConnected = false;
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connect(serverUrl);
                    }
                }, 5000);
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

        } catch (error) {
            console.error('Error connecting to plugin server:', error);
        }
    }

    register() {
        const registerMessage = {
            plugin_id: this.pluginId,
            message_type: 'register',
            data: this.pluginInfo
        };
        
        this.sendMessage(registerMessage);
        console.log('Registration message sent');
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.message_type) {
            case 'register_ack':
                console.log('Registration acknowledged:', message.data);
                this.onRegistered();
                break;
            case 'api_response':
                console.log('API response:', message.data);
                break;
            case 'button_press':
                console.log('Button pressed:', message.data);
                this.handleButtonPress(message.data);
                break;
            case 'input_change':
                console.log('Input changed:', message.data);
                this.handleInputChange(message.data);
                break;
            default:
                console.log('Unknown message type:', message.message_type);
        }
    }

    onRegistered() {
        console.log('Plugin registered successfully');
        
        // Add a button to the settings UI
        this.addSettingsButton();
        
        // Add an input to the settings UI
        this.addSettingsInput();
        
        // Show a notification
        this.showNotification('Hello World Plugin connected!');
    }

    addSettingsButton() {
        const apiRequest = {
            plugin_id: this.pluginId,
            message_type: 'api_request',
            data: {
                id: this.generateRequestId(),
                method: 'settings.addButton',
                params: {
                    title: 'Hello World Button',
                    icon: 'fas fa-hand-wave'
                }
            }
        };
        
        this.sendMessage(apiRequest);
    }

    addSettingsInput() {
        const apiRequest = {
            plugin_id: this.pluginId,
            message_type: 'api_request',
            data: {
                id: this.generateRequestId(),
                method: 'settings.addInput',
                params: {
                    label: 'Your Name',
                    type: 'text'
                }
            }
        };
        
        this.sendMessage(apiRequest);
    }

    showNotification(message) {
        const apiRequest = {
            plugin_id: this.pluginId,
            message_type: 'api_request',
            data: {
                id: this.generateRequestId(),
                method: 'ui.showNotification',
                params: {
                    message: message
                }
            }
        };
        
        this.sendMessage(apiRequest);
    }

    handleButtonPress(data) {
        const { buttonId } = data;
        console.log(`Button ${buttonId} was pressed!`);
        
        // Show a notification when button is pressed
        this.showNotification('Hello World Button was pressed!');
    }

    handleInputChange(data) {
        const { inputId, value } = data;
        console.log(`Input ${inputId} changed to: ${value}`);
        
        // Show a notification with the input value
        this.showNotification(`Hello ${value || 'World'}!`);
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
        }
    }
}

// Usage example
const plugin = new HelloWorldPlugin();

// Connect to the plugin server
plugin.connect('ws://127.0.0.1:3001');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down plugin...');
    plugin.disconnect();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down plugin...');
    plugin.disconnect();
    process.exit(0);
});

module.exports = HelloWorldPlugin; 