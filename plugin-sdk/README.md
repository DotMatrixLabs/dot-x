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

```typescript
import Plugin from 'plugin-sdk';

export default class MyPlugin extends Plugin {
  async onLoad() {
    // Plugin initialization code
    console.log('Plugin loaded!');
  }
  
  async onUnload() {
    // Cleanup code
    console.log('Plugin unloaded!');
  }
}
```

## API Reference

### Settings API

#### `settings.addButton(config)`

Add a button to the settings panel.

```typescript
const button = await this.settings.addButton({
  title: "My Button",
  icon: "fa-icon-name" // optional FontAwesome icon
});

button.onPress(() => {
  console.log("Button clicked!");
});
```

#### `settings.addInput(config)`

Add an input field to the settings panel.

```typescript
const input = await this.settings.addInput({
  label: "Enter value",
  type: "text" // "text" | "password" | "number"
});

const value = input.getValue();
```

### UI API

#### `ui.showNotification(message)`

Show a notification to the user.

```typescript
await this.ui.showNotification("Hello from plugin!");
```

#### `ui.openModal(content)`

Open a modal with custom content.

```typescript
await this.ui.openModal("<h1>Custom Modal Content</h1>");
```

## Development

To regenerate types after API changes:

```bash
npm run generate-types
```

## Example Plugin

See `plugins/hello-world/main.ts` for a complete example.
