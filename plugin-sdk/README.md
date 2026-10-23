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
npm install @dotmatrixlabs/dotx-plugin-sdk
# or for local development
npm install ../plugin-sdk
```

### Scaffold

The project scaffolder is published separately as `@dotmatrixlabs/create-dotx-plugin`.

Create a plugin in the current directory:

```bash
npx @dotmatrixlabs/create-dotx-plugin --name "My Plugin"
```

Use `npx` as the primary scaffold command for the scoped package.

Options:

- `--deno` (default): Deno + TypeScript template
- `--node`: Node + TypeScript + esbuild template with `<plugin-name>.dotxplugin` packaging and a GitHub Release workflow
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
npm start
```

The generated Node template also includes:

- `npm run package` to build `dist/<plugin-name>.dotxplugin`
- `npm run release:verify-version` to validate the release tag and marketplace manifest
- `.github/workflows/release-plugin.yml` to publish `<plugin-name>.dotxplugin` on version tags
- a shared `@dotmatrixlabs/dotx-plugin-sdk` CLI (`dotx-plugin`) for packaging and release validation
- a normal `@dotmatrixlabs/dotx-plugin-sdk` npm dependency, so it no longer depends on a sibling `dot-x` checkout

### Create And Publish

Node plugin:

1. Create a new folder and scaffold the plugin:

```bash
mkdir my-plugin
cd my-plugin
npx @dotmatrixlabs/create-dotx-plugin --node --name "My Plugin"
```

2. Install dependencies and run it locally:

```bash
npm install
npm run build
npm start
```

3. Edit `manifest.json`:

- set `id`, `name`, `version`, `dotxVersion`, and `permissions`
- add `packaging.include` if you need extra files in `<plugin-name>.dotxplugin`

4. Build the marketplace package:

```bash
npm run package
```

5. Publish a GitHub release asset:

- commit and push the plugin repo
- push a tag such as `v0.1.0`
- the generated `.github/workflows/release-plugin.yml` workflow builds `dist/<plugin-name>.dotxplugin` and uploads it to the GitHub Release

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
  "permissions": [],
  "main": "main.ts"
}
```

Then create your plugin class:

```typescript
import Plugin, { runPlugin } from '@dotmatrixlabs/dotx-plugin-sdk';

