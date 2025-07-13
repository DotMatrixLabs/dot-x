import { initPluginFromManifest } from '../../api/index';

/**
 * {{PLUGIN_NAME}}
 * {{PLUGIN_DESCRIPTION}}
 */

let api: any;

async function main() {
  try {
    // Initialize plugin from manifest.json
    api = await initPluginFromManifest('./manifest.json');
    
    console.log('{{PLUGIN_NAME}} initialized!');
    await api.logs.info('{{PLUGIN_NAME}} started successfully');

    // Add commands (Obsidian-style)
    await api.commands.register({
      id: '{{PLUGIN_ID}}-main-action',
      name: '{{PLUGIN_NAME}} Main Action',
      description: 'Execute the main action for {{PLUGIN_NAME}}',
      hotkey: 'Ctrl+Shift+{{HOTKEY_LETTER}}',
      icon: 'fas fa-star',
      callback: async () => {
        await executeMainAction();
      }
    });
    
    // Initialize plugin
    await initialize();
    
    // Show load notification
    await api.toasts.show('{{PLUGIN_NAME}} is now active!', {
      type: 'success',
      duration: 3000
    });

    // Set up cleanup on plugin unload
    globalThis.addEventListener('beforeunload', async () => {
      await api.logs.info('{{PLUGIN_NAME}} shutting down...');
      await api.commands.unregister('{{PLUGIN_ID}}-main-action');
      await cleanup();
      await api.destroy();
    });

  } catch (error) {
    console.error('Failed to initialize {{PLUGIN_NAME}}:', error);
  }
}

/**
 * Initialize plugin
 */
async function initialize() {
  // Add your initialization logic here
  await api.logs.debug('Initializing {{PLUGIN_NAME}}...');
  
  // Example: Load settings from storage
  const settings = await api.storage.get('settings') || {};
  await api.logs.debug('Loaded settings: ' + JSON.stringify(settings));
}

/**
 * Clean up plugin resources
 */
async function cleanup() {
  // Add your cleanup logic here
  await api.logs.debug('Cleaning up {{PLUGIN_NAME}}...');
}

/**
 * Execute main action - called by command
 */
async function executeMainAction() {
  // Add your main action logic here
  await api.logs.info('Executing main action for {{PLUGIN_NAME}}...');
  await api.toasts.show('{{PLUGIN_NAME}} main action executed!', { 
    type: 'success',
    duration: 2000 
  });
}

// Start the plugin
main(); 