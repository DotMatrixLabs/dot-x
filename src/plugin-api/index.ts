import { pluginAPIServer } from './server';

export { PluginAPIServer, pluginAPIServer } from './server';
export type { PluginAPI } from './schema';

// Convenience function to start the plugin server
export function startPluginServer(port: number = 3001) {
  pluginAPIServer.initialize();
  return pluginAPIServer;
}

// Convenience function to stop the plugin server
export function stopPluginServer() {
  pluginAPIServer.shutdown();
} 