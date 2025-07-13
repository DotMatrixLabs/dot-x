# DotX Plugin System Implementation

## Overview

This document outlines the complete implementation of the DotX plugin system, which allows users to extend the application functionality through custom plugins.

## Architecture

The plugin system consists of several key components:

1. **Rust Backend** (`src-tauri/src/plugins.rs`) - Plugin discovery and process management
2. **TypeScript Frontend** (`src/ts/pluginManager.ts`) - Plugin configuration and lifecycle management
3. **RPC Communication** (`src/rpc/`) - WebSocket-based communication between plugins and the main app
4. **Plugin SDK** (`plugin-sdk/`) - Development tools and examples for creating plugins

## Implementation Steps

### Phase 1: Backend Infrastructure ✅

#### Step 1: Rust Plugin Management System
- **File**: `src-tauri/src/plugins.rs`
- **Features**:
  - Plugin discovery from appData/plugins directory
  - Manifest.json parsing and validation
  - Permission system for plugin security
  - Deno process management for plugin execution
  - Tauri commands for frontend communication

#### Step 2: Tauri Configuration Updates
- **File**: `src-tauri/src/main.rs`
- **Changes**:
  - Added plugins module import
  - Registered plugin-related Tauri commands
  - Added tokio dependency for async operations

#### Step 3: Plugin Directory Structure
- **Location**: `%APPDATA%/DotX/plugins/`
- **Structure**:
  ```
  plugins/
  ├── hello-world/
  │   ├── manifest.json
  │   └── main.js
  ├── system-control/
  │   ├── manifest.json
  │   └── main.js
  └── ...
  ```

### Phase 2: Frontend Integration ✅

#### Step 4: Plugin Manager Service
- **File**: `src/ts/pluginManager.ts`
- **Features**:
  - Plugin configuration management using Tauri Store
  - Plugin discovery and auto-start functionality
  - RPC server integration
  - Plugin lifecycle management (start/stop/enable/disable)

#### Step 5: App.vue Integration
- **File**: `src/App.vue`
- **Changes**:
  - Added plugin manager import
  - Integrated plugin initialization in mounted() lifecycle
  - Added error handling for plugin system failures

### Phase 3: Plugin SDK Updates ✅

#### Step 6: Plugin Examples
- **Files**: 
  - `plugin-sdk/examples/hello-world/main.js`
  - `plugin-sdk/examples/system-control/main.js`
  - `plugin-sdk/templates/basic/main.js`
- **Features**:
  - Deno-compatible JavaScript implementation
  - Socket.IO integration for RPC communication
  - Plugin API wrapper for common operations
  - Error handling and cleanup procedures

#### Step 7: RPC System Integration
- **File**: `src/rpc/plugin-rpc-server.ts`
- **Features**:
  - WebSocket server for plugin communication
  - Plugin registration and authentication
  - Message routing and response handling
  - Permission validation

## Plugin Development Guide

### Creating a New Plugin

1. **Create Plugin Directory**
   ```bash
   mkdir %APPDATA%/DotX/plugins/my-plugin
   cd %APPDATA%/DotX/plugins/my-plugin
   ```

2. **Create manifest.json**
   ```json
   {
     "id": "my-plugin",
     "name": "My Plugin",
     "version": "1.0.0",
     "description": "A custom plugin for DotX",
     "author": "Your Name",
     "main": "main.js",
     "permissions": [
       "ui.commands",
       "ui.toasts"
     ]
   }
   ```

3. **Create main.js**
   ```javascript
   import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';
   
   // Copy the PluginAPI class from the examples
   // Implement your plugin logic
   ```

### Available Permissions

- `ui.commands` - Register/unregister commands
- `ui.toasts` - Show toast notifications
- `ui.actionSelector` - Add tabs to action selector
- `ui.settings` - Add settings inputs and tabs
- `ui.topBar` - Add buttons to top bar
- `storage.local` - Local storage access
- `system.volume` - Volume control
- `system.rgb` - RGB lighting control
- `system.brightness` - Screen brightness control

### Plugin API Reference

#### Commands
```javascript
// Register a command
await api.commands.register({
  id: 'my-plugin.my-command',
  name: 'My Command',
  description: 'Does something cool',
  hotkey: 'Ctrl+Shift+M',
  icon: 'fas fa-star',
  callback: async () => {
    // Command implementation
  }
});

// Unregister a command
await api.commands.unregister('my-plugin.my-command');
```

