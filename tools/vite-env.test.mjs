import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createServer } from "vite";

test("debug frontend receives build flags without signing credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "dotx-vite-env-"));
  const signingNames = [
    "TAURI_PRIVATE_KEY",
    "TAURI_KEY_PASSWORD",
    "TAURI_PRIVATE_KEY_PASSWORD",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ];
  const variables = {
    ...Object.fromEntries(signingNames.map((name) => [name, `dummy-secret-${name}`])),
    TAURI_DEBUG: "true",
    TAURI_ENV_PLATFORM: "windows",
    TAURI_ENV_ARCH: "x86_64",
    VITE_DOTX_TEST: "frontend-setting",
  };
  const saved = new Map(
    Object.keys(process.env)
      .filter((name) => name.startsWith("TAURI_") || name.startsWith("VITE_"))
      .map((name) => [name, process.env[name]]),
  );
  for (const name of saved.keys()) delete process.env[name];
  Object.assign(process.env, variables);

  let server;
  try {
    await writeFile(join(root, "probe.ts"), "console.log(import.meta.env);\n");
    server = await createServer({
      root,
      configFile: resolve("vite.config.ts"),
      envDir: root,
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
      optimizeDeps: { noDiscovery: true },
    });
    const transformed = await server.transformRequest("/probe.ts");
    assert.ok(transformed, "Vite must transform the debug module");
    for (const name of signingNames) {
      assert.equal(
        transformed.code.includes(variables[name]),
        false,
        `${name} must not be exposed to the debug frontend`,
      );
    }
    for (const name of ["TAURI_DEBUG", "TAURI_ENV_PLATFORM", "TAURI_ENV_ARCH", "VITE_DOTX_TEST"]) {
      assert.equal(server.config.env[name], variables[name], `${name} must remain available`);
    }
  } finally {
    await server?.close();
    for (const name of Object.keys(variables)) delete process.env[name];
    for (const [name, value] of saved) process.env[name] = value;
    await rm(root, { recursive: true, force: true });
  }
});
