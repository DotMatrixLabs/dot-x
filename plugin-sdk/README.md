# DotX Plugin SDK

This SDK allows you to develop plugins for the DotX application using Socket.IO with waitForAck pattern for reliable communication.

## Architecture

The plugin system uses Socket.IO for real-time communication between plugins and the DotX application:

```
Plugin (Socket.IO Client) 
    ↓ (Socket.IO with waitForAck)
Plugin Server (Rust + Socket.IO) 
    ↓ (Tauri Events)
Frontend (Vue.js)
```

### Key Features
- **Reliable Communication**: Uses Socket.IO acknowledgment callbacks (waitForAck) for guaranteed message delivery
- **Automatic Registration**: Plugins automatically register with the server on connection
- **Error Handling**: Built-in timeout and error handling for all API requests
- **Real-time Updates**: Instant communication between plugins and the frontend

## Getting Started

### Installation

```bash
npm install plugin-sdk
# or for local development
npm link ../plugin-sdk
```

### Creating a Plugin

First, create a `manifest.json` file with your plugin metadata:

```json
{
  "id": "my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "A description of what my plugin does",
  "author": "Your Name",
  "dotxVersion": ">=1.0.0",
  "main": "main.ts"
}
```

Then create your plugin class:

```typescript
import Plugin, { runPlugin } from 'plugin-sdk';

export default class MyPlugin extends Plugin {
  async onLoad() {
    // Plugin initialization code (connection already established)
    console.log('Plugin loaded!');
    
    // Create settings UI - waitForAck ensures reliable delivery
    await this.settings.createSettings({
      schema: {
        myField: {
          type: "text",
          label: "My Setting"
        }
      }
    });
    
    // Show notification - guaranteed delivery with error handling
    await this.ui.showToast({
      message: "Plugin loaded!",
      type: "success"
    });
  }
  
  async onUnload() {
    // Cleanup code
    console.log('Plugin unloaded!');
  }
}

// Auto-run when executed directly
if (require.main === module) {
  runPlugin(MyPlugin);
}
```

The `runPlugin` utility automatically:
- Reads plugin metadata from `manifest.json`
- Creates PluginInfo and establishes Socket.IO connection
- **Waits for registration to complete** before calling `onLoad()`
- Handles plugin registration with waitForAck confirmation
- Manages plugin instantiation and lifecycle
- Keeps the process alive for Socket.IO connections
- Provides graceful shutdown on Ctrl+C
- Includes comprehensive error handling and logging

### Connection Lifecycle

1. **Connection**: Plugin connects to `http://localhost:3001`
2. **Registration**: Plugin automatically registers with server
3. **Confirmation**: Server acknowledges registration via waitForAck
4. **Ready**: `onLoad()` is called only after successful registration
5. **API Calls**: All subsequent API calls use waitForAck pattern

## Socket.IO waitForAck Pattern

The plugin system uses Socket.IO's acknowledgment callback pattern for reliable communication:

### Plugin Registration
When a plugin connects, it automatically registers using waitForAck:

```typescript
// Automatic registration (handled by SDK)
socket.emit('register', pluginInfo, (ack) => {
  if (ack.status === 'success') {
    console.log('Plugin registered successfully!');
  }
});
```

### API Requests
All API calls use waitForAck for guaranteed responses:

```typescript
// API request with 30-second timeout
socket.emit('api_request', {
  method: 'settings.setValue',
  params: { key: 'test', value: 'hello' },
  request_id: 'unique_id'
}, (response) => {
  if (response.success) {
    console.log('Success:', response.data);
  } else {
    console.error('Error:', response.error);
  }
});
```

### Benefits
- **Guaranteed Delivery**: Acknowledgments ensure messages are received
- **Error Handling**: Failed requests return detailed error information
- **Timeout Protection**: 30-second timeout prevents hanging requests
- **Real-time Feedback**: Immediate response from the application
- **Connection Reliability**: Automatic reconnection and registration handling

### Error Handling

The SDK provides comprehensive error handling:

```typescript
export default class MyPlugin extends Plugin {
  async onLoad() {
    try {
      await this.settings.createSettings({
        schema: { test: { type: "text", label: "Test" } }
      });
      console.log("Settings created successfully");
    } catch (error) {
      console.error("Failed to create settings:", error.message);
      // Handle specific error cases:
      // - "Plugin registration failed" - Server connection issues
      // - "Request timeout" - API request took too long
      // - "API request failed" - Server-side error
    }
  }
}
```

Common error scenarios:
- **Server not running**: Plugin registration timeout (10 seconds)
- **Connection lost**: Automatic reconnection attempts
- **API errors**: Detailed error messages from the server
- **Request timeout**: 30-second timeout for all API calls

## Manifest.json Structure

```typescript
interface PluginManifest {
  id: string;           // Unique plugin identifier
  name: string;         // Display name
  version: string;      // Semver version
  description?: string; // Plugin description
  author?: string;      // Author name
  dotxVersion?: string; // Required DotX version (semver range)
  main: string;         // Entry point file
}
```

## API Reference

### Settings API

#### `settings.createSettings(config)`

Create a settings panel for your plugin.

```typescript
const settings = await this.settings.createSettings({
  schema: {
    myText: {
      type: "text",
      label: "Text Input",
      placeholder: "Enter text here"
    },
    myBoolean: {
      type: "boolean", 
      label: "Enable Feature"
    },
    mySelect: {
      type: "select",
      label: "Choose Option",
      options: [
        { value: "option1", label: "Option 1" },
        { value: "option2", label: "Option 2" }
      ]
    }
  },
  options: {
    defaultTab: "general",
    showTabIcons: true,
    tabPosition: "top",
    autoSave: true,
    tabs: {
      general: {
        title: "General",
        icon: "⚙️"
      }
    }
  }
});
```

#### `settings.setValue(params)`

Set a setting value programmatically.

```typescript
await this.settings.setValue({
  key: "myText",
  value: "Hello World!"
});
```

#### `settings.getValue(params)`

Get a setting value.

```typescript
const value = await this.settings.getValue({
  key: "myText"
});
```

### UI API

#### `ui.showToast(params)`

Show a toast notification.

```typescript
await this.ui.showToast({
  message: "Operation completed!",
  type: "success", // "info" | "success" | "warning" | "error"
  duration: 3000 // milliseconds
});
```

#### `ui.showModal(params)`

Show a modal dialog.

```typescript
const result = await this.ui.showModal({
  title: "Confirm Action",
  content: "Are you sure you want to continue?",
  size: "medium",
  buttons: [
    { label: "Cancel", style: "secondary" },
    { label: "Confirm", style: "primary" }
  ]
});
```

#### `ui.showConfirmation(params)`

Show a confirmation dialog.

```typescript
const confirmed = await this.ui.showConfirmation({
  title: "Delete Item",
  message: "This action cannot be undone.",
  confirmText: "Delete",
  cancelText: "Cancel",
  type: "danger"
});
```

## Development

To regenerate types after API changes:

```bash
npm run generate-types
```

## Example Plugin

See `plugins/hello-world/` for a complete example with `manifest.json` and `main.ts`.
