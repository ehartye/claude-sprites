import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/mcp/drawing-tools.js';
import {
  handleCreateGroup, handleAddCells, handleRemoveCells,
  handleListGroups, handleDeleteGroup, handleBatchTransform,
} from '../../server/mcp/group-tools.js';

describe('Group tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
  });

  it('creates a group', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0', '0,1'] });
    expect(state.project.groups.get('walk')).toEqual(['0,0', '0,1']);
  });

  it('adds cells to a group', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    handleAddCells(state, { name: 'walk', cells: ['0,1'] });
    expect(state.project.groups.get('walk')).toEqual(['0,0', '0,1']);
  });

  it('removes cells from a group', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0', '0,1'] });
    handleRemoveCells(state, { name: 'walk', cells: ['0,1'] });
    expect(state.project.groups.get('walk')).toEqual(['0,0']);
  });

  it('lists groups', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    handleCreateGroup(state, { name: 'idle', cells: ['1,0'] });
    const groups = handleListGroups(state, {});
    expect(Object.keys(groups).length).toBe(2);
  });

  it('deletes a group', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    handleDeleteGroup(state, { name: 'walk' });
    expect(state.project.groups.get('walk')).toBeNull();
  });

  it('batch transforms group cells (shift)', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' });
    handleDraw(state, 'point', { cell: '0,1', x: 0, y: 0, color: '#ff0000', shape_name: 'dot2' });
    handleCreateGroup(state, { name: 'walk', cells: ['0,0', '0,1'] });
    handleBatchTransform(state, { group: 'walk', operation: 'shift', dx: 2, dy: 3 });
    const s1 = state.project.cells.getCell('0,0').shapes.getByName('dot');
    const s2 = state.project.cells.getCell('0,1').shapes.getByName('dot2');
    expect(s1.params.x).toBe(2);
    expect(s2.params.x).toBe(2);
  });

  it('throws on batch shift without dx/dy', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    expect(() => handleBatchTransform(state, { group: 'walk', operation: 'shift' }))
      .toThrow('dx and dy are required');
  });

  it('throws on batch mirror without axis', () => {
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    expect(() => handleBatchTransform(state, { group: 'walk', operation: 'mirror' }))
      .toThrow('axis is required');
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleCreateGroup(state, { name: 'walk', cells: [] })).toThrow('No project');
  });

  it('broadcasts on create', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleCreateGroup(state, { name: 'walk', cells: ['0,0'] });
    expect(messages.some((m) => m.type === 'group_created')).toBe(true);
  });
});
