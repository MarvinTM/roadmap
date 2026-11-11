import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createStorage } from './storage.js';
import { createApp } from './app.js';

const file = process.env.ROADMAP_DATA_FILE || fileURLToPath(new URL('../data/roadmap.json', import.meta.url));
const storage = createStorage(resolve(file));
const unlock = await storage.lock();
try {
  await storage.read();
  const app = createApp(storage, fileURLToPath(new URL('../../client/dist', import.meta.url)));
  const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
    console.log(`aiRoadmap API: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`);
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => { await unlock(); process.exit(0); });
  };
  server.on('error', async (error) => { console.error(error); await unlock(); process.exit(1); });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  await unlock();
  throw error;
}
