<template>
  <div :class="isOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box w-full max-w-md">
      <!-- Modal header -->
      <h3 class="font-bold text-lg mb-4">{{ data && data.title ? data.title : 'Confirm Action' }}</h3>
      
      <!-- Modal content -->
      <p class="py-4">{{ data && data.message ? data.message : 'Are you sure?' }}</p>
      
      <!-- Modal buttons -->
      <div class="modal-action">
        <button 
          @click="confirm(false)" 
          class="btn"
        >
          {{ data && data.cancelText ? data.cancelText : 'Cancel' }}
        </button>
        <button 
          @click="confirm(true)" 
          :class="['btn', getConfirmButtonClass()]"
        >
          {{ data && data.confirmText ? data.confirmText : 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "PluginConfirmation",
  
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    data: {
      type: Object,
      default: null
    }
  },
  
  emits: ['close'],
  
  methods: {
    confirm(confirmed) {
      this.$emit('close', confirmed);
    },
    
    getConfirmButtonClass() {
      const type = this.data && this.data.type ? this.data.type : 'info';
      switch (type) {
        case 'danger': return 'btn-error';
        case 'warning': return 'btn-warning';
        default: return 'btn-primary';
      }
    }
  }
};
</script>

<style scoped>
/* Additional styles if needed */
</style> 