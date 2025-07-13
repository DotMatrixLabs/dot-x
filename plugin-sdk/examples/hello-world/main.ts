import { initPluginFromManifest } from '../../api/index';

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