<template>
  <div :class="isOpen ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box overflow-hidden w-full max-w-xl">
      <!-- Close button -->
      <button 
        v-if="!data || data.closable !== false" 
        @click="close(false)" 
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
      >
        <i class="fa-solid fa-xmark"/>
      </button>
      
      <!-- Modal header -->
      <h1 class="font-bold text-lg text-center mb-4">{{ data && data.title ? data.title : 'Plugin Modal' }}</h1>
      
      <!-- Modal content -->
      <div class="mb-6">
        <div v-if="data && typeof data.content === 'string'" v-html="data.content"></div>
        <div v-else>{{ data && data.content ? data.content : '' }}</div>
      </div>
      
      <!-- Modal buttons -->
      <div class="modal-action">
        <template v-if="data && data.buttons && data.buttons.length > 0">
          <button 
            v-for="(button, index) in data.buttons" 
            :key="index"
            @click="handleButtonClick(button)"
            :class="['btn', getButtonClass(button)]"
          >
            {{ button.label || 'Button' }}
          </button>
        </template>
        <template v-else>
          <button @click="close(false)" class="btn">Cancel</button>
          <button @click="close(true)" class="btn btn-primary">OK</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "PluginModal",
  
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
    close(confirmed = false) {
      const result = {
        button: confirmed ? 'confirm' : 'cancel',
        cancelled: !confirmed,
        data: null
      };
      this.$emit('close', result);
    },
    
    handleButtonClick(button) {
      const result = {
        button: button.label || button.value || 'unknown',
        cancelled: false,
        data: button.value || null
      };
      this.$emit('close', result);
    },
    
    getButtonClass(button) {
      if (button.type === 'primary') return 'btn-primary';
      if (button.type === 'danger') return 'btn-error';
      if (button.type === 'warning') return 'btn-warning';
      return '';
    }
  }
};
</script>

<style scoped>
/* Additional styles if needed */
</style> 