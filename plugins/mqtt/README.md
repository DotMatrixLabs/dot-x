# MQTT Publisher Plugin

A DotX plugin that publishes device slider values to an MQTT broker in real-time with Home Assistant integration support.

## Features

- **Real-time Publishing**: Automatically publishes device slider value changes to MQTT topics
- **Home Assistant Integration**: Built-in MQTT Discovery support for automatic sensor creation
- **Channel Selection**: Use the system utility button to select which channels to publish
- **Rate Limiting**: Configurable rate limiting to prevent broker flooding
- **Authentication**: Support for username/password authentication
- **SSL/TLS**: Secure connections with SSL/TLS support
- **Auto-reconnect**: Automatic reconnection on connection loss
- **QoS Levels**: Configurable Quality of Service (0, 1, or 2)

## Installation

1. Copy the `mqtt-plugin` folder to your DotX plugins directory
2. Install dependencies:
   ```bash
   cd plugins/mqtt-plugin
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Restart DotX application
5. Enable the plugin in the plugins settings

## Configuration

### Connection Settings

- **Broker IP Address**: The IP address of your MQTT broker (e.g., `192.168.1.100`)
- **Broker Port**: The port number (default: `1883` for standard, `8883` for SSL)
- **Topic Prefix**: Base topic for all messages (default: `dotx`)

### Authentication (Optional)

- **Username**: MQTT broker username
- **Password**: MQTT broker password
- **Client ID**: Unique identifier for this client (auto-generated if not set)

### Advanced Settings

- **Enable SSL/TLS**: Use encrypted connection (remember to change port to 8883)
- **Keepalive Interval**: Seconds between keepalive packets (default: 60)
- **Quality of Service**: 
  - QoS 0: At most once
  - QoS 1: At least once
  - QoS 2: Exactly once
- **Clean Session**: Start with a clean session
- **Auto Reconnect**: Automatically reconnect on connection loss
- **Reconnect Interval**: Seconds between reconnection attempts (default: 5)
- **Publish Rate Limit**: Minimum milliseconds between publishes (default: 100)

### Channel Selection

Choose how to select which channels to publish:

- **Send All Channels**: All device slider changes are published automatically
- **Use System Util Button**: Use the "MQTT Channels" button to manually select which channels to publish

### Home Assistant Integration

Enable **Home Assistant Discovery** to automatically create sensor entities in Home Assistant.

When enabled:
- Sensors are created for each active channel
- Topic format: `homeassistant/sensor/dotx_device/ch{X}/config`
- State topics: `{topic_prefix}/channel/{X}`
- Each sensor shows the slider value as a percentage

## Usage

### Basic Operation

1. Configure your MQTT broker settings in the plugin settings page
2. Choose your channel selection mode (Send All or Use Button)
3. Click **Save Settings** to persist your configuration
4. Click **Connect** to establish connection to the broker
5. Device slider changes will be published based on your selection mode

### Channel Selection Modes

**Send All Channels Mode:**
- All device slider changes are automatically published to MQTT
- No need to select individual channels
- Simple and straightforward

**Button Selection Mode:**
1. Enable "Use System Util Button to Select Channels" in settings
2. Click the **MQTT Channels** button in the action mapper
3. Click the button on individual channels to toggle them on/off
4. Only selected channels will be published to MQTT
5. A toast notification shows your current selection

### Auto Connect

Enable **Auto Connect on Startup** to automatically connect to the broker when the plugin loads.

## MQTT Topics

### Standard Mode

When Home Assistant discovery is disabled:

```
{topic_prefix}/channel/{channel_index}
```

Payload format:
```json
{
  "value": "75.50"
}
```

### Home Assistant Mode

When Home Assistant discovery is enabled:

**Discovery Topic:**
```
homeassistant/sensor/dotx_device/ch{channel_index}/config
```

**State Topic:**
```
{topic_prefix}/channel/{channel_index}
```

Payload format (same as standard mode):
```json
{
  "value": "75.50"
}
```

## Examples

### Mosquitto Broker (Local)

```
Broker IP: 127.0.0.1
Port: 1883
Topic Prefix: dotx
Username: (leave empty)
Password: (leave empty)
```

### Home Assistant MQTT Broker

```
Broker IP: 192.168.1.50
Port: 1883
Topic Prefix: dotx
Username: mqtt_user
Password: your_password
Home Assistant Discovery: Enabled
```

### Secure Connection (SSL/TLS)

```
Broker IP: mqtt.example.com
Port: 8883
Enable SSL/TLS: On
Username: secure_user
Password: secure_password
```

## Troubleshooting

### Connection Fails

- Verify broker IP address and port
- Check that the MQTT broker is running
- Verify username/password if authentication is required
- Check firewall settings

### No Data Published

- Ensure the connection status shows "Connected"
- Check that channels are selected (or none selected for all channels)
- Verify the device is connected and sliders are changing
- Check publish rate limit setting

### Home Assistant Sensors Not Appearing

- Verify Home Assistant Discovery is enabled
- Check that MQTT integration is configured in Home Assistant
- Verify the broker connection in both DotX and Home Assistant
- Look at Home Assistant logs for discovery messages
- Restart Home Assistant if needed

## Development

### Build

```bash
npm run build
```

### Project Structure

```
mqtt-plugin/
├── main.ts              # Plugin entry point
├── src/
│   ├── mqtt-client.ts   # MQTT client wrapper
│   ├── homeassistant.ts # Home Assistant discovery
│   ├── settings.ts      # Settings UI builder
│   └── types.ts         # TypeScript interfaces
├── manifest.json        # Plugin metadata
└── package.json         # Dependencies
```

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please visit the DotX plugin documentation or create an issue in the plugin repository.

