import { Router } from 'express';
import { handleMoveShape, handleMoveShapeTo, handleResizeShape,
         handleRecolorShape, handleDeleteShape, handleCloneShape,
         handleSetZ, handleShapeZDirection, handleNameShape,
         handleFlipShape, handleRotateShape } from '../../handlers/shape.js';
import { saveDraft } from '../http.js';

export function shapeRoutes(state) {
  const r = Router();
  const wrap = (handler) => (req, res) => {
    try {
      const result = handler(state, req.body);
      saveDraft(state);
      res.json({ ok: true, data: result ?? 'ok' });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  };
  r.post('/shape/name',    wrap(handleNameShape));
  r.post('/shape/move',    wrap(handleMoveShape));
  r.post('/shape/move-to', wrap(handleMoveShapeTo));
  r.post('/shape/resize',  wrap(handleResizeShape));
  r.post('/shape/recolor', wrap(handleRecolorShape));
  r.post('/shape/delete',  wrap(handleDeleteShape));
  r.post('/shape/clone',   wrap(handleCloneShape));
  r.post('/shape/flip',    wrap(handleFlipShape));
  r.post('/shape/rotate',  wrap(handleRotateShape));
  r.post('/shape/set-z',   wrap(handleSetZ));
  r.post('/shape/z-dir',   wrap(handleShapeZDirection));
  return r;
}
