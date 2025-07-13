import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

class PluginAPI {
  constructor(pluginId, socket) {
    this.pluginId = pluginId;
    this.socket = socket;
    this.messageId = 0;
    this.pendingRequests = new Map();
    
    // Set up message handling
    this.socket.on('rpc-message', (message) => {
      if (message.type === 'response' && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
    });
  }

  async sendRequest(method, params) {
    const id = `req-${++this.messageId}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.socket.emit('rpc-message', {
        id,
        type: 'request',
        method,
        params
      });
      
      // Add timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  // API methods
  get commands() {
    return {
      register: async (command) => {
        return await this.sendRequest('ui.commands.register', command);
      },
      unregister: async (commandId) => {
        return await this.sendRequest('ui.commands.unregister', { id: commandId });
      }
    };
  }

  get toasts() {
    return {
      show: async (message, options = {}) => {
        return await this.sendRequest('ui.toasts.show', { message, ...options });
      }
    };
  }

  get system() {
    return {
      volume: {
        set: async (level) => {
          return await this.sendRequest('system.volume.set', { level });
        },
        get: async () => {
          return await this.sendRequest('system.volume.get');
        }
      },
      rgb: {
        setColor: async (color) => {
          return await this.sendRequest('system.rgb.setColor', { color });
        },
        getColor: async () => {
          return await this.sendRequest('system.rgb.getColor');
        },
        setEffect: async (effect) => {
          return await this.sendRequest('system.rgb.setEffect', { effect });
        }
      }
    };
  }

  get logs() {
    return {
      info: async (message) => {
        console.log(`[${this.pluginId}] ${message}`);
        return true;
      },
      error: async (message) => {
        console.error(`[${this.pluginId}] ${message}`);
        return true;
      },
      warn: async (message) => {
        console.warn(`[${this.pluginId}] ${message}`);
        return true;
      }
    };
  }

  async destroy() {
    this.socket.disconnect();
  }
}

async function initPluginFromManifest(manifestPath) {
  // Read manifest
  const manifestContent = await Deno.readTextFile(manifestPath);
  const manifest = JSON.parse(manifestContent);
  
  // Connect to RPC server
  const socket = io('http://localhost:8080', {
    path: '/plugin-rpc',
    transports: ['websocket', 'polling']
  });
  
  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('Connected to plugin RPC server');
      resolve();
    });
    
    socket.on('connect_error', (error) => {
      console.error('Failed to connect to plugin RPC server:', error);
      reject(error);
    });
  });
  
  // Register plugin
  socket.emit('plugin-register', {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    permissions: manifest.permissions
  });
  
  // Wait for registration confirmation
  await new Promise((resolve) => {
    socket.on('rpc-message', (message) => {
      if (message.id === 'registration-confirm') {
        console.log('Plugin registered successfully');
        resolve();
      }
    });
  });
  
  return new PluginAPI(manifest.id, socket);
}

async function main() {
  try {
    // Initialize plugin from manifest.json
    const api = await initPluginFromManifest('./manifest.json');
    
    console.log('System Control Plugin initialized!');
    await api.logs.info('System Control Plugin started successfully');

    // Register volume control command
    await api.commands.register({
      id: 'system-control.volume-up',
      name: 'Volume Up',
      description: 'Increases system volume by 10%',
      hotkey: 'Ctrl+Alt+Up',
      icon: 'fas fa-volume-up',
      callback: async () => {
        try {
          const currentVolume = await api.system.volume.get();
          const newVolume = Math.min(100, currentVolume + 10);
          await api.system.volume.set(newVolume);
          await api.toasts.show(`Volume set to ${newVolume}%`, {
            type: 'success',
            duration: 2000
          });
        } catch (error) {
          await api.toasts.show('Failed to control volume', {
            type: 'error',
            duration: 3000
          });
        }
      }
    });

    // Register RGB control command
    await api.commands.register({
      id: 'system-control.rgb-rainbow',
      name: 'Rainbow RGB',
      description: 'Sets RGB lighting to rainbow effect',
      hotkey: 'Ctrl+Alt+R',
      icon: 'fas fa-palette',
      callback: async () => {
        try {
          await api.system.rgb.setEffect('rainbow');
          await api.toasts.show('RGB set to rainbow effect', {
            type: 'success',
            duration: 2000
          });
        } catch (error) {
          await api.toasts.show('Failed to control RGB', {
            type: 'error',
            duration: 3000
          });
        }
      }
    });

    // Register custom color command
    await api.commands.register({
      id: 'system-control.rgb-red',
      name: 'Red RGB',
      description: 'Sets RGB lighting to red',
      hotkey: 'Ctrl+Alt+Shift+R',
      icon: 'fas fa-circle',
      callback: async () => {
        try {
          await api.system.rgb.setColor({ r: 255, g: 0, b: 0 });
          await api.toasts.show('RGB set to red', {
            type: 'success',
            duration: 2000
          });
        } catch (error) {
          await api.toasts.show('Failed to control RGB', {
            type: 'error',
            duration: 3000
          });
        }
      }
    });

    // Show initial toast
    await api.toasts.show('System Control Plugin loaded successfully!', {
      type: 'success',
      duration: 2000
    });

    // Set up cleanup on plugin unload
    globalThis.addEventListener('beforeunload', async () => {
      await api.logs.info('System Control Plugin shutting down...');
      await api.commands.unregister('system-control.volume-up');
      await api.commands.unregister('system-control.rgb-rainbow');
      await api.commands.unregister('system-control.rgb-red');
      await api.destroy();
    });

  } catch (error) {
    console.error('Failed to initialize System Control Plugin:', error);
  }
}

// Start the plugin
main(); 