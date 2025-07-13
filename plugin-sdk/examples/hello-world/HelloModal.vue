<template>
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ title }}</h3>
      <p class="py-4">{{ message }}</p>
      
      <div class="stats shadow mb-4">
        <div class="stat">
          <div class="stat-title">Plugin Visits</div>
          <div class="stat-value">{{ visits }}</div>
          <div class="stat-desc">Times this plugin has been loaded</div>
        </div>
      </div>
      
      <div class="form-control">
        <label class="label">
          <span class="label-text">Your name:</span>
        </label>
        <input 
          v-model="userName" 
          type="text" 
          placeholder="Enter your name" 
          class="input input-bordered"
        />
      </div>
      
      <div class="modal-action">
        <button class="btn btn-primary" @click="sayHello">
          Say Hello
        </button>
        <button class="btn btn-secondary" @click="close">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HelloModal',
  props: {
    title: {
      type: String,
      default: 'Hello World!'
    },
    message: {
      type: String,
      default: 'Welcome to the Hello World plugin!'
    }
  },
  data() {
    return {
      userName: '',
      visits: 0
    };
  },
  async mounted() {
    // Load visits from storage
    this.visits = await this.$pluginAPI.storage.get('visits') || 0;
    
    // Load saved username
    this.userName = await this.$pluginAPI.storage.get('userName') || '';
  },
  methods: {
    async sayHello() {
      if (!this.userName.trim()) {
        this.$pluginAPI.ui.showToast('Please enter your name first!', {
          type: 'warning'
        });
        return;
      }
      
      // Save username
      await this.$pluginAPI.storage.set('userName', this.userName);
      
      // Show personalized greeting
      this.$pluginAPI.ui.showToast(`Hello, ${this.userName}! 👋`, {
        type: 'success',
        duration: 3000
      });
      
      this.$pluginAPI.logger.info(`Said hello to ${this.userName}`);
    },
    
    close() {
      this.$pluginAPI.ui.hideModal('hello-modal');
    }
  }
};
</script>

<style scoped>
.modal-box {
  max-width: 400px;
}
</style> 