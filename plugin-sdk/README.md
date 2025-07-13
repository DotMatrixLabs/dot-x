# DotX Plugin SDK

A comprehensive plugin development kit for DotX, featuring secure Deno 2 runtime with Socket.IO-based RPC communication and bundled deployment.

## 🚀 Quick Start

### 1. Install Dependencies

First, install the required dependencies for the main DotX application:

```bash
# In the main DotX project directory
npm install socket.io socket.io-client
```

### 2. Start the Plugin RPC Server

The plugin RPC server is automatically started when you run the DotX application. It listens on port 8080 by default.

### 3. Create Your First Plugin

Create a new plugin directory with two files:

**manifest.json**
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A simple plugin example",
  "author": "Your Name",
  "dotxVersion": ">=1.0.0",
  "permissions": [
    "ui.commands",
    "ui.toasts",
    "storage.local"
  ],
  "main": "main.js",
  "license": "MIT",
  "keywords": ["plugin", "example"],
  "engines": {
    "node": ">=18.0.0",
    "deno": ">=1.30.0"
  }
}
```

**main.ts** (will be bundled to main.js)
```typescript
import { initPluginFromManifest } from '@dotx/plugin-sdk';

async function main() {
  const api = await initPluginFromManifest('./manifest.json');
  
  // Register a command
  await api.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    description: 'Shows a hello message',
    hotkey: 'Ctrl+H',
    icon: 'fas fa-wave',
    callback: async () => {
      await api.toasts.show('Hello from my plugin!', {
        type: 'success',
        duration: 3000
      });
    }
  });
  
  // Clean up on unload
  globalThis.addEventListener('beforeunload', async () => {
    await api.commands.unregister('my-plugin.hello');
    await api.destroy();
  });
}

main();
```

### 4. Bundle Your Plugin

Bundle your plugin into a single `main.js` file:

```bash
# Using esbuild (recommended)
npx esbuild main.ts --bundle --outfile=main.js --format=esm --target=es2022

# Or using Deno
deno bundle main.ts main.js

# Or using Webpack/Rollup/Vite
# Configure your bundler to output main.js
```

### 5. Run Your Plugin

```bash
# In your plugin directory
deno run --allow-net --allow-read --allow-write main.js
```

## 🏗️ Architecture

### Plugin Structure

```
my-plugin/
├── manifest.json     # Plugin metadata and configuration
├── main.js          # Bundled plugin code (generated)
├── main.ts          # Source TypeScript code
├── package.json     # Dependencies for bundling
├── README.md        # Plugin documentation
└── assets/          # Optional plugin assets
```

### Manifest vs Source

- **manifest.json**: Contains all plugin metadata, permissions, and configuration
- **main.ts**: Source code that gets bundled into main.js
- **main.js**: Final bundled file that includes all dependencies

### RPC Communication Flow

```
┌─────────────────┐    Socket.IO    ┌─────────────────┐    Custom Events    ┌─────────────────┐
│                 │ ◄─────────────► │                 │ ◄─────────────────► │                 │
│  Bundled Plugin │                 │  RPC Server     │                     │  Vue.js App     │
│    (main.js)    │                 │  (Node.js)      │                     │                 │
└─────────────────┘                 └─────────────────┘                     └─────────────────┘
```

## 📋 Manifest Schema

### Required Fields

```json
{
  "id": "unique-plugin-id",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Your Name",
  "dotxVersion": ">=1.0.0",
  "permissions": ["ui.commands", "ui.toasts"],
  "main": "main.js"
}
```

### Optional Fields

```json
{
  "license": "MIT",
  "homepage": "https://github.com/user/plugin",
  "repository": "https://github.com/user/plugin",
  "keywords": ["keyword1", "keyword2"],
  "engines": {
    "node": ">=18.0.0",
    "deno": ">=1.30.0"
  },
  "ui": [
    {
      "id": "my-modal",
      "name": "My Modal",
      "type": "modal",
      "config": {}
    }
  ]
}
```

## 🔧 Available APIs

### Commands API
Register and manage commands in the command palette:

```typescript
// Register a command
await api.commands.register({
  id: 'my-plugin.action',
  name: 'My Action',
  description: 'Performs an action',
  hotkey: 'Ctrl+A',
  icon: 'fas fa-star',
  callback: async () => {
    // Command logic here
  }
});

