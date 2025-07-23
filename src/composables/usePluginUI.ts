import { useToast } from "vue-toastification";
import { ref } from 'vue';

// Types for plugin UI interactions
interface ToastData {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface ModalData {
  title: string;
  content: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  buttons?: any[];
  closable?: boolean;
}

interface ConfirmationData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
}

interface AlertData {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function usePluginUI() {
  const toast = useToast();
  
  // Reactive state for modals/dialogs
  const isModalOpen = ref(false);
  const modalData = ref<ModalData | null>(null);
  const modalPromiseResolve = ref<((value: any) => void) | null>(null);
  
  const isConfirmationOpen = ref(false);
  const confirmationData = ref<ConfirmationData | null>(null);
  const confirmationPromiseResolve = ref<((value: boolean) => void) | null>(null);

  /**
   * Show toast notification
   */
  const showToast = (data: ToastData): void => {
    const { message, type = 'info', duration } = data;
    const options = duration ? { timeout: duration } : {};
    
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
  };

  /**
   * Show modal dialog
   */
  const showModal = (data: ModalData): Promise<any> => {
    return new Promise((resolve) => {
      modalData.value = data;
      modalPromiseResolve.value = resolve;
      isModalOpen.value = true;
    });
  };

  /**
   * Close modal and resolve promise
   */
  const closeModal = (result: any = { button: 'cancel', cancelled: true }) => {
    isModalOpen.value = false;
    if (modalPromiseResolve.value) {
      modalPromiseResolve.value(result);
      modalPromiseResolve.value = null;
    }
    modalData.value = null;
  };

  /**
   * Show confirmation dialog
   */
  const showConfirmation = (data: ConfirmationData): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmationData.value = data;
      confirmationPromiseResolve.value = resolve;
      isConfirmationOpen.value = true;
    });
  };

  /**
   * Close confirmation and resolve promise
   */
  const closeConfirmation = (confirmed: boolean) => {
    isConfirmationOpen.value = false;
    if (confirmationPromiseResolve.value) {
      confirmationPromiseResolve.value(confirmed);
      confirmationPromiseResolve.value = null;
    }
    confirmationData.value = null;
  };

  /**
   * Show alert (as toast for now)
   */
  const showAlert = (data: AlertData): void => {
    showToast({
      message: `${data.title}: ${data.message}`,
      type: data.type as any
    });
  };

  /**
   * Show custom dialog
   */
  const showDialog = (data: { title: string; content: string; buttons?: any[] }): Promise<any> => {
    // For now, use showModal - can be enhanced later
    return showModal({
      title: data.title,
      content: data.content,
      buttons: data.buttons,
      size: 'medium'
    });
  };

  /**
   * Hide current modal
   */
  const hideModal = (): void => {
    closeModal();
  };

  /**
   * Update progress (show as toast for now, can be enhanced with progress bars)
   */
  const updateProgress = (data: { value: number; message?: string }): void => {
    showToast({
      message: `Progress: ${data.value}%${data.message ? ` - ${data.message}` : ''}`,
      type: 'info'
    });
  };

  /**
   * Set theme
   */
  const setTheme = (data: { theme: string }): void => {
    document.documentElement.setAttribute("data-theme", data.theme);
    showToast({
      message: `Theme set to ${data.theme}`,
      type: 'success'
    });
  };

  return {
    // Toast methods
    showToast,
    
    // Modal methods
    showModal,
    closeModal,
    isModalOpen,
    modalData,
    
    // Confirmation methods
    showConfirmation,
    closeConfirmation,
    isConfirmationOpen,
    confirmationData,
    
    // Other UI methods
    showAlert,
    showDialog,
    hideModal,
    updateProgress,
    setTheme
  };
} 