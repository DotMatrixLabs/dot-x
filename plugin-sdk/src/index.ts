export { default as Plugin, runPlugin } from './plugin';
export { APIClient } from './client';
export type { ConnectionConfig, PluginInfo } from './client';
export { SettingsBuilder, createSettingsBuilder, ActionMapper, createActionMapper } from './ui';
export type { UISection } from './ui';

// Default export for convenience
export { default } from './plugin';
