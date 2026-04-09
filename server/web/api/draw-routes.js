import { Router } from 'express';
import { handleDraw } from '../../mcp/drawing-tools.js';
import { saveDraft } from '../http.js';

export function drawRoutes(state) {
  const r = Router();
  r.post('/draw', (req, res) => {
    try {
      const { type, ...params } = req.body;
      const result = handleDraw(state, type, params);
      saveDraft(state);
      res.json({ ok: true, data: result });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  r.get('/shapes', (req, res) => {
    try {
      const cell = state.project.cells.getCell(req.query.cell);
      const shapes = cell.shapes.listByZ().map(s => s.toJSON());
      res.json({ ok: true, data: shapes });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  return r;
}
