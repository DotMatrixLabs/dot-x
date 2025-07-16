# Plugin API System

A robust plugin system for the Dot X application that enables external plugins to connect and interact with the main application through a WebSocket-based architecture.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│   Frontend      │───▶│  Rust WebSocket  │◀───│  Plugin 1   │
│   (Vue.js)      │    │     Server       │    │ (Client)    │
│                 │    │   (Tauri Rust)   │◀───│  Plugin 2   │
└─────────────────┘    └──────────────────┘    └─────────────┘
```

- **Frontend**: Vue.js application communicates with Rust server via Tauri invoke/listen
- **Rust Server**: WebSocket server running in Tauri backend (port 3001)
- **Plugins**: External Node.js/JavaScript clients connecting via WebSocket

## Getting Started

### Frontend Usage

#### 1. Initialize the Plugin Server

```typescript
import { pluginAPIServer } from './plugin-api/server';

// Initialize the plugin server
await pluginAPIServer.initialize();
```

#### 2. Listen for Plugin Events

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for plugin connections
await listen('plugin/connected', (event) => {
  const { pluginId, info } = event.payload;
  console.log(`Plugin connected: ${pluginId}`, info);
});

// Listen for plugin disconnections
await listen('plugin/disconnected', (event) => {
  const { pluginId } = event.payload;
  console.log(`Plugin disconnected: ${pluginId}`);
});

// Listen for UI elements added by plugins
await listen('plugin/settings/addButton', (event) => {
  const buttonElement = event.payload;
  // Add button to your settings UI
});

await listen('plugin/settings/addInput', (event) => {
  const inputElement = event.payload;
  // Add input to your settings UI
});
```

#### 3. Get Plugin Information

```typescript
// Get all connected plugins
const plugins = await pluginAPIServer.getConnectedPlugins();

// Get all UI elements created by plugins
const uiElements = await pluginAPIServer.getUIElements();

// Check if server is running
const isRunning = pluginAPIServer.isServerRunning();
```

#### 4. Interact with Plugins

```typescript
// Trigger button press (when user clicks a plugin button)
await pluginAPIServer.triggerButtonPress('button_123456789');

// Update input value (when user changes a plugin input)
await pluginAPIServer.updateInputValue('input_123456789', 'new value');

// Get current input value
const currentValue = pluginAPIServer.getInputValue('input_123456789');
```

### Plugin Development

#### 1. Create a Plugin

```javascript
const WebSocket = require('ws');

class MyPlugin {
    constructor() {
        this.pluginId = 'my-plugin';
        this.pluginInfo = {
            id: this.pluginId,
            name: 'My Awesome Plugin',
            version: '1.0.0',
            connected_at: new Date().toISOString()
        };
        this.ws = null;
        this.isConnected = false;
    }

    async connect(serverUrl = 'ws://127.0.0.1:3001') {
        this.ws = new WebSocket(serverUrl);
        
        this.ws.on('open', () => {
            console.log('Connected to plugin server');
            this.isConnected = true;
            this.register();
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
        });

        this.ws.on('close', () => {
            console.log('Disconnected from plugin server');
            this.isConnected = false;
        });
    }

    register() {
        const registerMessage = {
            plugin_id: this.pluginId,
            message_type: 'register',
            data: this.pluginInfo
        };
        
        this.sendMessage(registerMessage);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(message) {
        switch (message.message_type) {
            case 'register_ack':
                this.onRegistered();
                break;
            case 'button_press':
                this.handleButtonPress(message.data);
                break;
            case 'input_change':
                this.handleInputChange(message.data);
                break;
        }
    }

    onRegistered() {
        console.log('Plugin registered successfully');
        
        // Add UI elements and show notifications
        this.addSettingsButton();
        this.showNotification('Plugin connected!');
    }

    // ... rest of implementation
}
```

#### 2. Plugin API Methods

##### Add Settings Button

```javascript
addSettingsButton() {
    const apiRequest = {
        plugin_id: this.pluginId,
        message_type: 'api_request',
        data: {
            id: this.generateRequestId(),
            method: 'settings.addButton',
            params: {
                title: 'My Button',
                icon: 'fas fa-star'
            }
        }
    };
    
    this.sendMessage(apiRequest);
}
```

##### Add Settings Input

