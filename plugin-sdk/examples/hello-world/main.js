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

  get storage() {
    return {
      get: async (key) => {
        return await this.sendRequest('storage.get', { key });
      },
      set: async (key, value) => {
        return await this.sendRequest('storage.set', { key, value });
      },
      remove: async (key) => {
        return await this.sendRequest('storage.remove', { key });
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
    
    console.log('Hello World Plugin initialized!');
    await api.logs.info('Hello World Plugin started successfully');

    // Register a command
    await api.commands.register({
      id: 'hello-world.say-hello',
      name: 'Say Hello',
      description: 'Shows a hello world toast message',
      hotkey: 'Ctrl+H',
      icon: 'fas fa-hand-wave',
      callback: async () => {
        await api.toasts.show('Hello from Hello World Plugin! 👋', {
          type: 'success',
          duration: 3000
        });
        await api.logs.info('Hello World command executed');
      }
    });

    // Register another command
    await api.commands.register({
      id: 'hello-world.greet-user',
      name: 'Greet User',
      description: 'Shows a personalized greeting',
      hotkey: 'Ctrl+Shift+G',
      icon: 'fas fa-user',
      callback: async () => {
        const userName = await api.storage.get('hello-world.username') || 'User';
        await api.toasts.show(`Hello ${userName}! Hope you're having a great day! 🌟`, {
          type: 'info',
          duration: 4000
        });
        await api.logs.info(`Greeted user: ${userName}`);
      }
    });

    // Set up a simple storage example
    await api.storage.set('hello-world.username', 'Plugin User');
    await api.storage.set('hello-world.initialized', true);

    // Show initial toast
    await api.toasts.show('Hello World Plugin loaded successfully!', {
      type: 'success',
      duration: 2000
    });

    // Set up cleanup on plugin unload
    globalThis.addEventListener('beforeunload', async () => {
      await api.logs.info('Hello World Plugin shutting down...');
      await api.commands.unregister('hello-world.say-hello');
      await api.commands.unregister('hello-world.greet-user');
      await api.destroy();
    });

  } catch (error) {
    console.error('Failed to initialize Hello World Plugin:', error);
  }
}

// Start the plugin
main(); 