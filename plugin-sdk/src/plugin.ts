// dot-x-plugin/src/plugin.ts
import { APIClient } from './client';
import type { PluginAPI } from './generated/types';

export default class Plugin {
  public settings: PluginAPI['settings'];
  public ui: PluginAPI['ui'];
  
  constructor() {
    const client = new APIClient();
    this.settings = client.settings;
    this.ui = client.ui;
  }
  
  // Plugin lifecycle methods
  async onLoad() {}
  async onUnload() {}
}