```javascript
addSettingsInput() {
    const apiRequest = {
        plugin_id: this.pluginId,
        message_type: 'api_request',
        data: {
            id: this.generateRequestId(),
            method: 'settings.addInput',
            params: {
                label: 'Configuration Value',
                type: 'text' // 'text', 'password', 'number'
            }
        }
    };
    
    this.sendMessage(apiRequest);
}
```

##### Show Notification

```javascript
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
```

##### Open Modal

```javascript
openModal(content) {
    const apiRequest = {
        plugin_id: this.pluginId,
        message_type: 'api_request',
        data: {
            id: this.generateRequestId(),
            method: 'ui.openModal',
            params: {
                content: content
            }
        }
    };
    
    this.sendMessage(apiRequest);
}
```

#### 3. Handle Events from Frontend

```javascript
handleButtonPress(data) {
    const { buttonId } = data;
    console.log(`Button ${buttonId} was pressed!`);
    
    // React to button press
    this.showNotification('Button was pressed!');
}

handleInputChange(data) {
    const { inputId, value } = data;
    console.log(`Input ${inputId} changed to: ${value}`);
    
    // React to input change
    this.processInputValue(value);
}
```

## Message Protocol

### Registration

When a plugin connects, it must register with the server:

```json
{
    "plugin_id": "my-plugin",
    "message_type": "register",
    "data": {
        "id": "my-plugin",
        "name": "My Plugin",
        "version": "1.0.0",
        "connected_at": "2024-01-01T00:00:00.000Z"
    }
}
```

### API Requests

Plugins can make API requests to interact with the frontend:

```json
{
    "plugin_id": "my-plugin",
    "message_type": "api_request",
    "data": {
        "id": "req_123456789",
        "method": "settings.addButton",
        "params": {
            "title": "My Button",
            "icon": "fas fa-star"
        }
    }
}
```

### API Responses

The server responds to API requests:

```json
{
    "plugin_id": "my-plugin",
    "message_type": "api_response",
    "data": {
        "id": "req_123456789",
        "result": {
            "id": "button_123456789"
        }
    }
}
```

### Events from Frontend

The frontend sends events to plugins:

```json
{
    "plugin_id": "my-plugin",
    "message_type": "button_press",
    "data": {
        "buttonId": "button_123456789"
    }
}
```

## Available API Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `settings.addButton` | Add a button to settings UI | `title: string, icon?: string` |
| `settings.addInput` | Add an input to settings UI | `label: string, type: 'text'|'password'|'number'` |
| `ui.showNotification` | Show a notification | `message: string` |
| `ui.openModal` | Open a modal dialog | `content: string` |

## Event Types

| Event Type | Description | Data |
|------------|-------------|------|
| `register_ack` | Registration acknowledged | `status: 'success'` |
| `api_response` | Response to API request | `id: string, result?: any, error?: string` |
| `button_press` | Button was pressed | `buttonId: string` |
| `input_change` | Input value changed | `inputId: string, value: string` |

## Examples

### Running the Example Plugin

1. Install dependencies:
```bash
cd plugins/hello-world
npm install ws
```

2. Start the Tauri app (this starts the plugin server on port 3001)

3. Run the example plugin:
```bash
node rust-plugin-example.js
```

### Creating Your Own Plugin

1. Create a new directory for your plugin
2. Install the `ws` package: `npm install ws`
3. Create your plugin class extending the base functionality
4. Connect to `ws://127.0.0.1:3001`
5. Register your plugin and implement the API methods

## Troubleshooting

### Plugin Server Not Starting

- Check if port 3001 is available
- Ensure Tauri app is running
- Check the Rust logs for WebSocket server errors

### Plugin Connection Issues

- Verify the WebSocket URL is correct (`ws://127.0.0.1:3001`)
- Check if the plugin server is running
- Ensure no firewall is blocking the connection

### API Requests Not Working

- Verify the plugin is registered (check for `register_ack` message)
- Ensure the API method name is correct
- Check the request parameters match the expected format

## Security Considerations

- Plugins run as separate processes and connect via WebSocket
- No direct file system access from plugins
- All communication goes through the controlled API
- Plugin UI elements are sandboxed within the main application

## Contributing

1. Follow the established message protocol
2. Add comprehensive error handling
3. Include documentation for new API methods
4. Test with multiple concurrent plugins
5. Ensure proper cleanup on disconnection 