export { default as Plugin, runPlugin } from './plugin';
export type { PluginManifest } from './plugin';
export { APIClient } from './client';
export type { ConnectionConfig, PluginInfo } from './client';

// Re-export all types from generated schema
export * from './generated/types';

// Default export for convenience
export { default } from './plugin';
