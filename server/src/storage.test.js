import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorage } from './storage.js';
import { emptyRoadmap } from '@roadmap/shared';

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
  it('migrates schema v1 once, preserving all blocks and a permanent byte-for-byte pre-upgrade backup', async () => {
    const legacy = {
      schemaVersion: 1, revision: 7, updatedAt: '2026-11-10T10:00:00Z',
      settings: { startMonth: '2026-11', monthsVisible: 12 },
      bigBlocks: [{
        id: 'b1', title: 'Existing initiative', color: '#1976d2', months: 2, rows: 1,
        placement: { start: '2026-11', row: 3 }, backlogOrder: null,
        smallBlocks: [{ id: 's1', title: 'Existing story', jiraUrl: 'https://example.com/PROJ-1', track: 0, offset: 2, length: 5 }],
      }],
    };
    const original = JSON.stringify(legacy, null, 2);
    await writeFile(file, original);
    const [upgraded, secondRead] = await Promise.all([storage.read(), storage.read()]);
    expect(upgraded).toMatchObject({ schemaVersion: 2, revision: 8, releases: [], settings: { tintReleasePeriods: false }, bigBlocks: legacy.bigBlocks });
    expect(secondRead).toEqual(upgraded);
    expect(await readFile(`${file}.v1.bak`, 'utf8')).toBe(original);
    await storage.write({ ...upgraded, releases: [{ id: 'r1', title: 'Launch', month: '2027-01', color: '#00897b' }] });
    expect(await readFile(`${file}.v1.bak`, 'utf8')).toBe(original);
    expect((await storage.read()).revision).toBe(9);
    await expect(storage.write(legacy)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Reload/) });
    const missingReleases = { ...upgraded, revision: 9 };
    delete missingReleases.releases;
    await expect(storage.write(missingReleases)).rejects.toMatchObject({ status: 400 });
    expect((await storage.read()).releases[0].id).toBe('r1');
  });
  it('does not migrate or replace invalid legacy data', async () => {
    const invalid = { ...emptyRoadmap(), schemaVersion: 1, revision: -1 };
    const original = JSON.stringify(invalid);
    await writeFile(file, original);
    await expect(storage.read()).rejects.toMatchObject({ status: 500 });
    expect(await readFile(file, 'utf8')).toBe(original);
    await expect(readFile(`${file}.v1.bak`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('never initializes an empty roadmap when a migration backup fails with ENOENT', async () => {
    const legacy = { ...emptyRoadmap(), schemaVersion: 1, revision: 5 };
    delete legacy.releases;
    delete legacy.settings.tintReleasePeriods;
    const original = JSON.stringify(legacy);
    await writeFile(file, original);
    await symlink(join(dir, 'missing-directory', 'backup.json'), `${file}.bak`);
    await expect(storage.read()).rejects.toMatchObject({ status: 500 });
    expect(await readFile(file, 'utf8')).toBe(original);
    expect(await readFile(`${file}.v1.bak`, 'utf8')).toBe(original);
    await unlink(`${file}.bak`);
    expect(await storage.read()).toMatchObject({ schemaVersion: 2, revision: 6, releases: [] });
  });
});
