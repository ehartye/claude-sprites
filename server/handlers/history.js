export function handleUndo(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  const success = cell.undo();
  if (success) state.broadcast?.({ type: 'undo', cell: params.cell });
  return { success };
}

export function handleRedo(state, params) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  const success = cell.redo();
  if (success) state.broadcast?.({ type: 'redo', cell: params.cell });
  return { success };
}
