import { Router } from 'express';

export function controlRoutes(state) {
  const r = Router();

  r.post('/shutdown', (_req, res) => {
    res.json({ ok: true, data: 'shutting down' });
    setImmediate(() => {
      try { state.broadcast?.({ type: 'shutdown' }); } catch {}
      try { state.db?.close?.(); } catch {}
      process.exit(0);
    });
  });

  return r;
}
