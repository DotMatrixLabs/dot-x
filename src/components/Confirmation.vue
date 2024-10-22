<template>
    <div :class="[modalOpen ? 'modal-open' : '', 'modal h-full w-full']">
        <div class="modal-box">
            <h3 class="font-bold text-lg">{{ confirmationDetails.title }}</h3>
            <p class="py-4">{{ confirmationDetails.message }}
            </p>
            <div class="modal-action">
                <button @click="closeConfirmation" :class="cancelButtonStyling" class="btn btn-neutral btn-outline">
                    {{confirmationDetails.cancelButton ?? "Cancel "}}
                </button>
                <button @click="confirm" :class="confirmButtonStyling" class="btn btn-error">
                    {{confirmationDetails.confirmButton ?? "Confirm "}}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
  data() {
    return {
      confirmationDetails: {
        title: '',
        message: '',
        confirmButton: '',
        cancelButton: ''
      },
      modalOpen: false,
      resolvePromise: null,
      rejectPromise: null
    };
  },
  methods: {
    /**
     * Opens a confirmation modal with the provided details.
     *
     * @param {string} title - The title of the confirmation modal.
     * @param {string} message - The message to be displayed in the confirmation modal.
     * @param {string} confirmButton - The text for the confirm button.
     * @param {string} cancelButton - The text for the cancel button.
     * @returns {Promise} A promise that resolves or rejects based on user action.
     */
    openConfirmation(title, message, confirmButton, cancelButton) {
      this.confirmationDetails = { title, message, confirmButton, cancelButton };
      this.modalOpen = true;

      return new Promise((resolve, reject) => {
        this.resolvePromise = resolve;
        this.rejectPromise = reject;
      });
    },

    confirm() {
      this.modalOpen = false;
      if (this.resolvePromise) {
        this.resolvePromise();
        this.resolvePromise = null;
      }
    },

    closeConfirmation() {
      this.modalOpen = false;
      if (this.rejectPromise) {
        this.rejectPromise("Confirmation cancelled");
        this.rejectPromise = null;
      }
    }
  }
};
</script>

