# Plugin Templates

This directory contains template files for creating new plugins quickly.

## Available Templates

### Basic Template
- **Path**: `basic/`
- **Description**: A minimal plugin template with essential structure
- **Features**: Basic lifecycle methods, storage access, logging
- **Use Case**: Starting point for simple plugins

## Using Templates

To create a new plugin from a template:

1. Copy the template directory to your plugin development location
2. Replace the template variables with your plugin information:
   - `{{PLUGIN_ID}}` - Unique identifier for your plugin
   - `{{PLUGIN_NAME}}` - Human-readable name
   - `{{PLUGIN_DESCRIPTION}}` - Description of what your plugin does
   - `{{PLUGIN_AUTHOR}}` - Your name or organization
   - `{{PLUGIN_CLASS_NAME}}` - TypeScript class name (PascalCase)

3. Customize the `permissions` array in `plugin.json` based on your needs
4. Implement your plugin logic in the lifecycle methods

## Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{PLUGIN_ID}}` | Unique plugin identifier | `my-awesome-plugin` |
| `{{PLUGIN_NAME}}` | Display name | `My Awesome Plugin` |
| `{{PLUGIN_DESCRIPTION}}` | Plugin description | `Does awesome things` |
| `{{PLUGIN_AUTHOR}}` | Plugin author | `John Doe` |
| `{{PLUGIN_CLASS_NAME}}` | Class name | `MyAwesomePlugin` |

## Example

To create a weather plugin:

```bash
# Copy template
cp -r basic/ ../weather-plugin/

# Edit plugin.json
{
  "id": "weather-plugin",
  "name": "Weather Plugin",
  "description": "Shows current weather information",
  "author": "John Doe",
  // ... rest of config
}
```

Then implement your weather functionality in the lifecycle methods. 