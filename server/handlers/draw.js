/**
 * Shared draw handler — called by REST API and WebSocket dispatch.
 */
export function handleDraw(state, type, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);

  let drawParams;
  switch (type) {
    case 'point':
      drawParams = { x: params.x, y: params.y };
      break;
    case 'line':
      drawParams = { x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2 };
      break;
    case 'rect':
      drawParams = { x: params.x, y: params.y, w: params.w, h: params.h, filled: params.filled ?? true };
      break;
    case 'circle':
      drawParams = { cx: params.cx, cy: params.cy, r: params.r, filled: params.filled ?? true };
      break;
    case 'ellipse':
      drawParams = { cx: params.cx, cy: params.cy, rx: params.rx, ry: params.ry, filled: params.filled ?? true };
      break;
    case 'fill':
      drawParams = { x: params.x, y: params.y };
      break;
    default:
      throw new Error(`Unknown draw type: ${type}`);
  }

  const shape = cell.draw(type, drawParams, params.color, params.shape_name ?? null);
  state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
  return { shapeId: shape.id, shapeName: shape.name };
}
