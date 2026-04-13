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
 * Scales linearly with radius so highlights read proportionally on any size.
 */
function getPixelCount(sizeMetric) {
  return Math.max(2, Math.round(sizeMetric * 0.4));
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
 * For circles/ellipses, sample points along the shape's curved edge clustered
 * around the direction's center angle. Produces a natural arc of pixels rather
 * than a straight line along the bounding box. Points sit 1px inside the edge.
 */
const DIRECTION_ANGLES = {
  'right': 0,
  'bottom-right': Math.PI / 4,
  'bottom': Math.PI / 2,
  'bottom-left': (3 * Math.PI) / 4,
  'left': Math.PI,
  'top-left': -(3 * Math.PI) / 4,
  'top': -Math.PI / 2,
  'top-right': -Math.PI / 4,
};

function computeArcPixels(shape, direction, count, type) {
  const p = shape.params;
  const cx = p.cx;
  const cy = p.cy;
  const rx = shape.type === 'circle' ? p.r : p.rx;
  const ry = shape.type === 'circle' ? p.r : p.ry;
  const centerAngle = DIRECTION_ANGLES[direction] ?? -(3 * Math.PI) / 4;

  // Pixel-art sphere shading: highlight is a SMALL focal cluster set WELL
  // inside the surface (~55% radius) to read as a specular spot. Shadow is
  // a WIDER crescent closer to the silhouette (~80% radius) that wraps the
  // unlit side. Both avoid outline-hugging, which produces pillow-shading.
  const isHighlight = type === 'highlight';
  const radiusFactor = shape.__overrideRadiusFactor ?? (isHighlight ? 0.55 : 0.70);
  const irx = Math.max(0.5, rx * radiusFactor);
  const iry = Math.max(0.5, ry * radiusFactor);

  // Both highlight and core shadow are compact clusters. A single `draw shadow`
  // call represents the CORE shadow (darkest band near the terminator), not
  // the full form-shadow half — mid-tones would need a separate draw.
  // Base span grows with count so adjacent pixels land ~1px apart along the
  // arc instead of piling up and getting dedup-killed at large radii.
  const baseSpanDeg = shape.__overrideSpanDeg ?? (isHighlight ? 30 : 40);
  const r_inner = Math.max(irx, iry);
  const minStep = r_inner > 0 ? 1 / r_inner : 0; // rad; keeps pixels distinct
  const baseSpan = (baseSpanDeg * Math.PI) / 180;
  const step = count > 1 ? Math.max(baseSpan / (count - 1), minStep) : 0;
  const span = step * (count - 1);
  const start = centerAngle - span / 2;

  const seen = new Set();
  const pixels = [];
  for (let i = 0; i < count; i++) {
    const a = start + step * i;
    const x = Math.round(cx + irx * Math.cos(a));
    const y = Math.round(cy + iry * Math.sin(a));
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pixels.push({ x, y });
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
  const count = params.count != null
    ? Math.max(1, Math.round(params.count))
    : getPixelCount(bbox.sizeMetric);
  // Stash overrides so computeArcPixels picks them up (keeps signature small).
  targetShape.__overrideRadiusFactor = params.radius_factor ?? null;
  targetShape.__overrideSpanDeg = params.span_deg ?? null;
  const pixels = (targetShape.type === 'circle' || targetShape.type === 'ellipse')
    ? computeArcPixels(targetShape, direction, count, type)
    : computeEdgePixels(bbox, direction, count);
  delete targetShape.__overrideRadiusFactor;
  delete targetShape.__overrideSpanDeg;

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
 * Test whether (px, py) falls inside a mask shape's filled area.
 * Supports circle, ellipse, rect. Points/lines are treated as zero-area.
 */
function isInsideShape(shape, px, py) {
  const p = shape.params;
  switch (shape.type) {
    case 'circle': {
      const dx = px - p.cx, dy = py - p.cy;
      return dx * dx + dy * dy <= p.r * p.r;
    }
    case 'ellipse': {
      const dx = (px - p.cx) / p.rx;
      const dy = (py - p.cy) / p.ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'rect':
      return px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h;
    default:
      return false;
  }
}

/**
 * Rasterize any shape to a Set of "x,y" keys. Used by clip + border handlers.
 */
function rasterizeShapeToSet(shape) {
  const set = new Set();
  const p = shape.params;
  const add = (x, y) => set.add(`${x},${y}`);
  switch (shape.type) {
    case 'point':
      add(p.x, p.y);
      break;
    case 'line': {
      let x0 = p.x1, y0 = p.y1;
      const x1 = p.x2, y1 = p.y2;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        add(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      break;
    }
    case 'rect': {
      const x0 = p.x, y0 = p.y, w = p.w, h = p.h;
      if (p.filled === false) {
        for (let x = x0; x < x0 + w; x++) { add(x, y0); add(x, y0 + h - 1); }
        for (let y = y0; y < y0 + h; y++) { add(x0, y); add(x0 + w - 1, y); }
      } else {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) add(x, y);
      }
      break;
    }
    case 'circle':
    case 'ellipse': {
      const rx = shape.type === 'circle' ? p.r : p.rx;
      const ry = shape.type === 'circle' ? p.r : p.ry;
      if (p.filled === false) {
        for (const pt of rasterizeEllipseOutline(p.cx, p.cy, rx, ry)) add(pt.x, pt.y);
      } else {
        for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) add(p.cx + x, p.cy + y);
        }
      }
      break;
    }
  }
  return set;
}

/**
 * Rasterize an ellipse outline (unfilled) into a deduped list of pixels.
 * Mirrors the renderer's parametric sweep so clip results match what's drawn.
 */
function rasterizeEllipseOutline(cx, cy, rx, ry) {
  const steps = Math.max(rx, ry) * 4;
  const drawn = new Set();
  const pixels = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    const px = Math.round(cx + rx * Math.cos(a));
    const py = Math.round(cy + ry * Math.sin(a));
    const key = `${px},${py}`;
    if (!drawn.has(key)) { drawn.add(key); pixels.push({ x: px, y: py }); }
  }
  return pixels;
}

/**
 * Handle a `draw ellipse --clip-to <mask>` by rasterizing the outline,
 * filtering pixels to those inside the mask, and emitting them as points.
 * Keeps the original shape out of the registry entirely — only the clipped
 * pixels persist as named point shapes (`<base>_<i>`).
 */
function handleClippedEllipse(state, params, cell) {
  const mask = cell.shapes.get(params.clip_to);
  if (!mask) throw new Error(`Clip-to shape "${params.clip_to}" not found`);
  const rx = params.rx, ry = params.ry, cx = params.cx, cy = params.cy;
  if (rx <= 0 || ry <= 0) throw new Error('Ellipse needs positive rx/ry');
  const pixels = rasterizeEllipseOutline(cx, cy, rx, ry);
  const baseName = params.shape_name ?? `clipped`;
  const shapeNames = [];
  let emitted = 0;
  for (const pt of pixels) {
    if (!isInsideShape(mask, pt.x, pt.y)) continue;
    const name = `${baseName}_${emitted++}`;
    const shape = cell.draw('point', { x: pt.x, y: pt.y }, params.color, name);
    state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
    shapeNames.push(name);
  }
  return { shapeNames };
}

/**
 * Handle `draw border` — dilate a set of shapes by 1 pixel (4-neighbor) and
 * emit the new neighboring pixels as named points. Useful for halos, recessed-
 * seam shadows, or outline effects around a group of shapes.
 *
 * Source shapes are chosen by `--shape-prefix` (all cell shapes with names
 * starting with the prefix) or a comma-separated `--shapes` list. Optional
 * `--clip-to <mask>` restricts output to pixels inside the mask.
 */
function handleBorder(state, params, cell) {
  const allShapes = cell.shapes.listByZ();
  let sources = [];
  if (params.shape_prefix) {
    sources = allShapes.filter((s) => s.name && s.name.startsWith(params.shape_prefix));
  } else if (params.shapes) {
    const names = String(params.shapes).split(',').map((s) => s.trim()).filter(Boolean);
    sources = names.map((n) => cell.shapes.get(n)).filter(Boolean);
  }
  if (!sources.length) throw new Error('No shapes matched for border');

  const mask = params.clip_to ? cell.shapes.get(params.clip_to) : null;
  if (params.clip_to && !mask) throw new Error(`Clip-to shape "${params.clip_to}" not found`);

  const occupied = new Set();
  for (const s of sources) {
    for (const k of rasterizeShapeToSet(s)) occupied.add(k);
  }

  const dilated = new Set();
  for (const k of occupied) {
    const [xs, ys] = k.split(',');
    const x = Number(xs), y = Number(ys);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${x + dx},${y + dy}`;
      if (occupied.has(nk)) continue;
      dilated.add(nk);
    }
  }

  const baseName = params.shape_name ?? 'border';
  const shapeNames = [];
  let emitted = 0;
  for (const k of dilated) {
    const [xs, ys] = k.split(',');
    const x = Number(xs), y = Number(ys);
    if (mask && !isInsideShape(mask, x, y)) continue;
    const name = `${baseName}_${emitted++}`;
    const shape = cell.draw('point', { x, y }, params.color, name);
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

  if (type === 'border') {
    return handleBorder(state, params, cell);
  }

  // Clip-to path: rasterize the outline, filter by mask, emit pixels as points.
  // Currently supports unfilled ellipse/circle outlines (the common need).
  if (params.clip_to && (type === 'ellipse' || type === 'circle') && params.filled === false) {
    const r = params.r;
    const rx = type === 'circle' ? r : params.rx;
    const ry = type === 'circle' ? r : params.ry;
    return handleClippedEllipse(state, { ...params, rx, ry }, cell);
  }

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
