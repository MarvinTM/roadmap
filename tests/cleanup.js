import { rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export default async function cleanup() {
  const directory = process.env.ROADMAP_E2E_DIR;
  if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith('airoadmap-e2e-')) {
    await rm(directory, { recursive: true, force: true });
  }
}