// Unregister a command
await api.commands.unregister('my-plugin.action');
```

### UI APIs

#### ActionSelector
Add tabs and system utilities:

```typescript
// Add a tab
await api.actionSelector.addTab({
  id: 'my-tab',
  name: 'My Tab',
  icon: 'fas fa-cog',
  order: 100
});

// Add system utility
await api.actionSelector.addSystemUtility({
  id: 'my-utility',
  name: 'My Utility',
  icon: 'fas fa-tool',
  action: 'my-action',
  order: 1
});
```

#### Settings
Add settings tabs and inputs:

```typescript
// Add settings tab
await api.settings.addTab({
  id: 'my-settings',
  name: 'My Settings',
  icon: 'fas fa-cogs',
  inputs: [
    {
      id: 'enabled',
      type: 'boolean',
      label: 'Enable Plugin',
      value: true
    },
    {
      id: 'api-key',
      type: 'text',
      label: 'API Key',
      placeholder: 'Enter your API key'
    }
  ],
  order: 100
});
```

#### TopBar
Add buttons to the top bar:

```typescript
await api.topBar.addButton({
  id: 'my-button',
  icon: 'fas fa-star',
  tooltip: 'My Custom Button',
  action: 'my-action',
  order: 1
});
```

### System APIs

#### RGB Control
Control RGB lighting:

```typescript
// Set color
await api.rgb.setRGB({ r: 255, g: 0, b: 0 });

// Get current color
const color = await api.rgb.getRGB();

// Set effect
await api.rgb.setEffect({
  type: 'rainbow',
  speed: 50,
  brightness: 80
});
```

#### Storage
Persistent data storage:

```typescript
// Set value
await api.storage.set('my-key', 'my-value');

// Get value
const value = await api.storage.get('my-key') || 'default';

// Remove value
await api.storage.remove('my-key');
```

#### Event Listeners
Listen to system events:

```typescript
// Listen for slider changes
api.listeners.onSliderChange((event) => {
  console.log('Slider changed:', event.sliderId, event.value);
});

// Listen for device changes
api.listeners.onDeviceConnected((device) => {
  console.log('Device connected:', device.deviceName);
});

api.listeners.onDeviceDisconnected((device) => {
  console.log('Device disconnected:', device.deviceName);
});
```

### UI Feedback

#### Toasts
Show notification messages:

```typescript
await api.toasts.show('Success!', {
  type: 'success',
  duration: 3000
});

