import { request as httpRequest } from 'node:http';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from './app.js';
import { createStorage } from './storage.js';

let dir, server, url;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'airoadmap-api-'));
  server = createApp(createStorage(join(dir, 'roadmap.json'))).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

it('serves health, loads, saves and reports revision conflicts and malformed input', async () => {
  expect((await fetch(`${url}/api/health`)).status).toBe(200);
  const response = await fetch(`${url}/api/roadmap`);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const doc = await response.json();
  const put = (body) => fetch(`${url}/api/roadmap`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect((await put(doc)).status).toBe(200);
  expect((await put(doc)).status).toBe(409);
  expect((await put({ ...doc, settings: {} })).status).toBe(400);
  const malformed = await fetch(`${url}/api/roadmap`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{' });
  expect(malformed.status).toBe(400);
  expect((await malformed.json()).error).toBe('Invalid JSON.');
  expect((await fetch(`${url}/api/missing`)).status).toBe(404);
});

it('rejects cross-origin writes, but permits same-origin proxied browser writes', async () => {
  const doc = await (await fetch(`${url}/api/roadmap`)).json();
  const put = (origin) => fetch(`${url}/api/roadmap`, { method: 'PUT', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(doc) });
  expect((await put('https://unrelated.example')).status).toBe(403);
  expect((await put(url)).status).toBe(200);
});

it('accepts same-origin writes arriving over https through a local reverse proxy', async () => {
  const doc = await (await fetch(`${url}/api/roadmap`)).json();
  const { port } = new URL(url);
  // Mimics nginx: browser talks https to villacautela.com, nginx forwards http to us.
  const put = (proto) => new Promise((resolveStatus, reject) => {
    const req = httpRequest({
      host: '127.0.0.1', port, path: '/api/roadmap', method: 'PUT',
      headers: { 'Content-Type': 'application/json', Host: 'villacautela.com', Origin: 'https://villacautela.com', 'X-Forwarded-Proto': proto },
    }, (res) => { res.resume(); resolveStatus(res.statusCode); });
    req.on('error', reject);
    req.end(JSON.stringify(doc));
  });
  expect(await put('http')).toBe(403);
  expect(await put('https')).toBe(200);
});

it('persists releases and rejects duplicate boundaries and old-client saves without losing data', async () => {
  const doc = await (await fetch(`${url}/api/roadmap`)).json();
  const release = { id: 'r1', title: 'Launch', month: '2027-01', color: '#1976d2' };
  const put = (body) => fetch(`${url}/api/roadmap`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect((await put({ ...doc, releases: [release] })).status).toBe(200);
  const saved = await (await fetch(`${url}/api/roadmap`)).json();
  expect(saved.releases).toEqual([release]);
  expect((await put({ ...saved, releases: [release, { ...release, id: 'r2' }] })).status).toBe(400);
  const legacy = { ...doc, schemaVersion: 1, revision: saved.revision };
  delete legacy.releases;
  expect((await put(legacy)).status).toBe(400);
  expect((await (await fetch(`${url}/api/roadmap`)).json()).releases).toEqual([release]);
});
