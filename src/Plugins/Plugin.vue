<!--
This is the main plugin component. It is used to show plugin actions on top of the main app view, such as toast notifications, modal dialogs, etc...
-->
<template>
  <div>
  </div>
</template>

<script>
import { toast } from "vue-sonner";
import EventBus from "../js/eventBus";

export default {
  name: "Plugin",
  
  components: {
  },
  
  mounted() {
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
      const options = duration ? { duration } : {};

      switch (type) {
        case 'success':
          toast.success(message, options);
          break;
        case 'warning':
          toast.warning(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        default:
          toast.info(message, options);
          break;
      }
    },
  }
};
</script>

<style scoped>
/* Plugin styles if needed */
</style> 