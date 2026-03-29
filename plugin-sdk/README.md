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


## Getting Started

### Prerequisites

**Important**: The DotX application must be running before starting any plugins. The plugin server is automatically started by the DotX application during startup.

### Installation

```bash
npm install dotx-plugin-sdk
# or for local development
npm install ../plugin-sdk
```

### Scaffold via NPX

The project scaffolder is published separately as `create-dotx-plugin`.

Create a plugin in the current directory:

```bash
npx create-dotx-plugin --name "My Plugin"
# or
npm create dotx-plugin -- --name "My Plugin"
```

Options:

- `--deno` (default): Deno + TypeScript template
- `--node`: Node + TypeScript + esbuild template with `plugin.zip` packaging and a GitHub Release workflow
- `--id <id>`: Override generated plugin id
- `--force`: Overwrite existing files

Next steps (Deno):

```bash
deno task start
```

Next steps (Node):

```bash
npm install
npm run build
node main.js
```

The generated Node template also includes:

- `npm run package` to build `dist/plugin.zip`
- `.github/workflows/release-plugin.yml` to publish `plugin.zip` on version tags
- helper scripts under `scripts/` for build, packaging, and release validation
- a normal `dotx-plugin-sdk` npm dependency, so it no longer depends on a sibling `dot-x` checkout

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
import Plugin, { runPlugin } from 'dotx-plugin-sdk';

