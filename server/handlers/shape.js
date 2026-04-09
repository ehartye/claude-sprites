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

/** Clone a shape from one cell to another, optionally giving it a new name. */
export function handleCloneShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const srcCell = state.project.cells.getCell(params.from_cell);
  const dstCell = state.project.cells.getCell(params.to_cell);
  const shape = srcCell.shapes.get(params.shape);
  if (!shape) throw new Error(`Shape "${params.shape}" not found`);
  const newShape = dstCell.draw(shape.type, { ...shape.params }, shape.color, params.new_name ?? null);
  state.broadcast?.({ type: 'draw', cell: params.to_cell, shape: newShape.toJSON() });
  return { shapeId: newShape.id };
}

/** Update shape dimensions in-place (w/h for rect, r for circle, rx/ry for ellipse, etc.). */
export function handleResizeShape(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.updateShapeParams(params.shape, params.updates);
  state.broadcast?.({ type: 'shape_resized', cell: params.cell });
}

/** Move a shape to an absolute pixel position. */
export function handleMoveShapeTo(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  const shape = cell.shapes.get(params.shape);
  if (!shape) throw new Error(`Shape "${params.shape}" not found`);
  const p = shape.params;
  let dx = 0, dy = 0;
  if ('cx' in p) { dx = params.x - p.cx; dy = params.y - p.cy; }
  else if ('x1' in p) { dx = params.x - p.x1; dy = params.y - p.y1; }
  else if ('x' in p) { dx = params.x - p.x; dy = params.y - p.y; }
  cell.moveShape(params.shape, dx, dy);
  state.broadcast?.({ type: 'shape_moved', cell: params.cell });
}

/** Move a shape one step up or down in z-order by swapping with its neighbor. */
export function handleShapeZDirection(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  const shapes = cell.shapes.listByZ();
  const idx = shapes.findIndex(s => s.id === params.shape || s.name === params.shape);
  if (idx === -1) throw new Error(`Shape "${params.shape}" not found`);

  let swapIdx = -1;
  if (params.direction === 'up' && idx < shapes.length - 1) swapIdx = idx + 1;
  if (params.direction === 'down' && idx > 0) swapIdx = idx - 1;

  if (swapIdx !== -1) {
    const a = shapes[idx];
    const b = shapes[swapIdx];
    const tmp = a.zIndex;
    a.zIndex = b.zIndex;
    b.zIndex = tmp;
  }
  state.broadcast?.({ type: 'shape_z', cell: params.cell });
}