await api.toasts.show('Warning!', {
  type: 'warning',
  duration: 5000
});
```

#### Modals
Show modal dialogs:

```typescript
await api.modal.show('my-modal', {
  id: 'my-modal',
  name: 'My Modal',
  type: 'modal',
  config: {
    title: 'My Modal Title',
    content: 'Modal content here'
  }
});
```

#### Logs
System logging:

```typescript
await api.logs.info('Plugin started');
await api.logs.warn('Warning message');
await api.logs.error('Error occurred');
```

## 🔒 Security & Permissions

### Permission System

Plugins must declare required permissions in `manifest.json`:

```json
{
  "permissions": [
    "ui.commands",        // Command registration
    "ui.toasts",          // Toast notifications
    "ui.settings",        // Settings management
    "ui.actionSelector",  // Action selector integration
    "ui.topBar",          // Top bar buttons
    "ui.modal",           // Modal dialogs
    "system.rgb",         // RGB control
    "storage.local",      // Local storage
    "listeners.slider",   // Slider event listeners
    "listeners.device",   // Device event listeners
    "network.fetch"       // Network requests
  ]
}
```

### Deno 2 Security

Plugins run in Deno 2 with restricted permissions:

```bash
# Required flags for basic plugin functionality
deno run --allow-net=localhost:8080 --allow-read=. --allow-write=./data main.js
```

## 🔨 Development & Bundling

### Development Workflow

1. **Create Plugin**: Use template or create manually
2. **Install Dependencies**: `npm install` or `yarn install`
3. **Write Code**: Develop in TypeScript
4. **Bundle**: Create single `main.js` file
5. **Test**: Run bundled plugin
6. **Deploy**: Package for distribution

### Bundling Options

#### ESBuild (Recommended)
```bash
npx esbuild main.ts --bundle --outfile=main.js --format=esm --target=es2022 --external:@dotx/plugin-sdk
```

#### Deno Bundle
```bash
deno bundle main.ts main.js
```

#### Webpack
```javascript
module.exports = {
  entry: './main.ts',
  output: {
    filename: 'main.js',
    format: 'esm'
  },
  target: 'es2022',
  externals: {
    '@dotx/plugin-sdk': '@dotx/plugin-sdk'
  }
};
```

#### Rollup
```javascript
export default {
  input: 'main.ts',
  output: {
    file: 'main.js',
    format: 'es'
  },
  external: ['@dotx/plugin-sdk']
};
```

### Package.json Template

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "esbuild main.ts --bundle --outfile=main.js --format=esm --target=es2022",
    "dev": "esbuild main.ts --bundle --outfile=main.js --format=esm --target=es2022 --watch"
  },
  "devDependencies": {
    "esbuild": "^0.19.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "@dotx/plugin-sdk": "^1.0.0"
  }
}
```

## 📁 Project Structure

```
plugin-sdk/
├── api/
│   └── index.ts           # Main plugin API
├── rpc/
│   └── client.ts          # Socket.IO RPC client
├── types/
│   └── index.ts           # TypeScript type definitions
├── examples/
│   ├── hello-world/       # Simple example plugin
│   │   ├── manifest.json  # Plugin manifest
│   │   ├── main.ts        # Source code
│   │   └── main.js        # Bundled output
│   └── system-control/    # Advanced example
│       ├── manifest.json
│       ├── main.ts
│       └── main.js
├── templates/
│   └── basic/             # Basic plugin template
│       ├── manifest.json
│       ├── main.ts
│       └── package.json
├── docs/
│   ├── getting-started.md # Getting started guide
│   └── api-reference.md   # Complete API reference
└── README.md              # This file
```

## 🔧 Development Tools

### Plugin Template
Use the basic template to create new plugins:

```bash
cp -r plugin-sdk/templates/basic my-new-plugin
cd my-new-plugin
# Edit manifest.json and main.ts
npm install
npm run build
```

### TypeScript Support
Full TypeScript support with type definitions:

```typescript
import type { 
  PluginManifest, 
  PluginAPI, 
  Command, 
  RGBColor, 
  ToastOptions 
} from '@dotx/plugin-sdk';
```

### Hot Reload
Use watch mode during development:

```bash
npm run dev  # Watches and rebuilds on changes
```

## 🚀 Deployment

### Plugin Distribution
Package plugins as directories containing:

```
my-plugin/
├── manifest.json  # Plugin metadata
├── main.js        # Bundled plugin code
├── README.md      # Documentation
└── assets/        # Optional assets
```

### Installation
Copy plugin directories to the plugins folder and restart DotX.

### Publishing
Consider publishing to npm for easy installation:

```bash
npm publish
```

## 📚 Examples

See the `examples/` directory for complete plugin implementations:

- **hello-world**: Basic plugin with commands and toasts
- **system-control**: Advanced plugin with RGB control, settings, and UI integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and documentation
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- 📖 Documentation: See `docs/` directory
- 🐛 Issues: Report on GitHub
- 💬 Discussions: GitHub Discussions
- 📧 Email: support@dotx.dev

---

**Happy Plugin Development!** 🎉 