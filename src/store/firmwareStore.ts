import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { platform } from '@tauri-apps/plugin-os';
import { toast } from 'vue-sonner';
import ConfigStore from '../ts/config.ts';
import { useUpdateStore } from './updateStore';

const MODEL_BY_PORT_KEY = 'firmwareModelByPort';
const COME_BACK_TIMEOUT_MS = 10_000;
const UNKNOWN_MODEL_ERROR = "Dot X doesn't know which device this is. Connect it to the PC where it was last updated.";
const NOT_CONNECTED_ERROR = "Decker isn't connected.";
const NO_COME_BACK_ERROR = "Decker didn't come back after the update. Unplug it and plug it back in.";

let confirmFlash: (() => void) | null = null;
let progressListening = false;
let launchReady: Promise<void> = Promise.resolve();
const TOAST_ID = 'firmware';

export const useFirmwareStore = defineStore('firmware', {
  state: () => ({
    available: null as string | null,
    deviceVersion: null as string | null,
    model: null as string | null,
    portName: null as string | null,
    flashing: false as boolean,
    awaitingRestart: false as boolean,
    percent: 0 as number,
    error: null as string | null,
    inBootloader: false as boolean,
    justUpdated: false as boolean,
    autoFlashPending: false as boolean,
    dismissedVersion: null as string | null,
  }),
  getters: {
    needsAttention: (state) => state.available !== null || state.inBootloader,
    busy: (state) => state.flashing || state.awaitingRestart,
    showPrompt: (state) =>
      state.available !== null
      && !state.autoFlashPending
      && !state.flashing
      && !state.awaitingRestart
      && state.dismissedVersion !== state.available
      && !useUpdateStore().whatsNewOpen,
  },
  actions: {
    // Call once at app start. After a Dot X update (not the first run, not Linux), the first
    // device-info that reports newer bundled firmware flashes it without asking.
    initLaunch() {
      launchReady = (async () => {
        try {
          this.dismissedVersion = (await ConfigStore.get('firmwarePromptDismissed')) ?? null;
          const saved: string | null | undefined = await ConfigStore.get('lastLaunchedVersion');
          const current = useUpdateStore().currentVersion;
          this.autoFlashPending = saved != null && saved !== current && (await platform()) !== 'linux';
          if (saved !== current) await ConfigStore.set('lastLaunchedVersion', current);
        } catch (error) {
          console.error('firmware initLaunch failed', error);
        }
      })();
      return launchReady;
    },

    async dismissPrompt() {
      if (this.available === null) return;
      this.dismissedVersion = this.available;
      await ConfigStore.set('firmwarePromptDismissed', this.available);
    },

    async autoFlash(version: string) {
      const message = () => `Updating Decker firmware… ${this.percent}%. Don't unplug Decker.`;
      toast.loading(message(), { id: TOAST_ID });
      const stop = this.$subscribe(() => {
        if (this.busy) toast.loading(message(), { id: TOAST_ID });
      });
      try {
        await this.flash();
      } finally {
        stop();
      }
      if (this.error) toast.error(this.error, { id: TOAST_ID });
      else toast.success(`Decker updated to ${version}`, { id: TOAST_ID });
    },

    async onDeviceInfo(portName: string, info: { deviceModel: string; firmwareVersion: string }) {
      await launchReady;
      this.portName = portName;
      this.model = info.deviceModel;
      this.deviceVersion = info.firmwareVersion;
      this.inBootloader = false;

      const byPort: Record<string, string> = (await ConfigStore.get(MODEL_BY_PORT_KEY)) ?? {};
      if (byPort[portName] !== info.deviceModel) {
        await ConfigStore.set(MODEL_BY_PORT_KEY, { ...byPort, [portName]: info.deviceModel });
      }

      let checked = false;
      try {
        this.available = await invoke<string | null>('firmware_check', {
          model: info.deviceModel,
          version: info.firmwareVersion,
        });
        checked = true;
      } catch (error) {
        this.available = null;
        console.error('firmware_check failed', error);
      }

      // Up to date while a flash is in flight, or just after the wait gave up, means the flash worked.
      const lateConfirm = this.error === NO_COME_BACK_ERROR;
      if (checked && this.available === null && (this.busy || lateConfirm)) {
        this.awaitingRestart = false;
        this.justUpdated = true;
        if (lateConfirm) this.error = null;
        confirmFlash?.();
      }

      // Only the first device-info of the launch may flash on its own.
      const auto = this.autoFlashPending;
      this.autoFlashPending = false;
      if (auto && this.available !== null && !this.busy) void this.autoFlash(this.available);
    },

    async onBootloader(portName: string) {
      const byPort: Record<string, string> = (await ConfigStore.get(MODEL_BY_PORT_KEY)) ?? {};
      this.inBootloader = true;
      this.portName = portName;
      this.model = byPort[portName] ?? null;
    },

    async flash() {
      if (!this.portName) {
        this.error = NOT_CONNECTED_ERROR;
        return;
      }
      if (!this.model) {
        this.error = UNKNOWN_MODEL_ERROR;
        return;
      }
      if (this.busy) return;

      if (!progressListening) {
        progressListening = true;
        await listen<{ stage: string; percent: number }>('firmware-progress', (event) => {
          this.percent = event.payload.percent;
        });
      }

      this.flashing = true;
      this.percent = 0;
      this.error = null;
      this.justUpdated = false;

      // Register the waiter before invoking so an early device-info isn't missed.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let giveUp: () => void = () => {};
      const confirmed = new Promise<boolean>((resolve) => {
        confirmFlash = () => resolve(true);
        giveUp = () => { timer = setTimeout(() => resolve(false), COME_BACK_TIMEOUT_MS); };
      });
      const stopWaiting = () => {
        clearTimeout(timer);
        confirmFlash = null;
      };

      try {
        await invoke('firmware_flash', { portName: this.portName, model: this.model });
      } catch (error) {
        stopWaiting();
        this.error = String(error);
        this.justUpdated = false;
        this.flashing = false;
        return;
      }

      // Rust released the port; detectDeviceChanges can reconnect while we wait.
      this.flashing = false;
      this.percent = 100;
      if (!this.justUpdated) this.awaitingRestart = true;
      giveUp();
      const cameBack = await confirmed;
      stopWaiting();
      if (!cameBack && this.awaitingRestart) this.error = NO_COME_BACK_ERROR;
      this.awaitingRestart = false;
    },
  },
});
