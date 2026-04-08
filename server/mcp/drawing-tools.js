import { z } from 'zod';

/**
 * Shared draw handler — called by MCP tools and WebSocket dispatch.
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

export function registerDrawingTools(server, state) {
  server.tool('sprite_draw_point', 'Draw a single pixel', {
    cell: z.string().describe('Cell ref (e.g. "0,0" or name)'),
    x: z.number(),
    y: z.number(),
    color: z.string().describe('Hex color or palette name'),
    shape_name: z.string().optional(),
  }, (params) => {
    const result = handleDraw(state, 'point', params);
    return { content: [{ type: 'text', text: `Point at (${params.x},${params.y}) → shape ${result.shapeId}` }] };
  });

  server.tool('sprite_draw_line', 'Draw a line between two points', {
    cell: z.string(),
    x1: z.number(), y1: z.number(),
    x2: z.number(), y2: z.number(),
    color: z.string(),
    shape_name: z.string().optional(),
  }, (params) => {
    const result = handleDraw(state, 'line', params);
    return { content: [{ type: 'text', text: `Line (${params.x1},${params.y1})→(${params.x2},${params.y2}) → shape ${result.shapeId}` }] };
  });

  server.tool('sprite_draw_rect', 'Draw a rectangle', {
    cell: z.string(),
    x: z.number(), y: z.number(),
    w: z.number(), h: z.number(),
    color: z.string(),
    filled: z.boolean().optional().describe('Filled (default true)'),
    shape_name: z.string().optional(),
  }, (params) => {
    const result = handleDraw(state, 'rect', params);
    return { content: [{ type: 'text', text: `Rect ${params.w}x${params.h} at (${params.x},${params.y}) → shape ${result.shapeId}` }] };
  });

  server.tool('sprite_draw_circle', 'Draw a circle', {
    cell: z.string(),
    cx: z.number(), cy: z.number(),
    r: z.number(),
    color: z.string(),
    filled: z.boolean().optional(),
    shape_name: z.string().optional(),
  }, (params) => {
    const result = handleDraw(state, 'circle', params);
    return { content: [{ type: 'text', text: `Circle r=${params.r} at (${params.cx},${params.cy}) → shape ${result.shapeId}` }] };
  });

  server.tool('sprite_flood_fill', 'Flood fill from a point', {
    cell: z.string(),
    x: z.number(), y: z.number(),
    color: z.string(),
    shape_name: z.string().optional(),
  }, (params) => {
    const result = handleDraw(state, 'fill', params);
    return { content: [{ type: 'text', text: `Fill at (${params.x},${params.y}) → shape ${result.shapeId}` }] };
  });
}
