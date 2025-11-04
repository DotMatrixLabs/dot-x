# RGB Demo Plugin

A comprehensive demonstration plugin for controlling the Decker device's 8 RGB LEDs using the Dot X Plugin SDK.

## Features

### RGB Control Methods
- ✅ `setEffect(effect, speed, brightness, color)` - Set complete RGB effect with all parameters
- ✅ `setBrightness(brightness)` - Adjust brightness while keeping other settings
- ✅ `setColor(color)` - Change color while keeping other settings
- ✅ `setSpeed(speed)` - Adjust animation speed while keeping other settings
- ✅ `turnOff()` - Quickly turn off all RGB lights
- ✅ `getAvailableEffects()` - Get list of available effects
- ✅ `getCurrentState()` - Get current RGB settings

### Available Effects
1. **Rainbow** - Smooth color cycling across the spectrum
2. **Static** - Solid color display
3. **Off** - All LEDs turned off
4. **Lightning Storm** - Random lightning-like flashes
5. **Candle** - Flickering candlelight effect
6. **Perimeter** - Running lights around the perimeter
7. **Breathing** - Slow fade in/out effect

### Plugin Features

#### Settings Page
- Effect selector dropdown
- Speed control (0-100)
- Brightness control (0-100)
- Color picker for custom colors
- Apply button to update settings
- Turn off button
- Quick preset buttons:
  - 🌈 Rainbow
  - 🚨 Red Alert
  - 🕯️ Candlelight
  - ⚡ Lightning Storm

#### Action Mapper Button
- **RGB Cycle** button in System Utilities
- Click to cycle through all available effects
- Toggle on/off to enable/disable RGB
- Shows current effect in toast notification

#### Device Update Integration
- Responds to slider changes
- Maps slider 0 value (0-100) to color hue (0-360)
- Dynamically changes RGB color based on device input

## Testing Checklist

### ✅ Core RGB Methods
- [x] `setEffect()` - Changes RGB effect with all parameters
- [x] `setBrightness()` - Updates brightness only
- [x] `setColor()` - Updates color only
- [x] `setSpeed()` - Updates speed only
- [x] `turnOff()` - Turns off RGB lights
- [x] `getAvailableEffects()` - Returns array of effects

### ✅ All RGB Effects
- [x] Rainbow effect
- [x] Static color effect
- [x] Off (lights disabled)
- [x] Lightning Storm effect
- [x] Candle flicker effect
- [x] Perimeter running lights
- [x] Breathing fade effect

### ✅ Settings UI
- [x] Effect dropdown populated with available effects
- [x] Speed input (0-100 range)
- [x] Brightness input (0-100 range)
- [x] Color picker
- [x] Apply button functionality
- [x] Turn off button functionality
- [x] Preset buttons (Rainbow, Red Alert, Candlelight, Storm)

### ✅ Action Mapper Integration
- [x] RGB Cycle button created
- [x] Click cycles through effects
- [x] Toggle on/off controls RGB state
- [x] Toast notifications display current effect

### ✅ Device Integration
- [x] onDeviceUpdate responds to slider changes
- [x] Slider 0 controls RGB color hue
- [x] Dynamic color mapping (0-100 → 0-360 hue)

### ✅ Plugin Lifecycle
- [x] onLoad initializes RGB settings
- [x] onUnload turns off RGB lights
- [x] Config storage saves/loads settings

### ✅ Build & Compilation
- [x] TypeScript compiles without errors
- [x] Esbuild bundles successfully
- [x] No linter errors
- [x] main.js generated

## Installation

1. Copy the `rgb-demo` folder to your `plugins` directory
2. Install dependencies:
   ```bash
   cd plugins/rgb-demo
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Enable the plugin in Dot X

## Usage

### From Settings Page
1. Open plugin settings in Dot X
2. Select an effect from the dropdown
3. Adjust speed, brightness, and color
4. Click "Apply Settings"

### Using Presets
1. Open Advanced section
2. Click any preset button for instant effects:
   - Rainbow: Full spectrum at high speed
   - Red Alert: Breathing red effect
   - Candlelight: Warm flickering orange
   - Lightning Storm: Intense white flashes

### Action Mapper Button
1. Go to System Utilities in any slider
2. Add the "RGB Cycle" action
3. Toggle to cycle through effects
4. Turn off to disable RGB

### Programmatic Control
```typescript
// Set rainbow effect
await this.rgb.setEffect('rainbow', 75, 100, '#FFFFFF');

// Just change brightness
await this.rgb.setBrightness(50);

// Just change color
await this.rgb.setColor('#FF0000');

// Turn off
await this.rgb.turnOff();

// Get available effects
const effects = this.rgb.getAvailableEffects();
```

## API Documentation

The RGB Demo plugin showcases all methods from the `RGBController` class:

- **setEffect(effect, speed, brightness, color)**: Complete RGB control
- **setBrightness(brightness)**: Update brightness (0-100)
- **setColor(color)**: Update color (hex format, e.g., '#FF0000')
- **setSpeed(speed)**: Update animation speed (0-100)
- **turnOff()**: Disable all RGB lights
- **getAvailableEffects()**: Get array of available effect names
- **getCurrentState()**: Get current RGB configuration

## Development

To modify the plugin:

1. Edit `main.ts`
2. Run `npm run build` to compile
3. Reload the plugin in Dot X

## License

MIT

