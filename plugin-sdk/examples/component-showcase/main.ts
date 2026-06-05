import Plugin, { runPlugin } from '@dotmatrixlabs/dotx-plugin-sdk';

/**
 * ComponentShowcase — exercises every settings builder component in the SDK.
 *
 * Sections:
 *  1. Status       — badge + text display (read-only state)
 *  2. Connection   — ip_address, number, switch, select (form inputs)
 *  3. Auth         — text, password (more form inputs)
 *  4. Info Banners — info component in all four styles
 *  5. Actions      — button (primary / secondary / danger) + link (with icons)
 *  6. Advanced     — mac_address, textarea, number with step (expandable)
 */
class ComponentShowcase extends Plugin {
  private uptimeTimer: ReturnType<typeof setInterval> | null = null;

  async onLoad() {
    // Seed defaults the first time the plugin runs
    this.config.init({
      defaults: {
        ip: '192.168.1.100',
        port: 1883,
        protocol: 'mqtt',
        enabled: true,
        username: 'admin',
        deviceMac: '',
        notes: '',
        sampleRate: 44100,
      },
    });

    await this.settingsPage.addSettings((settings) => {

      // ── 1. Status ────────────────────────────────────────────────────────
      settings.addSection('status')
        .setName('Status');

      const connectionBadge = settings.addBadge('connectionStatus')
        .setLabel('Connection')
        .setText('Connected')
        .setStyle('success');

      const uptimeText = settings.addText('uptime')
        .setLabel('Uptime')
        .setText('0 seconds')
        .setStyle('muted');

      // Update uptime every second once the settings page is open
      let seconds = 0;
      this.uptimeTimer = setInterval(() => {
        seconds++;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const label = h > 0
          ? `${h}h ${m}m ${s}s`
          : m > 0
          ? `${m}m ${s}s`
          : `${s}s`;
        uptimeText.setText(label);
      }, 1000);

      // ── 2. Connection ────────────────────────────────────────────────────
      settings.addSection('connection')
        .setName('Connection');

      settings.addSwitch('enabled')
        .setLabel('Enable Connection')
        .setValue(this.config.get('enabled', true))
        .onChange(({ value }) => {
          this.config.set('enabled', value);
          connectionBadge
            .setText(value ? 'Connected' : 'Disconnected')
            .setStyle(value ? 'success' : 'error');
        });

      settings.addInput('ip')
        .setType('ip_address')
        .setLabel('Broker IP')
        .setValue(this.config.get('ip'))
        .setPlaceholder('192.168.1.1')
        .setDesc('IPv4 address of the MQTT broker')
        .setRequired(true)
        .onChange(({ value }) => this.config.set('ip', value));

      settings.addInput('port')
        .setType('number')
        .setLabel('Port')
        .setValue(this.config.get('port'))
        .setMin(1)
        .setMax(65535)
        .setDesc('Default MQTT port is 1883')
        .onChange(({ value }) => this.config.set('port', value));

      settings.addSelect('protocol')
        .setLabel('Protocol')
        .setOptions([
          { value: 'mqtt', label: 'MQTT' },
          { value: 'mqtts', label: 'MQTT over TLS' },
          { value: 'ws', label: 'WebSocket' },
          { value: 'wss', label: 'WebSocket over TLS' },
        ])
        .setValue(this.config.get('protocol'))
        .setDesc('Transport protocol for the broker connection')
        .onChange(({ value }) => this.config.set('protocol', value));

      // ── 3. Authentication ────────────────────────────────────────────────
      settings.addSection('auth')
        .setName('Authentication');

      settings.addInput('username')
        .setType('text')
        .setLabel('Username')
        .setValue(this.config.get('username'))
        .setPlaceholder('Enter broker username')
        .onChange(({ value }) => this.config.set('username', value));

      settings.addInput('password')
        .setType('password')
        .setLabel('Password')
        .setPlaceholder('Enter broker password')
        .setDesc('Stored securely in your local config')
        .onChange(({ value }) => this.config.set('password', value));

      // ── 4. Info Banners ──────────────────────────────────────────────────
      settings.addSection('infobanners')
        .setName('Info Banners');

      settings.addInfo('infoDefault')
        .setText('This is a default (neutral) info banner.')
        .setStyle('default');

      settings.addInfo('infoInfo')
        .setText('Settings are saved automatically as you change them.')
        .setStyle('info');

      settings.addInfo('infoSuccess')
        .setText('Last connection test passed successfully.')
        .setStyle('success');

      settings.addInfo('infoWarning')
        .setText('TLS is disabled. Your credentials are sent in plaintext.')
        .setStyle('warning');

      settings.addInfo('infoError')
        .setText('Could not reach the broker. Check your IP and port.')
        .setStyle('error');

      // ── 5. Actions ───────────────────────────────────────────────────────
      settings.addSection('actions')
        .setName('Actions');

      settings.addButton('testConnection')
        .setLabel('Connection')
        .setTitle('Test Connection')
        .setStyle('primary')
        .setDesc('Sends a ping to verify connectivity')
        .onClick(async () => {
          await this.ui.showToast({ message: 'Pinging broker…', type: 'info', duration: 1500 });
        });

      settings.addButton('resetConfig')
        .setLabel('Configuration')
        .setTitle('Reset to Defaults')
        .setStyle('secondary')
        .setDesc('Restores all settings to their default values')
        .onClick(async () => {
          this.config.clear();
          await this.ui.showToast({ message: 'Settings reset', type: 'warning' });
        });

      settings.addButton('disconnect')
        .setLabel('Danger Zone')
        .setTitle('Force Disconnect')
        .setStyle('danger')
        .onClick(async () => {
          connectionBadge.setText('Disconnected').setStyle('error');
          await this.ui.showToast({ message: 'Disconnected', type: 'error' });
        });

      settings.addLink('docs')
        .setLabel('Documentation')
        .setHref('https://docs.dotmatrixlabs.com')
        .setText('Open Docs')
        .setIcon('fas fa-book');

      settings.addLink('github')
        .setLabel('Source Code')
        .setHref('https://github.com/dotmatrixlabs/dot-x')
        .setText('View on GitHub')
        .setIcon('fab fa-github');

      settings.addLink('support')
        .setLabel('Community')
        .setHref('https://discord.gg/dotmatrixlabs')
        .setText('Join Discord')
        .setIcon('fab fa-discord')
        .setDesc('Get help and share your plugins');

      // ── 6. Advanced (expandable) ─────────────────────────────────────────
      settings.addSection('advanced')
        .setName('Advanced')
        .setExpandable(true)
        .setExpanded(false);

      settings.addInput('deviceMac')
        .setType('mac_address')
        .setLabel('Device MAC')
        .setValue(this.config.get('deviceMac'))
        .setPlaceholder('AA:BB:CC:DD:EE:FF')
        .setDesc('Lock connection to a specific device MAC address')
        .onChange(({ value }) => this.config.set('deviceMac', value));

      settings.addInput('sampleRate')
        .setType('number')
        .setLabel('Poll Interval')
        .setValue(this.config.get('sampleRate'))
        .setMin(100)
        .setMax(10000)
        .setDesc('How often to poll the broker, in milliseconds')
        .onChange(({ value }) => this.config.set('sampleRate', value));

      settings.addInput('notes')
        .setType('textarea')
        .setLabel('Notes')
        .setValue(this.config.get('notes'))
        .setPlaceholder('Any notes about this setup…')
        .onChange(({ value }) => this.config.set('notes', value));

      settings.addInfo('advancedWarning')
        .setText('Changes here take effect on the next connection attempt.')
        .setStyle('warning');
    });

    await this.ui.showToast({
      message: 'Component Showcase loaded',
      type: 'success',
      duration: 2000,
    });
  }

  async onUnload() {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }
  }
}

if (require.main === module) {
  runPlugin(ComponentShowcase);
}