export default class MyPlugin extends Plugin {
  async onLoad() {
    console.log('Plugin loaded!');
    
    // Create settings UI
    await this.settings.createSettings({
      schema: {
        myField: {
          type: "text",
          label: "My Setting"
        }
      }
    });
    
    // Show notification
    await this.ui.showToast({
      message: "Plugin loaded!",
      type: "success"
    });

    // Register a system utility button via actionmapper (works for sliders, knobs, buttons)
    this.actionmapper
      .addSystemUtilButton('myAction')
      .setTitle('Do Thing')
      .setIcon('fas fa-lg fa-bolt')
      .onClick(() => {
        this.ui.showToast({ message: 'My Action clicked!', type: 'info' });
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
- **Automatically retries failed connections** with detailed error messages

### Connection Configuration

You can customize connection behavior by passing a configuration object:

```typescript
import Plugin, { runPlugin, ConnectionConfig } from 'dotx-plugin-sdk';

const config: ConnectionConfig = {
  serverUrl: 'http://localhost:3001',  // Default plugin server URL
  maxRetries: 5,                       // Maximum connection retry attempts
  retryDelay: 2000,                    // Delay between retry attempts (ms)
  connectionTimeout: 10000,            // Connection timeout (ms)
  registrationTimeout: 15000,          // Registration timeout (ms)
  apiTimeout: 30000                    // API request timeout (ms)
};

if (require.main === module) {
  runPlugin(MyPlugin, config);
}
```

### Connection Lifecycle

1. **Connection**: Plugin connects to `http://localhost:3001`
2. **Retry Logic**: If connection fails, automatically retries up to 5 times
3. **Registration**: Plugin automatically registers with server
4. **Confirmation**: Server acknowledges registration via waitForAck
5. **Ready**: `onLoad()` is called only after successful registration
6. **API Calls**: All subsequent API calls use waitForAck pattern
7. **Monitoring**: Connection status is continuously monitored

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
- **Timeout Protection**: Configurable timeout prevents hanging requests
- **Real-time Feedback**: Immediate response from the application
- **Connection Reliability**: Automatic reconnection and registration handling

## Error Handling

The SDK provides comprehensive error handling with detailed error messages:

### Common Error Scenarios

#### Connection Refused (ECONNREFUSED)
This occurs when the DotX application is not running or the plugin server hasn't started.

**Solutions:**
1. Make sure the DotX application is running
2. Wait for the application to fully load (the plugin server starts automatically)
3. Check if another application is using port 3001
4. Try restarting the DotX application

#### Connection Timeout (ETIMEDOUT)
This occurs when the connection attempt times out.

**Possible causes:**
1. Firewall blocking the connection
2. Server not responding
3. Network connectivity issues

#### Plugin Registration Failed
This occurs when the plugin server rejects the registration.

**Possible causes:**
1. Invalid plugin metadata
2. Server-side configuration issues
3. Duplicate plugin IDs

### Error Handling in Your Plugin

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
      if (error.message.includes('timeout')) {
        console.log("Request timed out - the server may be busy");
      } else if (error.message.includes('registration failed')) {
        console.log("Plugin registration failed - check plugin configuration");
      }
    }
  }
  
  // Monitor connection status
  async checkConnection() {
    const status = this.getConnectionStatus();
    const isConnected = this.isConnected();
    
    console.log(`Connection status: ${status}, Connected: ${isConnected}`);
  }
}
```

### Debugging Connection Issues

To debug connection issues, check the plugin output for detailed error messages:

```bash
node main.js
```

The plugin will provide step-by-step troubleshooting guidance:

```
Starting My Plugin v1.0.0...
Attempting to connect to plugin server at http://localhost:3001...
Connection failed (attempt 1/5). Retrying in 2000ms...
Error details: connect ECONNREFUSED 127.0.0.1:3001

Max retry attempts reached. Plugin connection failed.
Error: Failed to connect to plugin server after 5 attempts.

Possible causes:
1. The DotX application is not running
2. The plugin server hasn't been started yet
3. The server is running on a different port than expected

Solutions:
1. Make sure the DotX application is running
2. Wait for the application to fully load
3. Check if another application is using port 3001
4. Try restarting the DotX application

Troubleshooting steps:
1. Make sure the DotX application is running
2. Wait for the application to fully load
3. Check if the plugin server is enabled in DotX settings
4. Verify no other application is using port 3001
```

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

### Plugin Status Methods

#### `getConnectionStatus()`

Get the current connection status.

```typescript
const status = this.getConnectionStatus();
// Returns: 'connected' | 'connecting' | 'disconnected' | 'destroyed'
```

#### `isConnected()`

Check if the plugin is connected and ready.

```typescript
const connected = this.isConnected();
// Returns: boolean
```

### Action Mapper (System Utilities)

Expose plugin-defined buttons inside the System Utilities tab using the `actionmapper` property. Actions are control-agnostic (sliders, knobs, buttons).

```typescript
// Inside your plugin's onLoad()
this.actionmapper
  .addSystemUtilButton('myAction')
  .setTitle('Do Thing')
  .setIcon('fas fa-lg fa-bolt')
  .onClick(() => {
    this.ui.showToast({ message: 'My Action clicked!', type: 'info' });
  });
```

Type: SystemUtilButton { id: string; title: string; icon?: string; onClick?: () => void }

#### Per-button System Utility Settings

You can attach a lightweight settings UI to a specific system-utility button. These settings render inside the System Utilities selector only when that button is selected for the current channel. This reuses the same `SettingsBuilder` field DSL (`addText`, `addSwitch`, `addInput`, etc.).

```typescript
// Attach settings using the fluent handle
this.actionmapper
  .addSystemUtilButton('eq')
  .setTitle('EQ')
  .setIcon('fas fa-sliders-h fa-lg')

// Or attach by id later
this.actionmapper.addSystemUtilSetting('eq', (s) => {
  s.addSection('Advanced').addText('note').setText('Extra controls...');
});
```

Notes:
- Settings callbacks are converted to `actionId`/`onChangeActionId` internally; the app will invoke them via the same `plugin.action` channel.
- The `settings` are included in `get_actions` per button; the app renders them only when the button is selected for the active channel.

## Development

### Testing Plugin Server Connection

Before developing your plugin, you can test if the plugin server is available:

```bash
# Test connection with default settings
npm run test-connection

# Test connection with custom URL and timeout
npx tsx src/test-connection.ts http://localhost:3001 15000
```

This will:
- Test connection to the plugin server
- Verify plugin registration works
- Provide detailed error messages if connection fails

### Waiting for Plugin Server

You can wait for the plugin server to become available before starting your plugin:

```bash
# Wait for server with default settings (60 seconds max)
npm run wait-for-server

# Wait with custom settings
npx tsx src/wait-for-server.ts http://localhost:3001 30000 1000
```

Or use it programmatically in your plugin:

```typescript
import { waitForPluginServer, runPlugin } from 'dotx-plugin-sdk';

async function startPlugin() {
  console.log('Waiting for DotX plugin server...');
  const serverReady = await waitForPluginServer();
  
  if (serverReady) {
    console.log('Server is ready, starting plugin...');
    await runPlugin(MyPlugin);
  } else {
    console.error('Plugin server not available');
    process.exit(1);
  }
}

if (require.main === module) {
  startPlugin();
}
```

### Regenerating Types

To regenerate types after API changes:

```bash
npm run generate-types
```

## Example Plugin

See `plugins/hello-world/` for a complete example with `manifest.json` and `main.ts`.

## Troubleshooting

### Plugin Won't Connect

1. **Verify DotX is running**: Make sure the DotX application is open and fully loaded
2. **Check port availability**: Ensure no other application is using port 3001
3. **Plugin server status**: The plugin server starts automatically with DotX
4. **Firewall settings**: Ensure your firewall allows localhost connections on port 3001
5. **Plugin permissions**: Make sure your plugin has permission to access network resources

### Plugin Connects but API Calls Fail

1. **Check registration**: Ensure the plugin has successfully registered with the server
2. **API timeout**: Increase the `apiTimeout` in your connection configuration
3. **Server logs**: Check the DotX application logs for server-side errors
4. **Plugin manifest**: Verify your `manifest.json` is valid and complete

### Performance Issues

1. **Connection monitoring**: Disable connection monitoring if not needed
2. **API batching**: Batch multiple API calls where possible
3. **Error handling**: Implement proper error handling to avoid retry loops
4. **Resource cleanup**: Ensure proper cleanup in your `onUnload()` method
