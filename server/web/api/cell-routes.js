import { Router } from 'express';
import { handleShiftCell, handleMirrorCell, handleCopyCell,
         handleClearCell, handleNameCell, handleListCells } from '../../mcp/cell-tools.js';
import { handleUndo, handleRedo } from '../../mcp/history-tools.js';
import { handleViewCell } from '../../mcp/view-tools.js';
import { saveDraft } from '../http.js';

export function cellRoutes(state) {
  const r = Router();
  const wrap = (handler) => (req, res) => {
    try {
      const result = handler(state, req.body);
      saveDraft(state);
      res.json({ ok: true, data: result ?? 'ok' });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  };
  r.post('/cell/copy',   wrap(handleCopyCell));
  r.post('/cell/clear',  wrap(handleClearCell));
  r.post('/cell/name',   wrap(handleNameCell));
  r.post('/cell/shift',  wrap(handleShiftCell));
  r.post('/cell/mirror', wrap(handleMirrorCell));
  r.post('/cell/undo',   wrap(handleUndo));
  r.post('/cell/redo',   wrap(handleRedo));
  r.get('/cells',        (_req, res) => {
    try { res.json({ ok: true, data: handleListCells(state, {}) }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  r.post('/cell/view',   (req, res) => {
    try { res.json({ ok: true, data: handleViewCell(state, req.body) }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  return r;
}
