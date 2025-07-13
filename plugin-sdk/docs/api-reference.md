# DotX Plugin SDK API Reference

This document provides detailed information about all available APIs in the DotX Plugin SDK.

## Core API

### Logger API

The logger provides different levels of logging for debugging and monitoring.

```typescript
api.logger.debug('Debug message');
api.logger.info('Information message');
api.logger.warn('Warning message');
api.logger.error('Error message');
```

### Storage API

Persistent storage for plugin data.

```typescript
// Get value
const value = await api.storage.get('key');

// Set value
await api.storage.set('key', 'value');

// Remove value
await api.storage.remove('key');

// Clear all storage
await api.storage.clear();
```

### RPC API

Low-level communication with the main application.

```typescript
// Send request and wait for response
const result = await api.rpc.request('method', { param: 'value' });

// Send notification (no response)
api.rpc.notify('method', { param: 'value' });

// Subscribe to notifications
api.rpc.subscribe('method', (data) => {
  console.log('Received:', data);
});

// Unsubscribe
api.rpc.unsubscribe('method', callback);
```

## Command API

### Commands (Obsidian-style)

Add commands that users can execute via hotkeys or command palette.

```typescript
// Add a command
await api.commands.addCommand({
  id: 'my-plugin-action',
  name: 'My Plugin Action',
  description: 'Does something useful',
  hotkey: 'Ctrl+Shift+M',
  icon: 'fas fa-magic',
  callback: async () => {
    api.ui.showToast('Command executed!');
  }
});

// Remove a command
await api.commands.removeCommand('my-plugin-action');

// Execute a command programmatically
await api.commands.executeCommand('my-plugin-action');
```

**Command Properties:**
- `id`: Unique command identifier
- `name`: Display name in command palette
- `description`: Optional description
- `hotkey`: Optional keyboard shortcut (e.g., 'Ctrl+Shift+M')
- `icon`: Optional FontAwesome icon class
- `callback`: Function to execute when command is triggered

## UI API

> **Note:** All UI API calls tell the main DotX application what to create via RPC. The plugin does not create UI components directly - instead it sends instructions to the main app which creates the actual UI elements.

### Toast Notifications

Show temporary notifications to users.

```typescript
api.ui.showToast('Success message', {
  type: 'success',
  duration: 3000,
  position: 'top-right'
});
```

**Options:**
- `type`: 'info' | 'success' | 'warning' | 'error'
- `duration`: number (milliseconds)
- `position`: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

### Modal System

Show and hide modal dialogs.

```typescript
// Register a modal component
await api.ui.registerComponent({
  id: 'my-modal',
  name: 'My Modal',
  type: 'modal',
  component: 'MyModal.vue'
});

// Show modal
const result = await api.ui.showModal('my-modal', {
  title: 'Hello',
  message: 'World'
});

// Hide modal
await api.ui.hideModal('my-modal');
```

### Action Selector

Add tabs and system utilities to the action selector.

```typescript
// Add a new tab
await api.ui.actionSelector.addTab({
  id: 'my-tab',
  name: 'My Tab',
  icon: 'fas fa-star',
  component: 'MyTab.vue',
  order: 100
});

// Add system utility
await api.ui.actionSelector.addSystemUtility({
  id: 'my-utility',
  name: 'My Utility',
  icon: 'fas fa-cog',
  action: 'my-action'
});

// Add settings to a tab
await api.ui.actionSelector.addTabSettings('my-tab', {
  inputs: [
    {
      id: 'setting1',
      type: 'boolean',
      label: 'Enable Feature',
      value: true
    }
  ]
});
```

### Settings System

Add settings tabs and input controls.

```typescript
// Add settings tab
await api.ui.settings.addTab({
  id: 'my-settings',
  name: 'My Settings',
  icon: 'fas fa-cog',
  inputs: [
    {
      id: 'text-input',
      type: 'text',
      label: 'Text Input',
      placeholder: 'Enter text...'
    },
    {
      id: 'number-input',
      type: 'number',
      label: 'Number Input',
      min: 0,
      max: 100,
      step: 1
    },
    {
      id: 'boolean-input',
      type: 'boolean',
      label: 'Boolean Input',
      value: false
    },
    {
      id: 'select-input',
      type: 'select',
      label: 'Select Input',
      options: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' }
      ]
    },
    {
      id: 'color-input',
      type: 'color',
      label: 'Color Input',
      value: '#ff0000'
    },
    {
      id: 'range-input',
      type: 'range',
      label: 'Range Input',
      min: 0,
      max: 100,
      value: 50
    }
  ]
});

// Add inputs to existing settings
await api.ui.settings.addInputs([
  {
    id: 'new-input',
    type: 'text',
    label: 'New Input'
  }
]);

// Get setting value
const value = await api.ui.settings.getValue('my-setting');

// Set setting value
await api.ui.settings.setValue('my-setting', 'new-value');
```

