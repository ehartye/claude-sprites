import { z } from 'zod';

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

export function registerHistoryTools(server, state) {
  server.tool('sprite_undo', 'Undo last action in a cell', {
    cell: z.string().describe('Cell ref'),
  }, (params) => {
    const result = handleUndo(state, params);
    const text = result.success ? `Undid last action in ${params.cell}` : `Nothing to undo in ${params.cell}`;
    return { content: [{ type: 'text', text }] };
  });

  server.tool('sprite_redo', 'Redo last undone action in a cell', {
    cell: z.string().describe('Cell ref'),
  }, (params) => {
    const result = handleRedo(state, params);
    const text = result.success ? `Redid action in ${params.cell}` : `Nothing to redo in ${params.cell}`;
    return { content: [{ type: 'text', text }] };
  });
}
