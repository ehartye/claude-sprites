import { z } from 'zod';

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

export function registerCellTools(server, state) {
  server.tool('sprite_shift_cell', 'Shift all shapes in a cell by offset', {
    cell: z.string(), dx: z.number(), dy: z.number(),
  }, (params) => {
    handleShiftCell(state, params);
    return { content: [{ type: 'text', text: `Shifted cell ${params.cell} by (${params.dx},${params.dy})` }] };
  });

  server.tool('sprite_mirror_cell', 'Mirror all shapes in a cell', {
    cell: z.string(),
    axis: z.enum(['horizontal', 'vertical']).describe('Mirror axis'),
  }, (params) => {
    handleMirrorCell(state, params);
    return { content: [{ type: 'text', text: `Mirrored cell ${params.cell} ${params.axis}ly` }] };
  });

  server.tool('sprite_copy_cell', 'Copy one cell to another', {
    from: z.string(), to: z.string(),
  }, (params) => {
    handleCopyCell(state, params);
    return { content: [{ type: 'text', text: `Copied ${params.from} → ${params.to}` }] };
  });

  server.tool('sprite_clear_cell', 'Remove all shapes from a cell', {
    cell: z.string(),
  }, (params) => {
    handleClearCell(state, params);
    return { content: [{ type: 'text', text: `Cleared cell ${params.cell}` }] };
  });

  server.tool('sprite_name_cell', 'Name a cell for reference', {
    cell: z.string(), name: z.string(),
  }, (params) => {
    handleNameCell(state, params);
    return { content: [{ type: 'text', text: `Named cell ${params.cell} as "${params.name}"` }] };
  });

  server.tool('sprite_list_cells', 'List all cells in the grid', {}, (params) => {
    const cells = handleListCells(state, params);
    const lines = cells.map((c) => `  ${c.coord}${c.name ? ` (${c.name})` : ''}: ${c.shapeCount} shapes`);
    return { content: [{ type: 'text', text: `Cells:\n${lines.join('\n')}` }] };
  });
}
