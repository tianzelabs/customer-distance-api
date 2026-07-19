import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type express from 'express';

/**
 * Shared integration-test bootstrap: binds an Express instance to an
 * OS-assigned ephemeral port (port 0), never a fixed/production port
 * (AD-4). Used by every integration test file that drives an Express
 * app (real or synthetic) over real HTTP, so the listen/close plumbing
 * lives in exactly one place instead of being copy-pasted per file.
 */
export async function listenOnEphemeralPort(
  handler: express.Express,
): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

/** Closes a server started by `listenOnEphemeralPort`, as a Promise. */
export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