### Top Bar

Add buttons to the application's top bar.

```typescript
// Add button
await api.ui.topBar.addButton({
  id: 'my-button',
  icon: 'fas fa-star',
  tooltip: 'My Button',
  action: 'my-action',
  order: 100
});

// Remove button
await api.ui.topBar.removeButton('my-button');

// Update button
await api.ui.topBar.updateButton('my-button', {
  disabled: true,
  tooltip: 'Updated tooltip'
});
```

## System API

### Audio System

Control audio sessions and devices.

```typescript
// Get all audio sessions
const sessions = await api.system.audio.getSessions();

// Set application volume
await api.system.audio.setVolume('Discord', 0.5);

// Get audio devices
const devices = await api.system.audio.getDevices();
```

### MIDI System

Access MIDI devices and send messages.

```typescript
// Get available MIDI ports
const ports = await api.system.midi.getPorts();

// Connect to MIDI device
await api.system.midi.connect('My MIDI Device');

// Send MIDI message
await api.system.midi.send([144, 60, 127]); // Note on, middle C, velocity 127
```

### RGB System

Control RGB lighting.

```typescript
// Set RGB color
await api.system.rgb.setRGB({
  r: 255,
  g: 0,
  b: 0
});

// Set RGB effect
await api.system.rgb.setEffect({
  type: 'rainbow',
  speed: 50,
  brightness: 80
});

// Get current RGB color
const color = await api.system.rgb.getRGB();

// Get current RGB effect
const effect = await api.system.rgb.getEffect();
```

**RGB Effect Types:**
- `static`: Static color
- `breathing`: Breathing effect
- `rainbow`: Rainbow cycle
- `wave`: Wave effect
- `ripple`: Ripple effect
- `custom`: Custom effect

### Apps System

Get information about installed applications.

```typescript
// Get installed applications
const apps = await api.system.apps.getInstalled();

// Get active application
const activeApp = await api.system.apps.getActive();
```

### Brightness System

Control screen brightness.

```typescript
// Set brightness for all screens
await api.system.brightness.set(80);

// Set brightness for specific screens
await api.system.brightness.set(80, ['Screen1', 'Screen2']);
```

### Event Listeners

Listen for system events.

```typescript
// Listen for slider changes
api.system.listeners.onSliderChange((event) => {
  console.log('Slider changed:', event.sliderId, event.value);
});

// Listen for device connections
api.system.listeners.onDeviceConnected((device) => {
  console.log('Device connected:', device.deviceName);
});

// Listen for device disconnections
api.system.listeners.onDeviceDisconnected((device) => {
  console.log('Device disconnected:', device.deviceName);
});

// Remove listeners
api.system.listeners.removeSliderListener(callback);
api.system.listeners.removeDeviceListener(callback);
```

## Plugin Lifecycle

### Plugin Interface

All plugins must implement the Plugin interface:

```typescript
interface Plugin {
  metadata: PluginMetadata;
  onLoad?(): Promise<void> | void;
  onUnload?(): Promise<void> | void;
  onActivate?(): Promise<void> | void;
  onDeactivate?(): Promise<void> | void;
}
```

### Lifecycle Methods

- **`onLoad()`**: Called when plugin is loaded
- **`onUnload()`**: Called when plugin is unloaded
- **`onActivate()`**: Called when plugin is activated
- **`onDeactivate()`**: Called when plugin is deactivated

### Plugin Metadata

```typescript
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  dotxVersion: string;
  permissions: PluginPermission[];
  main: string;
  ui?: UIComponentDefinition[];
}
```

## Permissions

Plugins must request permissions for system access:

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

## Error Handling

Always wrap API calls in try-catch blocks:

```typescript
try {
  await api.system.audio.setVolume('Discord', 0.5);
} catch (error) {
  api.logger.error('Failed to set volume:', error);
}
```

## Best Practices

1. **Request minimal permissions** - Only request what you need
2. **Handle errors gracefully** - Always wrap API calls in try-catch
3. **Clean up resources** - Remove event listeners and UI elements in onUnload
4. **Use TypeScript** - Take advantage of type safety
5. **Log appropriately** - Use different log levels for different types of messages 