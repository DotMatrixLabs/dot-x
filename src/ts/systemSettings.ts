import { enable, isEnabled, disable } from "tauri-plugin-autostart-api";

/**
 * A class for managing system settings.
 */
class SystemSettings {
  /**
   * Enable autostart for the application.
   * @returns {Promise<void>}
   */
  async enableAutostart() {
    await enable();
  }

  /**
   * Check the status of autostart for the application.
   * @returns {Promise<void>}
   */
  async checkAutostartStatus() {
    const isAutostartEnabled = await isEnabled();
    console.log(`Registered for autostart? ${isAutostartEnabled}`);
    return isAutostartEnabled;
  }

  /**
   * Disable autostart for the application.
   */
  async disableAutostart() {
    disable();
  }
}

export default new SystemSettings();
