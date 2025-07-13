import { PluginRPCServer } from './plugin-rpc-server';

// Create and start the plugin RPC server
const server = new PluginRPCServer(8080);

// Start the server
server.start().then(() => {
  console.log('Plugin RPC Server started successfully on port 8080');
  
  // Set up event handlers for frontend integration
  server.onFrontendEvent('ui-action', (data) => {
    console.log('UI Action received:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-ui-action', { detail: data }));
  });
  
  server.onFrontendEvent('system-action', (data) => {
    console.log('System Action received:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-system-action', { detail: data }));
  });
  
  server.onFrontendEvent('command-registered', (data) => {
    console.log('Command registered:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-command-registered', { detail: data }));
  });
  
  server.onFrontendEvent('command-unregistered', (data) => {
    console.log('Command unregistered:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-command-unregistered', { detail: data }));
  });
  
  server.onFrontendEvent('plugin-connected', (data) => {
    console.log('Plugin connected:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-connected', { detail: data }));
  });
  
  server.onFrontendEvent('plugin-disconnected', (data) => {
    console.log('Plugin disconnected:', data);
    // Forward to main Vue app via custom events
    window.dispatchEvent(new CustomEvent('plugin-disconnected', { detail: data }));
  });
  
}).catch((error) => {
  console.error('Failed to start Plugin RPC Server:', error);
});

// Export the server instance
export default server; 