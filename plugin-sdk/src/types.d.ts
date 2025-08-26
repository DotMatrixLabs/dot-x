// Re-export all types from the auto-generated schema
export * from './generated/types';

// Additional types specific to the plugin SDK
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

declare module './generated/types' {
  interface PluginAPI {
    config: {
      set: (key: string | Record<string, any>, value?: any) => void;
      get: <T = any>(key: string, defaultValue?: T) => T | undefined;
      delete: (key: string) => void;
      clear: () => void;
      has: (key: string) => boolean;
      all: () => Record<string, any>;
      path: () => string;
      init: (options?: { schema?: Record<string, any>; defaults?: Record<string, any> }) => void;
    };
  }
}