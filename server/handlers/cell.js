export function handleShiftCell(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.cells.shiftCell(params.cell, params.dx, params.dy);
  state.broadcast?.({ type: 'cell_shifted', cell: params.cell, dx: params.dx, dy: params.dy });
}

export function handleMirrorCell(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.cells.mirrorCell(params.cell, params.axis);
  state.broadcast?.({ type: 'cell_mirrored', cell: params.cell, axis: params.axis });
}

export function handleCopyCell(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.cells.copyCell(params.from, params.to);
  state.broadcast?.({ type: 'cell_copied', from: params.from, to: params.to });
}

export function handleClearCell(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.clear();
  state.broadcast?.({ type: 'cell_cleared', cell: params.cell });
}

export function handleNameCell(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  cell.name = params.name;
  state.broadcast?.({ type: 'cell_named', cell: params.cell, name: params.name });
}

export function handleListCells(state, _params) {
  if (!state.project) throw new Error('No project open');
  return state.project.cells.listCells();
}
