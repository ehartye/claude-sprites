import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { controlRoutes } from '../../server/web/api/control-routes.js';

describe('control routes', () => {
  it('POST /shutdown responds ok then closes db and exits on next tick', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const dbClose = vi.fn();
    const broadcast = vi.fn();
    const state = { db: { close: dbClose }, broadcast };

    const app = express();
    app.use(express.json());
    app.use('/api/control', controlRoutes(state));

    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/control/shutdown`, { method: 'POST' });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);

      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));

      expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: 'shutdown' }));
      expect(dbClose).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      server.close();
      exitSpy.mockRestore();
    }
  });

  it('shutdown tolerates missing broadcast/db without throwing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const state = {};
    const app = express();
    app.use(express.json());
    app.use('/api/control', controlRoutes(state));
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/control/shutdown`, { method: 'POST' });
      expect(res.status).toBe(200);
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      server.close();
      exitSpy.mockRestore();
    }
  });
});
