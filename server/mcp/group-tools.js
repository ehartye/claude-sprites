import { z } from 'zod';

export function handleCreateGroup(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.groups.create(params.name, params.cells);
  state.broadcast?.({ type: 'group_created', name: params.name, cells: params.cells });
}

export function handleAddCells(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.groups.addCells(params.name, params.cells);
  state.broadcast?.({ type: 'group_updated', name: params.name });
}

export function handleRemoveCells(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.groups.removeCells(params.name, params.cells);
  state.broadcast?.({ type: 'group_updated', name: params.name });
}

export function handleListGroups(state, _params) {
  if (!state.project) throw new Error('No project open');
  return state.project.groups.list();
}

export function handleDeleteGroup(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.groups.delete(params.name);
  state.broadcast?.({ type: 'group_deleted', name: params.name });
}

export function handleBatchTransform(state, params) {
  if (!state.project) throw new Error('No project open');
  const cells = state.project.groups.get(params.group);
  if (!cells) throw new Error(`Group "${params.group}" not found`);

  for (const cellRef of cells) {
    switch (params.operation) {
      case 'shift':
        state.project.cells.shiftCell(cellRef, params.dx, params.dy);
        break;
      case 'mirror':
        state.project.cells.mirrorCell(cellRef, params.axis);
        break;
      case 'clear': {
        const cell = state.project.cells.getCell(cellRef);
        cell.clear();
        break;
      }
      default:
        throw new Error(`Unknown batch operation: ${params.operation}`);
    }
  }
  state.broadcast?.({ type: 'batch_transform', group: params.group, operation: params.operation });
}

export function registerGroupTools(server, state) {
  server.tool('sprite_create_group', 'Create a named group of cells', {
    name: z.string(),
    cells: z.array(z.string()).describe('Cell refs to include'),
  }, (params) => {
    handleCreateGroup(state, params);
    return { content: [{ type: 'text', text: `Created group "${params.name}" with ${params.cells.length} cells` }] };
  });

  server.tool('sprite_group_add_cells', 'Add cells to a group', {
    name: z.string(),
    cells: z.array(z.string()),
  }, (params) => {
    handleAddCells(state, params);
    return { content: [{ type: 'text', text: `Added ${params.cells.length} cells to "${params.name}"` }] };
  });

  server.tool('sprite_group_remove_cells', 'Remove cells from a group', {
    name: z.string(),
    cells: z.array(z.string()),
  }, (params) => {
    handleRemoveCells(state, params);
    return { content: [{ type: 'text', text: `Removed ${params.cells.length} cells from "${params.name}"` }] };
  });

  server.tool('sprite_list_groups', 'List all groups', {}, (params) => {
    const groups = handleListGroups(state, params);
    const lines = Object.entries(groups).map(([name, cells]) => `  ${name}: [${cells.join(', ')}]`);
    return { content: [{ type: 'text', text: `Groups:\n${lines.join('\n')}` }] };
  });

  server.tool('sprite_delete_group', 'Delete a group', {
    name: z.string(),
  }, (params) => {
    handleDeleteGroup(state, params);
    return { content: [{ type: 'text', text: `Deleted group "${params.name}"` }] };
  });

  server.tool('sprite_batch_transform', 'Apply an operation to all cells in a group', {
    group: z.string(),
    operation: z.enum(['shift', 'mirror', 'clear']),
    dx: z.number().optional(),
    dy: z.number().optional(),
    axis: z.enum(['horizontal', 'vertical']).optional(),
  }, (params) => {
    handleBatchTransform(state, params);
    return { content: [{ type: 'text', text: `Applied ${params.operation} to group "${params.group}"` }] };
  });
}
