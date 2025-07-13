# Getting Started with DotX Plugin SDK

This guide will help you create your first DotX plugin using the TypeScript SDK.

## Prerequisites

- Deno 2.0 or later
- Basic knowledge of TypeScript and Vue.js
- DotX application (for testing)

## Project Structure

A typical DotX plugin has the following structure:

```
my-plugin/
├── plugin.json          # Plugin metadata
├── main.ts              # Entry point
├── components/          # Vue components (optional)
│   └── MyComponent.vue
├── assets/             # Static assets (optional)
│   └── icon.png
└── deno.json           # Deno configuration
```

## Creating Your First Plugin

### 1. Use the Template

The easiest way to start is using the basic template:

```bash
# Copy the basic template
cp -r plugin-sdk/templates/basic/ my-first-plugin/
cd my-first-plugin/
```

### 2. Update Plugin Metadata

Edit `plugin.json`:

```json
{
  "id": "my-first-plugin",
  "name": "My First Plugin",
  "version": "1.0.0",
  "description": "My first DotX plugin",
  "author": "Your Name",
  "dotxVersion": ">=1.0.0",
  "main": "main.ts",
  "permissions": [
    "ui.modal",
    "ui.toasts", 
    "ui.commands",
    "storage.local"
  ],
  "ui": []
}
```

### 3. Implement Plugin Logic

Edit `main.ts`:

```typescript
import { api } from '@plugin-sdk/api';
import type { Plugin } from '@plugin-sdk/types';

class MyFirstPlugin implements Plugin {
  metadata = {
    id: 'my-first-plugin',
    name: 'My First Plugin',
    version: '1.0.0',
    description: 'My first DotX plugin',
    author: 'Your Name',
    dotxVersion: '>=1.0.0',
    main: 'main.ts',
    permissions: ['ui.inject', 'storage.local'],
    ui: []
  };

  async onLoad() {
    api.logger.info('My First Plugin loaded!');
    
    // Add commands (Obsidian-style)
    await api.commands.addCommand({
      id: 'my-first-plugin-hello',
      name: 'Say Hello',
      description: 'Shows a hello message',
      hotkey: 'Ctrl+Shift+H',
      icon: 'fas fa-hand-wave',
      callback: async () => {
        api.ui.showToast('Hello from my first plugin!', {
          type: 'success',
          duration: 3000
        });
      }
    });
    
    // Show notification - tells DotX main app to create toast
    api.ui.showToast('My First Plugin is now active!', {
      type: 'success',
      duration: 3000
    });
  }

  async onUnload() {
    api.logger.info('My First Plugin unloaded!');
    
    // Clean up commands
    await api.commands.removeCommand('my-first-plugin-hello');
  }
}

export default new MyFirstPlugin();
```

### 4. Create Deno Configuration

Create `deno.json`:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "lib": ["deno.window", "dom"],
    "strict": true
  },
  "imports": {
    "@plugin-sdk/": "../plugin-sdk/",
    "@plugin-sdk/api": "../plugin-sdk/api/index.ts",
    "@plugin-sdk/types": "../plugin-sdk/types/index.ts"
  }
}
```

### 5. Test Your Plugin

```bash
# Check for syntax errors
deno check main.ts

# Format code
deno fmt

# Lint code
deno lint
```

## Plugin API Overview

### Core APIs

- **`api.logger`** - Logging functionality
- **`api.commands`** - Command system (Obsidian-like)
  - **`api.commands.addCommand()`** - Add commands with hotkeys
  - **`api.commands.removeCommand()`** - Remove commands
  - **`api.commands.executeCommand()`** - Execute commands programmatically
- **`api.ui`** - User interface operations (all create UI in main DotX app)
  - **`api.ui.showToast()`** - Show toast notifications
  - **`api.ui.showModal()`** / **`hideModal()`** - Show/hide modals
  - **`api.ui.actionSelector`** - Add tabs and utilities to action selector
  - **`api.ui.settings`** - Add settings tabs and inputs
  - **`api.ui.topBar`** - Add buttons to top bar
- **`api.storage`** - Persistent storage
- **`api.rpc`** - Low-level communication with main app
- **`api.system`** - System integrations (requires permissions)
  - **`api.system.audio`** - Audio control
  - **`api.system.midi`** - MIDI device access
  - **`api.system.rgb`** - RGB lighting control
  - **`api.system.listeners`** - Event listeners for sliders and devices

### UI Components

You can create Vue components for your plugin:

```vue
<!-- components/MyComponent.vue -->
<template>
  <div class="my-component">
    <h2>{{ title }}</h2>
    <button @click="doSomething" class="btn btn-primary">
      Click me
    </button>
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  props: {
    title: String
  },
  methods: {
    doSomething() {
      this.$pluginAPI.ui.notify('Button clicked!');
    }
  }
};
</script>
```

Then register it in your main plugin:

```typescript
// In your plugin's onLoad method
await api.ui.registerComponent({
  id: 'my-component',
  name: 'My Component',
  type: 'modal',
  component: 'components/MyComponent.vue'
});
```

## Permissions

Plugins operate with limited permissions. Request only what you need:

- **`ui.modal`** - Show/hide modals and register components
- **`ui.toasts`** - Show toast notifications
- **`ui.commands`** - Add commands with hotkeys (Obsidian-like)
- **`ui.settings`** - Add settings tabs and inputs
- **`ui.actionSelector`** - Add action selector tabs and utilities
- **`ui.topBar`** - Add buttons to top bar
- **`storage.local`** - Local storage access
- **`system.audio`** - Audio system control
- **`system.midi`** - MIDI device access
- **`system.apps`** - Application management
- **`system.brightness`** - Screen brightness control
- **`system.rgb`** - RGB lighting control
- **`listeners.slider`** - Listen for slider value changes
- **`listeners.device`** - Listen for device connections/disconnections
- **`network.fetch`** - Network requests

## Best Practices

1. **Keep it simple** - Start with basic functionality
2. **Handle errors** - Always wrap API calls in try-catch
3. **Clean up** - Implement proper cleanup in `onUnload`
4. **Test thoroughly** - Test plugin loading, activation, and deactivation
5. **Follow conventions** - Use consistent naming and structure

## Next Steps

- Check out the [example plugins](../examples/) for more complex examples
- Read the [API Reference](./api-reference.md) for detailed API documentation
- Learn about [UI Components](./ui-components.md) for creating rich interfaces
- Explore [System Integration](./system-integration.md) for advanced features

## Troubleshooting

### Common Issues

1. **Import errors** - Check your `deno.json` imports configuration
2. **Permission denied** - Ensure you've requested the required permissions
3. **Component not found** - Verify component registration and file paths
4. **RPC timeout** - Check if the main app is responding

### Debug Tips

- Use `api.logger.debug()` for detailed logging
- Check the browser console for runtime errors
- Test with minimal permissions first
- Use the hello-world example as a reference 