/**
 * Compute bounding box from shape type + params.
 * Returns { minX, minY, maxX, maxY, sizeMetric } or null for point/line.
 */
function getBoundingBox(shape) {
  const p = shape.params;
  switch (shape.type) {
    case 'circle':
      return { minX: p.cx - p.r, minY: p.cy - p.r, maxX: p.cx + p.r, maxY: p.cy + p.r, sizeMetric: p.r };
    case 'ellipse':
      return { minX: p.cx - p.rx, minY: p.cy - p.ry, maxX: p.cx + p.rx, maxY: p.cy + p.ry, sizeMetric: Math.max(p.rx, p.ry) };
    case 'rect':
      return { minX: p.x, minY: p.y, maxX: p.x + p.w - 1, maxY: p.y + p.h - 1, sizeMetric: Math.max(p.w, p.h) / 2 };
    default:
      return null;
  }
}

/**
 * Determine how many pixels to place based on shape size.
 */
function getPixelCount(sizeMetric) {
  if (sizeMetric <= 4) return 2;
  if (sizeMetric <= 7) return 3;
  return 4;
}

/**
 * Compute pixel positions for highlight/shadow along a direction.
 * Returns array of { x, y } positions.
 */
function computeEdgePixels(bbox, direction, count) {
  const { minX, minY, maxX, maxY } = bbox;
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const pixels = [];

  // Anchor point offset 1px inward from bounding box corner/edge
  let ax, ay, dxStep, dyStep;

  switch (direction) {
    case 'top-left':
      ax = minX + 1; ay = minY + 1; dxStep = 1; dyStep = 1;
      break;
    case 'top-right':
      ax = maxX - 1; ay = minY + 1; dxStep = -1; dyStep = 1;
      break;
    case 'bottom-left':
      ax = minX + 1; ay = maxY - 1; dxStep = 1; dyStep = -1;
      break;
    case 'bottom-right':
      ax = maxX - 1; ay = maxY - 1; dxStep = -1; dyStep = -1;
      break;
    case 'top':
      ax = cx - Math.floor(count / 2); ay = minY + 1; dxStep = 1; dyStep = 0;
      break;
    case 'bottom':
      ax = cx - Math.floor(count / 2); ay = maxY - 1; dxStep = 1; dyStep = 0;
      break;
    case 'left':
      ax = minX + 1; ay = cy - Math.floor(count / 2); dxStep = 0; dyStep = 1;
      break;
    case 'right':
      ax = maxX - 1; ay = cy - Math.floor(count / 2); dxStep = 0; dyStep = 1;
      break;
    default:
      ax = minX + 1; ay = minY + 1; dxStep = 1; dyStep = 1;
  }

  for (let i = 0; i < count; i++) {
    pixels.push({ x: ax + dxStep * i, y: ay + dyStep * i });
  }
  return pixels;
}

/**
 * Handle highlight or shadow draw type.
 * Looks up target shape, resolves lighter/darker color, places point shapes.
 */
function handleHighlightShadow(state, type, params) {
  const cell = state.project.cells.getCell(params.cell);
  const targetShape = cell.shapes.get(params.shape);
  if (!targetShape) throw new Error(`Shape "${params.shape}" not found`);

  // Validate shape type has a bounding box
  if (targetShape.type === 'point' || targetShape.type === 'line') {
    throw new Error(`Shape "${params.shape}" is a ${targetShape.type} — no bounding box`);
  }

  const palette = state.project.palette;
  const strength = params.strength ?? 1;
  const rampFn = type === 'highlight' ? 'lighter' : 'darker';
  const newColor = palette[rampFn](targetShape.color, strength);

  if (!newColor) {
    throw new Error(`Color "${targetShape.color}" not in palette ramps — cannot compute ${type}`);
  }

  const bbox = getBoundingBox(targetShape);
  if (!bbox) throw new Error(`Shape "${params.shape}" is a ${targetShape.type} — no bounding box`);

  const direction = params.direction ?? (type === 'highlight' ? 'top-left' : 'bottom-right');
  const count = getPixelCount(bbox.sizeMetric);
  const pixels = computeEdgePixels(bbox, direction, count);

  const baseName = params.shape_name ?? `${params.shape}_${type === 'highlight' ? 'hl' : 'sh'}`;
  const shapeNames = [];

  for (let i = 0; i < pixels.length; i++) {
    const name = `${baseName}_${i}`;
    const shape = cell.draw('point', { x: pixels[i].x, y: pixels[i].y }, newColor, name);
    state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
    shapeNames.push(name);
  }

  return { shapeNames };
}

/**
 * Shared draw handler — called by REST API and WebSocket dispatch.
 */
export function handleDraw(state, type, params) {
  if (!state.project) throw new Error('No project open');

  if (type === 'highlight' || type === 'shadow') {
    return handleHighlightShadow(state, type, params);
  }

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