export default class MyPlugin extends Plugin {
  async onLoad() {
    console.log('Plugin loaded!');
    
    // Create settings UI
    await this.settingsPage.addSettings((settings) => {
      settings.addSection('general').setName('General');
      settings.addInput('myField')
        .setLabel('My Setting')
        .setType('text')
        .setValue(this.config.get('myField', ''))
        .onChange(({ value }) => {
          this.config.set('myField', value);
        });
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
import Plugin, { runPlugin, ConnectionConfig } from '@dotmatrixlabs/dotx-plugin-sdk';

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
  method: 'ui.showToast',
  params: { message: 'Hello from my plugin', type: 'info' },
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
      await this.settingsPage.addSettings((settings) => {
        settings.addSection('general');
        settings.addInput('test')
          .setLabel('Test')
          .setType('text')
          .setValue(this.config.get('test', ''));
      });
      console.log("Settings registered successfully");
    } catch (error) {
      console.error("Failed to register settings:", error.message);
      
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
npm start
```

The SDK prefixes its own output with `[dotx-sdk]` so you can tell it apart from
what your plugin logs. It logs at `info` by default. Set
`DOTX_PLUGIN_LOG_LEVEL` to `debug` for connection detail, or to `silent` to
keep only your plugin's own output. The levels are `debug`, `info`, `warn`,
`error`, and `silent`.

The plugin will provide step-by-step troubleshooting guidance:

```
[dotx-sdk] Starting My Plugin v1.0.0...
[dotx-sdk] Connection failed (attempt 1/5). Retrying in 2000ms...
[dotx-sdk] Max retry attempts reached. Plugin connection failed.
[dotx-sdk] Error: Failed to connect to plugin server after 5 attempts.

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
  permissions?: string[]; // Requested plugin permissions
  packaging?: {
    include?: string[]; // Extra files or folders to include in marketplace <plugin-name>.dotxplugin
  };
  main: string;         // Entry point file
}
```

### Runtime Permissions

`manifest.json` `permissions` are user-approved plugin permissions. They request extra Deno runtime capabilities such as `net`, `read`, `write`, `run`, `ffi`, `sys`, `hrtime`, or `all`.

Dot X also grants baseline runtime capabilities required for the SDK/runtime itself. These are not represented in `manifest.permissions` and are not part of the user-approved permission hash:

- Environment access limited to the variables the runtime injects (`DOTX_PLUGIN_ID`, `DOTX_PLUGIN_DIR`, `DOTX_PLUGIN_PLATFORM`, `DOTX_PLUGIN_PORT`, `DOTX_PLUGIN_LOG_LEVEL`), a few Windows system variables (`SYSTEMROOT`, `WINDIR`, `PATH`, `PATHEXT`) and the ones npm packages commonly read on import (`NODE_ENV`, `DEBUG`, `NO_COLOR`, `TERM`, `TMPDIR`, `TZ` and similar).
- Read/write access inside the plugin install directory.
- Network access to the local Dot X plugin server on `localhost`/`127.0.0.1`.
- Limited system account information used by runtime compatibility code.

The environment baseline is deliberately an allowlist rather than the whole
environment, so an installed plugin cannot read credentials a user keeps there.
Dot X starts the plugin with only those variables in its environment, so any
other variable reads as `undefined`, and enumerating `process.env` or
`Deno.env.toObject()` lists only the allowlist. Child processes started with the
`run` permission inherit the same reduced environment. A plugin that needs to
read its own configuration from the environment must add `env` to
`manifest.permissions`, which asks the user for approval at install time and
starts the plugin with the user's full environment.

## Marketplace Packaging

The Node scaffold uses the shared `@dotmatrixlabs/dotx-plugin-sdk` CLI:

```bash
npm run package
```

This builds the file referenced by `manifest.main` and creates `dist/<plugin-name>.dotxplugin` with:

- `manifest.json`
- the entry file declared in `manifest.main`
- optional `assets/`, `data/`, and `bin/`
- any extra paths listed in `manifest.json -> packaging.include`

Example:

```json
{
  "id": "my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "dotxVersion": ">=1.0.0",
  "permissions": [],
  "main": "main.js",
  "packaging": {
    "include": ["locales", "templates/email.html"]
  }
}
```

Marketplace plugin zips currently require `manifest.json` plus the entry file declared by `manifest.main`.

## API Reference

### Settings Page API

#### `settingsPage.addSettings(buildFn)`

Register a settings page for your plugin using the fluent builder API.

```typescript
await this.settingsPage.addSettings((settings) => {
  settings.addSection('general').setName('General');

  settings.addInput('myText')
    .setLabel('Text Input')
    .setType('text')
    .setPlaceholder('Enter text here')
    .setValue(this.config.get('myText', ''))
    .onChange(({ value }) => {
      this.config.set('myText', value);
    });

  settings.addSwitch('enabled')
    .setLabel('Enable Feature')
    .setValue(this.config.get('enabled', false))
    .onChange(({ value }) => {
      this.config.set('enabled', value);
    });

  settings.addSelect('mode')
    .setLabel('Choose Option')
    .setOptions([
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ])
    .setValue(this.config.get('mode', 'option1'))
    .onChange(({ value }) => {
      this.config.set('mode', value);
    });
});
```

Use `this.config.get()` and `this.config.set()` inside field callbacks to persist plugin state locally.

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

`ui.showToast()` is currently the only host-provided UI helper. Modal and confirmation helpers are not part of the supported SDK surface.

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
import { waitForPluginServer, runPlugin } from '@dotmatrixlabs/dotx-plugin-sdk';

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

The SDK publishes declarations generated from `src/plugin-api/schema.ts`. Regenerate them after host API changes so plugin projects get the same IntelliSense and type checking that Dot X supports at runtime:

```bash
cd plugin-sdk
npm run generate-types
npm run build:types
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
