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
