import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ConfigStore from '../ts/config.ts';

const MODEL_BY_PORT_KEY = 'firmwareModelByPort';
const COME_BACK_TIMEOUT_MS = 10_000;
const UNKNOWN_MODEL_ERROR = "Dot X doesn't know which Decker this is. Plug it in normally once, then try again.";
const NO_COME_BACK_ERROR = "Decker didn't come back after the update. Unplug it and plug it back in.";

let flashedVersion: string | null = null;
let confirmFlash: (() => void) | null = null;
let progressListening = false;

export const useFirmwareStore = defineStore('firmware', {
  state: () => ({
    available: null as string | null,
    deviceVersion: null as string | null,
    model: null as string | null,
    portName: null as string | null,
    flashing: false as boolean,
    percent: 0 as number,
    error: null as string | null,
    inBootloader: false as boolean,
    justUpdated: false as boolean,
  }),
  getters: {
    needsAttention: (state) => state.available !== null || state.inBootloader,
  },
  actions: {
    async onDeviceInfo(portName: string, info: { deviceModel: string; firmwareVersion: string }) {
      this.portName = portName;
      this.model = info.deviceModel;
      this.deviceVersion = info.firmwareVersion;
      this.inBootloader = false;

      const byPort: Record<string, string> = (await ConfigStore.get(MODEL_BY_PORT_KEY)) ?? {};
      if (byPort[portName] !== info.deviceModel) {
        await ConfigStore.set(MODEL_BY_PORT_KEY, { ...byPort, [portName]: info.deviceModel });
      }

      try {
        this.available = await invoke<string | null>('firmware_check', {
          model: info.deviceModel,
          version: info.firmwareVersion,
        });
      } catch (error) {
        this.available = null;
        console.error('firmware_check failed', error);
      }

      if (this.flashing && flashedVersion !== null && info.firmwareVersion === flashedVersion) {
        this.flashing = false;
        this.justUpdated = true;
        confirmFlash?.();
      }
    },

    async onBootloader(portName: string) {
      const byPort: Record<string, string> = (await ConfigStore.get(MODEL_BY_PORT_KEY)) ?? {};
      this.inBootloader = true;
      this.portName = portName;
      this.model = byPort[portName] ?? null;
    },

    async flash() {
      if (!this.portName || this.flashing) return;
      if (!this.model) {
        this.error = UNKNOWN_MODEL_ERROR;
        return;
      }

      if (!progressListening) {
        progressListening = true;
        await listen<{ stage: string; percent: number }>('firmware-progress', (event) => {
          this.percent = event.payload.percent;
        });
      }

      flashedVersion = this.available;
      this.flashing = true;
      this.percent = 0;
      this.error = null;
      this.justUpdated = false;

      try {
        await invoke('firmware_flash', { portName: this.portName, model: this.model });
      } catch (error) {
        this.error = String(error);
        this.flashing = false;
        return;
      }

      // Rust has told the device to restart. Wait for it to report the new version.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cameBack = await Promise.race([
        new Promise<boolean>((resolve) => { confirmFlash = () => resolve(true); }),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), COME_BACK_TIMEOUT_MS); }),
      ]);
      clearTimeout(timer);
      confirmFlash = null;
      if (!cameBack) this.error = NO_COME_BACK_ERROR;
      this.flashing = false;
    },
  },
});
