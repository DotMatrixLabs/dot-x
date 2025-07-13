import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import VueVirtualScroller from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import "@fortawesome/fontawesome-free/js/all";
import { createPinia } from 'pinia';

// Import plugin RPC server
import './rpc/start-plugin-server';

const toastOptions = {
  position: "bottom-right",
};

const app = createApp(App);

app.use(createPinia());
app.use(Toast, toastOptions);
app.use(VueVirtualScroller);

// Mount the app
app.mount("#app");

// Set up global plugin event handlers
window.addEventListener('plugin-ui-action', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin UI Action:', customEvent.detail);
  // Handle UI actions from plugins
  // TODO: Integrate with actual UI components
});

window.addEventListener('plugin-system-action', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin System Action:', customEvent.detail);
  // Handle system actions from plugins
  // TODO: Integrate with actual system controls
});

window.addEventListener('plugin-command-registered', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin Command Registered:', customEvent.detail);
  // Handle command registration from plugins
  // TODO: Add to command palette
});

window.addEventListener('plugin-command-unregistered', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin Command Unregistered:', customEvent.detail);
  // Handle command unregistration from plugins
  // TODO: Remove from command palette
});

window.addEventListener('plugin-connected', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin Connected:', customEvent.detail);
  // Handle plugin connection
  // TODO: Show notification or update UI
});

window.addEventListener('plugin-disconnected', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('Plugin Disconnected:', customEvent.detail);
  // Handle plugin disconnection
  // TODO: Show notification or update UI
});

