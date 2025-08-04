<!--
This is the main plugin component. It is used to show plugin actions on top of the main app view, such as toast notifications, modal dialogs, etc...
-->
<template>
  <div>
  </div>
</template>

<script>
import { useToast } from "vue-toastification";
import EventBus from "../js/eventBus";

export default {
  name: "Plugin",
  
  components: {
  },
  
  data() {
    return {
      toast: null
    };
  },
  
  mounted() {
    this.toast = useToast();
    
    EventBus.on('plugin:showToast', this.showToast);
  },
  
  beforeUnmount() {
    EventBus.off('plugin:showToast', this.showToast);
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
  }
};
</script>

<style scoped>
/* Plugin styles if needed */
</style> 