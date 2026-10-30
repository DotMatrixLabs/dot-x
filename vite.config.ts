import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // Only expose Tauri build metadata. TAURI_ also includes updater signing secrets.
  envPrefix: [
    "VITE_",
    "TAURI_DEBUG",
    "TAURI_ENV_PLATFORM",
    "TAURI_ENV_ARCH",
    "TAURI_ENV_FAMILY",
    "TAURI_ENV_PLATFORM_VERSION",
    "TAURI_ENV_PLATFORM_TYPE",
  ],
}));
