<template>
  <div class="flex flex-col items-center h-full w-full gap-4">
    
    <!-- Plugin Settings Header -->
    <div class="flex flex-row w-full justify-between px-2 mt-4">
      <span class="text-lg font-bold">Plugin Settings</span>
    </div>

    <!-- Toast Examples -->
    <div class="divider">Toast Examples</div>
    <div class="flex flex-wrap gap-2 justify-center">
      <button @click="testToastInfo" class="btn btn-sm">Info Toast</button>
      <button @click="testToastSuccess" class="btn btn-sm btn-success">Success Toast</button>
      <button @click="testToastWarning" class="btn btn-sm btn-warning">Warning Toast</button>
      <button @click="testToastError" class="btn btn-sm btn-error">Error Toast</button>
    </div>

    <!-- Modal Examples -->
    <div class="divider">Modal Examples</div>
    <div class="flex flex-wrap gap-2 justify-center">
      <button @click="testSimpleModal" class="btn btn-sm">Simple Modal</button>
      <button @click="testCustomModal" class="btn btn-sm">Custom Buttons</button>
      <button @click="testConfirmation" class="btn btn-sm">Confirmation</button>
    </div>

    <!-- Theme Examples -->
    <div class="divider">Theme Examples</div>
    <div class="flex flex-wrap gap-2 justify-center">
      <button @click="setDarkTheme" class="btn btn-sm">Dark Theme</button>
      <button @click="setLightTheme" class="btn btn-sm">Light Theme</button>
    </div>

    <!-- Progress Examples -->
    <div class="divider">Progress Examples</div>
    <div class="flex flex-wrap gap-2 justify-center">
      <button @click="showProgress" class="btn btn-sm">Show Progress</button>
      <button @click="simulateProgress" class="btn btn-sm">Simulate Loading</button>
    </div>

    <!-- Results -->
    <div v-if="lastResult" class="mt-4 p-4 bg-base-200 rounded">
      <h4 class="font-bold">Last Result:</h4>
      <pre>{{ lastResult }}</pre>
    </div>

  </div>
</template>

<script>
import { 
  pluginToast, 
  showPluginModal, 
  confirmPlugin, 
  setPluginTheme, 
  updatePluginProgress 
} from '../plugin-api/pluginHelpers';

export default {
  name: "PluginSettings",

  data() {
    return {
      lastResult: null
    };
  },

  methods: {
    // Toast examples
    testToastInfo() {
      pluginToast.info("This is an info message from Settings!");
    },

    testToastSuccess() {
      pluginToast.success("Settings saved successfully!", 3000);
    },

    testToastWarning() {
      pluginToast.warning("This is a warning from Settings!");
    },

    testToastError() {
      pluginToast.error("This is an error message!");
    },

    // Modal examples
    async testSimpleModal() {
      try {
        const result = await showPluginModal({
          title: "Settings Modal",
          content: "This modal was triggered from the Settings tab!",
          size: "medium"
        });
        this.lastResult = `Modal result: ${JSON.stringify(result)}`;
      } catch (error) {
        this.lastResult = `Modal error: ${error}`;
      }
    },

    async testCustomModal() {
      try {
        const result = await showPluginModal({
          title: "Custom Settings",
          content: "Choose your preferred settings:",
          buttons: [
            { label: "Save", type: "primary", value: "save" },
            { label: "Reset", type: "warning", value: "reset" },
            { label: "Cancel", type: "", value: "cancel" }
          ]
        });
        this.lastResult = `Custom modal result: ${JSON.stringify(result)}`;
      } catch (error) {
        this.lastResult = `Custom modal error: ${error}`;
      }
    },

    async testConfirmation() {
      try {
        const confirmed = await confirmPlugin(
          "Reset Settings",
          "Are you sure you want to reset all plugin settings to default?",
          "Reset",
          "Keep Current"
        );
        this.lastResult = `Confirmation result: ${confirmed}`;
        
        if (confirmed) {
          pluginToast.success("Settings reset successfully!");
        } else {
          pluginToast.info("Settings kept unchanged.");
        }
      } catch (error) {
        this.lastResult = `Confirmation error: ${error}`;
      }
    },

    // Theme examples
    setDarkTheme() {
      setPluginTheme("dark");
    },

    setLightTheme() {
      setPluginTheme("light");
    },

    // Progress examples
    showProgress() {
      updatePluginProgress(75, "Loading settings...");
    },

    async simulateProgress() {
      for (let i = 0; i <= 100; i += 10) {
        updatePluginProgress(i, `Processing... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      pluginToast.success("Process completed!");
    }
  }
};
</script>

<style scoped>
pre {
  font-size: 12px;
  max-width: 300px;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
</style> 