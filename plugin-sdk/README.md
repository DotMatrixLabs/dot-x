# DotX Plugin SDK

This SDK allows you to develop plugins for the DotX application.

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
    // Plugin initialization code
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
- Displays plugin name, version, description, and author
- Handles plugin instantiation and lifecycle
- Keeps the process alive for WebSocket connections
- Provides graceful shutdown on Ctrl+C
- Includes error handling and logging

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
