import { z } from 'zod';

export function handleNameShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.shapes.nameShape(params.shape_id, params.name);
  state.broadcast?.({ type: 'shape_named', cell: params.cell, shapeId: params.shape_id, name: params.name });
}

export function handleMoveShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.moveShape(params.name, params.dx, params.dy);
  state.broadcast?.({ type: 'shape_moved', cell: params.cell, name: params.name, dx: params.dx, dy: params.dy });
}

export function handleRecolorShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.recolorShape(params.name, params.color);
  state.broadcast?.({ type: 'shape_recolored', cell: params.cell, name: params.name, color: params.color });
}

export function handleDeleteShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.deleteShape(params.name);
  state.broadcast?.({ type: 'shape_deleted', cell: params.cell, name: params.name });
}

export function handleListShapes(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  return cell.shapes.listByZ().map((s) => s.toJSON());
}

export function handleSetZ(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.setZ(params.name, params.z);
  state.broadcast?.({ type: 'shape_z', cell: params.cell, name: params.name, z: params.z });
}

export function registerShapeTools(server, state) {
  server.tool('sprite_name_shape', 'Give a name to a shape', {
    cell: z.string(), shape_id: z.string(), name: z.string(),
  }, (params) => {
    handleNameShape(state, params);
    return { content: [{ type: 'text', text: `Named shape ${params.shape_id} as "${params.name}"` }] };
  });

  server.tool('sprite_move_shape', 'Move a named shape by offset', {
    cell: z.string(), name: z.string(),
    dx: z.number(), dy: z.number(),
  }, (params) => {
    handleMoveShape(state, params);
    return { content: [{ type: 'text', text: `Moved "${params.name}" by (${params.dx},${params.dy})` }] };
  });

  server.tool('sprite_recolor_shape', 'Change color of a named shape', {
    cell: z.string(), name: z.string(), color: z.string(),
  }, (params) => {
    handleRecolorShape(state, params);
    return { content: [{ type: 'text', text: `Recolored "${params.name}" to ${params.color}` }] };
  });

  server.tool('sprite_delete_shape', 'Delete a named shape', {
    cell: z.string(), name: z.string(),
  }, (params) => {
    handleDeleteShape(state, params);
    return { content: [{ type: 'text', text: `Deleted "${params.name}"` }] };
  });

  server.tool('sprite_list_shapes', 'List all shapes in a cell', {
    cell: z.string(),
  }, (params) => {
    const shapes = handleListShapes(state, params);
    const lines = shapes.map((s) => `  ${s.name ?? s.id}: ${s.type} z=${s.zIndex} color=${s.color}`);
    return { content: [{ type: 'text', text: `Shapes in ${params.cell}:\n${lines.join('\n')}` }] };
  });

  server.tool('sprite_set_z', 'Change z-order of a shape', {
    cell: z.string(), name: z.string(), z: z.number(),
  }, (params) => {
    handleSetZ(state, params);
    return { content: [{ type: 'text', text: `Set "${params.name}" z-index to ${params.z}` }] };
  });
}
