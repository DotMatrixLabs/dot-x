<template>
  <div>
    <!-- Plugin Modal -->
    <PluginModal 
      :is-open="pluginUI.isModalOpen.value" 
      :data="pluginUI.modalData.value" 
      @close="pluginUI.closeModal" 
    />
    
    <!-- Plugin Confirmation -->
    <PluginConfirmation 
      :is-open="pluginUI.isConfirmationOpen.value" 
      :data="pluginUI.confirmationData.value" 
      @close="pluginUI.closeConfirmation" 
    />
  </div>
</template>

<script>
import PluginModal from "./PluginModal.vue";
import PluginConfirmation from "./PluginConfirmation.vue";
import { usePluginUI } from "../composables/usePluginUI";

export default {
  name: "Plugin",
  
  components: {
    PluginModal,
    PluginConfirmation
  },
  
  data() {
    return {
      pluginUI: usePluginUI()
    };
  }
};
</script>

<style scoped>
/* Plugin styles if needed */
</style> 