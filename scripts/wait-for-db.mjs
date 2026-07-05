#!/usr/bin/env node
/* Waits until PostgreSQL is accepting connections on localhost:5432. */
import net from 'node:net';

const HOST = '127.0.0.1';
const PORT = 5432;
const MAX_ATTEMPTS = 30;
const DELAY_MS = 1000;

function check() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(PORT, HOST);
  });
}

(async () => {
  process.stdout.write('Waiting for postgres');
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (await check()) {
      console.log(' ✓ ready');
      // small grace period — port is open before pg actually accepts queries
      await new Promise((r) => setTimeout(r, 500));
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.error('\nTimed out waiting for postgres on 127.0.0.1:5432');
  console.error('Is Docker running? Try: docker compose ps');
  process.exit(1);
})();
