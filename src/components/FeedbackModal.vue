<template>
  <div :class="open ? 'modal-open' : ''" class="modal h-full w-full">
    <div class="modal-box max-w-md">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-lg">Give feedback</h3>
        <button class="btn btn-ghost btn-xs btn-circle" :disabled="sending" @click="close">✕</button>
      </div>

      <div v-if="sent" class="flex flex-col items-center gap-3 py-6">
        <i class="fa-solid fa-circle-check text-4xl text-success"></i>
        <p class="text-center">Thanks for the feedback!</p>
      </div>

      <template v-else>
        <div class="join mt-4">
          <button v-for="option in typeOptions" :key="option.value" class="btn btn-sm join-item"
            :class="type === option.value ? 'btn-primary' : ''" :disabled="sending" @click="type = option.value">
            <i :class="option.icon"></i>{{ option.label }}
          </button>
        </div>
        <textarea v-model="description" class="textarea textarea-bordered w-full mt-3 h-32 resize-none"
          :maxlength="maxLength" :disabled="sending" :placeholder="placeholder"></textarea>
        <p class="text-xs opacity-60 mt-1">
          Your feedback is posted publicly on the DotMatrixLabs feedback board. The first line becomes its title.
        </p>
        <div v-if="errorMessage" class="alert alert-error text-sm mt-3 py-2">
          <span>{{ errorMessage }}</span>
        </div>
      </template>

      <div class="modal-action justify-between">
        <button class="btn btn-sm btn-ghost" @click="openLink('https://dml.gg/feedback')">
          See others' feedback<i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
        <button v-if="sent" class="btn btn-sm btn-primary" @click="close">Close</button>
        <button v-else class="btn btn-sm btn-primary" :disabled="sending || !description.trim()" @click="send">
          <span v-if="sending" class="loading loading-spinner loading-xs"></span>
          {{ errorMessage ? 'Retry' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { openLink } from '../ts/helpers.ts';
import { FEEDBACK_MAX_LENGTH, sendFeedback, type FeedbackType } from '../ts/feedback.ts';

export default {
  name: 'FeedbackModal',

  emits: ['close'],

  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      type: 'bug' as FeedbackType,
      description: '',
      sending: false,
      sent: false,
      errorMessage: '',
      maxLength: FEEDBACK_MAX_LENGTH,
      typeOptions: [
        { value: 'bug' as FeedbackType, label: 'Bug', icon: 'fa-solid fa-bug' },
        { value: 'feature' as FeedbackType, label: 'Feature', icon: 'fa-solid fa-lightbulb' },
      ],
    };
  },

  computed: {
    placeholder(): string {
      return this.type === 'bug'
        ? 'What went wrong, and what did you expect to happen?'
        : 'What would you like Dot X to do?';
    },
  },

  methods: {
    openLink,
    async send() {
      this.sending = true;
      this.errorMessage = '';
      try {
        await sendFeedback(this.type, this.description);
        this.sent = true;
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Sending feedback failed. Please try again.';
      } finally {
        this.sending = false;
      }
    },
    // An unsent draft survives closing; only a successful send clears it.
    close() {
      if (this.sent) {
        this.description = '';
        this.sent = false;
      }
      this.errorMessage = '';
      this.$emit('close');
    },
  },
};
</script>