#### Toasts
```javascript
// Show a toast notification
await api.toasts.show('Hello World!', {
  type: 'success', // 'info', 'warning', 'error', 'success'
  duration: 3000
});
```

#### Logging
```javascript
await api.logs.info('Plugin started');
await api.logs.warn('Warning message');
await api.logs.error('Error occurred');
```

## Configuration

### Plugin Configuration Structure
```typescript
interface PluginConfig {
  id: string;
  enabled: boolean;
  folder_path: string;
  auto_start: boolean;
  last_modified?: string;
}
```

### Plugin Manifest Structure
```typescript
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: string[];
  dotxVersion?: string;
  license?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  engines?: Record<string, string>;
}
```

## Testing the Implementation

### Prerequisites
1. Ensure Deno is installed on the system
2. Make sure the RPC server port (8080) is available
3. Plugin directory exists in appData

### Testing Steps

1. **Start the Application**
   ```bash
   npm run tauri dev
   ```

2. **Copy Example Plugin**
   ```bash
   # Copy hello-world example to appData/plugins
   cp -r plugin-sdk/examples/hello-world %APPDATA%/DotX/plugins/
   ```

3. **Enable Plugin**
   - Open DotX settings
   - Navigate to Plugins section
   - Enable "Hello World Plugin"
   - Set to auto-start if desired

4. **Test Plugin Functionality**
   - Use the registered hotkeys (Ctrl+H, Ctrl+Shift+G)
   - Check console logs for plugin messages
   - Verify toast notifications appear

## Security Considerations

1. **Permission System** - Plugins can only access APIs they have permission for
2. **Process Isolation** - Each plugin runs in its own Deno process
3. **Sandboxing** - Deno's security model restricts file system and network access
4. **Manifest Validation** - Plugin manifests are validated before execution

## Troubleshooting

### Common Issues

1. **Plugin Won't Start**
   - Check if Deno is installed
   - Verify manifest.json syntax
   - Check plugin permissions
   - Review console logs for errors

2. **RPC Connection Failed**
   - Ensure port 8080 is available
   - Check firewall settings
   - Verify plugin RPC server is running

3. **Permission Denied**
   - Check plugin manifest permissions
   - Verify requested permissions are valid
   - Ensure plugin is enabled in settings

### Debug Mode

Enable debug logging in the plugin manager:
```javascript
// In src/ts/pluginManager.ts
console.log('Plugin debug info:', {
  plugins: this.getPluginConfigs(),
  active: this.getActivePlugins(),
  stats: this.getStats()
});
```

## Future Enhancements

1. **Plugin Marketplace** - Central repository for sharing plugins
2. **Plugin Templates** - More starter templates for common use cases
3. **Hot Reload** - Live reloading during plugin development
4. **Plugin Dependencies** - Support for plugin-to-plugin dependencies
5. **UI Components** - More UI integration points for plugins
6. **Plugin Analytics** - Usage tracking and performance metrics

## File Structure Summary

```
dot-x/
├── src-tauri/
│   ├── src/
│   │   ├── plugins.rs          # Plugin management (Rust)
│   │   └── main.rs             # Updated with plugin commands
│   └── Cargo.toml              # Added tokio dependency
├── src/
│   ├── ts/
│   │   └── pluginManager.ts    # Plugin manager service
│   ├── rpc/
│   │   └── plugin-rpc-server.ts # RPC server (existing)
│   └── App.vue                 # Updated with plugin initialization
└── plugin-sdk/
    ├── examples/
    │   ├── hello-world/
    │   │   ├── manifest.json
    │   │   └── main.js         # Deno-compatible JS
    │   └── system-control/
    │       ├── manifest.json
    │       └── main.js         # Deno-compatible JS
    └── templates/
        └── basic/
            ├── manifest.json
            └── main.js         # Basic template
```

## Conclusion

The DotX plugin system provides a robust, secure, and extensible platform for users to enhance their application experience. The implementation follows modern best practices with proper separation of concerns, security measures, and developer-friendly APIs.

The system is now ready for testing and can be extended with additional features as needed. 