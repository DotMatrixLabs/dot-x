// Connection lifecycle tests for the built SDK (run `yarn build` first).
// They stand in for Dot X with a real Socket.IO server and check that a plugin keeps
// re-registering after outages, which is what happens when the PC sleeps or Dot X restarts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Plugin } from '../dist/index.mjs';

process.env.DOTX_PLUGIN_LOG_LEVEL = 'silent';

const fast = { maxRetries: 2, retryDelay: 50, connectionTimeout: 500, registrationTimeout: 3000 };

function startHost(port = 0) {
  return new Promise((resolve) => {
    const http = createServer();
    const io = new Server(http);
    const host = { io, registrations: 0, port: 0 };
    io.on('connection', (socket) => {
      socket.on('register', (_info, ack) => {
        host.registrations++;
        ack({ status: 'success' });
      });
    });
    http.listen(port, '127.0.0.1', () => {
      host.port = http.address().port;
      resolve(host);
    });
  });
}

function stopHost(host) {
  return new Promise((resolve) => host.io.close(() => resolve()));
}

async function waitFor(check, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const info = (id) => ({ id, name: id, version: '1.0.0', connected_at: new Date().toISOString() });

test('re-registers after an outage longer than maxRetries', async () => {
  let host = await startHost();
  const port = host.port;
  const plugin = new Plugin(info('outage'), { ...fast, serverUrl: `http://127.0.0.1:${port}` });
  await plugin.waitForConnection();
  assert.equal(host.registrations, 1);

  // Down long enough for many more failed attempts than maxRetries allows on first connect.
  await stopHost(host);
  await new Promise((resolve) => setTimeout(resolve, 800));

  host = await startHost(port);
  await waitFor(() => host.registrations === 1);
  plugin.client.disconnect();
  await stopHost(host);
});

test('re-registers when the server drops the connection', async () => {
  const host = await startHost();
  const plugin = new Plugin(info('kicked'), { ...fast, serverUrl: `http://127.0.0.1:${host.port}` });
  await plugin.waitForConnection();

  for (const socket of await host.io.fetchSockets()) socket.disconnect(true);
  await waitFor(() => host.registrations === 2);
  plugin.client.disconnect();
  await stopHost(host);
});

test('gives up on the first connection when no host is running', async () => {
  const host = await startHost();
  const port = host.port;
  await stopHost(host);

  const plugin = new Plugin(info('nohost'), { ...fast, serverUrl: `http://127.0.0.1:${port}` });
  await assert.rejects(plugin.waitForConnection(), /Failed to connect to plugin server after 2 attempts/);
});
