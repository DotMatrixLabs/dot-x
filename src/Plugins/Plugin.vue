<template>
  <div>
    <!-- Plugin Modal -->
    <PluginModal 
      :is-open="isModalOpen" 
      :data="modalData" 
      @close="closeModal" 
    />
    
    <!-- Plugin Confirmation -->
    <PluginConfirmation 
      :is-open="isConfirmationOpen" 
      :data="confirmationData" 
      @close="closeConfirmation" 
    />
  </div>
</template>

<script>
import PluginModal from "./PluginModal.vue";
import PluginConfirmation from "./PluginConfirmation.vue";
import { useToast } from "vue-toastification";

export default {
  name: "Plugin",
  
  components: {
    PluginModal,
    PluginConfirmation
  },
  
  data() {
    return {
      // Modal state
      isModalOpen: false,
      modalData: null,
      modalPromiseResolve: null,
      
      // Confirmation state
      isConfirmationOpen: false,
      confirmationData: null,
      confirmationPromiseResolve: null,
      
      // Toast instance
      toast: null
    };
  },
  
  mounted() {
    this.toast = useToast();
    
    // Register this instance globally so the plugin API can access it
    window.pluginUIInstance = this;
  },
  
  beforeUnmount() {
    // Clean up global reference
    if (window.pluginUIInstance) {
      window.pluginUIInstance = null;
    }
  },
  
  methods: {
    /**
     * Show toast notification
     */
    showToast(data) {
      const { message, type = 'info', duration } = data;
      const options = duration ? { timeout: duration } : {};
      
      switch (type) {
        case 'success':
          this.toast.success(message, options);
          break;
        case 'warning':
          this.toast.warning(message, options);
          break;
        case 'error':
          this.toast.error(message, options);
          break;
        default:
          this.toast.info(message, options);
          break;
      }
    },

    /**
     * Show modal dialog
     */
    showModal(data) {
      return new Promise((resolve) => {
        this.modalData = data;
        this.modalPromiseResolve = resolve;
        this.isModalOpen = true;
      });
    },

    /**
     * Close modal and resolve promise
     */
    closeModal(result = { button: 'cancel', cancelled: true }) {
      this.isModalOpen = false;
      if (this.modalPromiseResolve) {
        this.modalPromiseResolve(result);
        this.modalPromiseResolve = null;
      }
      this.modalData = null;
    },

    /**
     * Show confirmation dialog
     */
    showConfirmation(data) {
      return new Promise((resolve) => {
        this.confirmationData = data;
        this.confirmationPromiseResolve = resolve;
        this.isConfirmationOpen = true;
      });
    },

    /**
     * Close confirmation and resolve promise
     */
    closeConfirmation(confirmed) {
      this.isConfirmationOpen = false;
      if (this.confirmationPromiseResolve) {
        this.confirmationPromiseResolve(confirmed);
        this.confirmationPromiseResolve = null;
      }
      this.confirmationData = null;
    },

    /**
     * Show alert (as toast for now)
     */
    showAlert(data) {
      this.showToast({
        message: `${data.title}: ${data.message}`,
        type: data.type
      });
    },

    /**
     * Show custom dialog
     */
    showDialog(data) {
      // For now, use showModal - can be enhanced later
      return this.showModal({
        title: data.title,
        content: data.content,
        buttons: data.buttons,
        size: 'medium'
      });
    },

    /**
     * Hide current modal
     */
    hideModal() {
      this.closeModal();
    },

    /**
     * Update progress (show as toast for now, can be enhanced with progress bars)
     */
    updateProgress(data) {
      this.showToast({
        message: `Progress: ${data.value}%${data.message ? ` - ${data.message}` : ''}`,
        type: 'info'
      });
    },

    /**
     * Set theme
     */
    setTheme(data) {
      document.documentElement.setAttribute("data-theme", data.theme);
      this.showToast({
        message: `Theme set to ${data.theme}`,
        type: 'success'
      });
    }
  }
};
</script>

<style scoped>
/* Plugin styles if needed */
</style> 