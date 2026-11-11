import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorage } from './storage.js';

let dir, file, storage;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'airoadmap-storage-'));
  file = join(dir, 'roadmap.json');
  storage = createStorage(file);
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('JSON persistence', () => {
  it('initializes missing storage, atomically saves, and backs up the previous revision', async () => {
    const doc = await storage.read();
    expect(doc.revision).toBe(0);
    const saved = await storage.write({ ...doc, settings: { ...doc.settings, monthsVisible: 6 } });
    expect(saved.revision).toBe(1);
    expect(JSON.parse(await readFile(file, 'utf8')).settings.monthsVisible).toBe(6);
    expect(JSON.parse(await readFile(`${file}.bak`, 'utf8'))).toEqual(doc);
    await expect(readFile(`${file}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('serializes competing writes and checks the revision inside the queue', async () => {
    const doc = await storage.read();
    const results = await Promise.allSettled([storage.write(doc), storage.write(doc)]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].reason.status).toBe(409);
    expect((await storage.read()).revision).toBe(1);
    await expect(storage.write({ ...doc, revision: 1 })).resolves.toMatchObject({ revision: 2 });
  });
  it('rejects invalid input without modifying the live file', async () => {
    const doc = await storage.read();
    await expect(storage.write({ ...doc, bigBlocks: 'bad' })).rejects.toMatchObject({ status: 400 });
    expect(await storage.read()).toEqual(doc);
  });
  it('does not replace corrupt persisted data with an empty document', async () => {
    await writeFile(file, 'broken data');
    await expect(storage.read()).rejects.toMatchObject({ status: 500 });
    expect(await readFile(file, 'utf8')).toBe('broken data');
  });
  it('prevents a second server from opening the same storage', async () => {
    const unlock = await storage.lock();
    await expect(createStorage(file).lock()).rejects.toThrow('Storage is locked');
    await unlock();
    const release = await createStorage(file).lock();
    await release();
  });
});
