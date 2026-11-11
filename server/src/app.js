import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function createApp(storage, clientDir) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a local reverse proxy (nginx), take the protocol from X-Forwarded-Proto
  // so the same-origin write check below sees https, not http.
  app.set('trust proxy', 'loopback');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // This is a local, unauthenticated app: reject cross-origin browser writes.
    if (req.method === 'PUT') {
      const origin = req.get('origin');
      if ((origin && origin !== `${req.protocol}://${req.get('host')}`) ||
          req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-origin writes are not allowed.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'Expected application/json.' });
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/roadmap', async (_req, res) => res.json(await storage.read()));
  app.put('/api/roadmap', async (req, res) => res.json(await storage.write(req.body)));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  if (clientDir && existsSync(resolve(clientDir, 'index.html'))) {
    app.use(express.static(clientDir));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(clientDir, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status === 400 ? (error.type === 'entity.parse.failed' ? 'Invalid JSON.' : error.message) : error.message || 'Server error.' });
  });
  return app;
}
