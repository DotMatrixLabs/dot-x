export interface PluginAPI {
    settings: {
      addButton: (config: {
        title: string;
        icon?: string;
      }) => Promise<{
        id: string;
        onPress: (callback: () => void) => void;
      }>;
      
      addInput: (config: {
        label: string;
        type: 'text' | 'password' | 'number';
      }) => Promise<{
        id: string;
        getValue: () => string;
      }>;
    };
    
    ui: {
      showNotification: (message: string) => Promise<void>;
      openModal: (content: string) => Promise<void>;
    };
  }