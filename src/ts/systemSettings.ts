import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import ConfigStore from "./config";
/**
 * A class for managing system settings.
 */
class SystemSettings {
  /**
   * Enable autostart for the application.
   * @returns {Promise<void>}
   */
  async enableAutostart() {
    await ConfigStore.set("autostart", "true");
    ConfigStore.save();
    await enable();
  }

  /**
   * Check the status of autostart for the application.
   * @returns {Promise<void>}
   */
  async checkAutostartStatus() {
    const autostartValueSet = await ConfigStore.has("autostart");
    if(!autostartValueSet) await this.enableAutostart();
    const isAutostartEnabled = await isEnabled();
    return isAutostartEnabled;
  }

  /**
   * Disable autostart for the application.
   */
  async disableAutostart() {
    await ConfigStore.set("autostart", "false");
    ConfigStore.save();
    disable();
  }
}

export default new SystemSettings();
