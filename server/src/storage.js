import { mkdir, readFile, writeFile, rename, copyFile, open, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emptyRoadmap, validateRoadmap } from '@roadmap/shared';

export class StorageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createStorage(file) {
  let queue = Promise.resolve();
  const serialize = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function atomicWrite(doc) {
    await mkdir(dirname(file), { recursive: true });
    const handle = await open(`${file}.tmp`, 'w', 0o600);
    try { await handle.writeFile(`${JSON.stringify(doc, null, 2)}\n`); await handle.sync(); }
    finally { await handle.close(); }
    await rename(`${file}.tmp`, file);
  }
  async function load() {
    try {
      const doc = JSON.parse(await readFile(file, 'utf8'));
      const error = validateRoadmap(doc);
      if (error) throw new Error(error);
      return doc;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new StorageError(500, 'The roadmap file cannot be read. Restore a valid file or its .bak backup; the existing file has not been replaced.');
      const doc = emptyRoadmap();
      await atomicWrite(doc);
      return doc;
    }
  }
  return {
    read: () => serialize(load),
    write: (input) => serialize(async () => {
      const error = validateRoadmap(input);
      if (error) throw new StorageError(400, error);
      const current = await load();
      if (current.revision !== input.revision) throw new StorageError(409, 'The roadmap has changed since this version was loaded.');
      const saved = { ...input, revision: current.revision + 1, updatedAt: new Date().toISOString() };
      await copyFile(file, `${file}.bak`);
      await atomicWrite(saved);
      return { revision: saved.revision, updatedAt: saved.updatedAt };
    }),
    // A lock prevents two local server processes from silently clobbering one file.
    async lock() {
      await mkdir(dirname(file), { recursive: true });
      let handle;
      try { handle = await open(`${file}.lock`, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error(`Storage is locked: ${file}.lock. Stop the other server, or remove this lock if its process is no longer running.`);
        throw error;
      }
      await writeFile(handle, String(process.pid));
      return async () => {
        await handle.close();
        await unlink(`${file}.lock`).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      };
    },
  };
}
