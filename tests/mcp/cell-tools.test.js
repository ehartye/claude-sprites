import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/mcp/drawing-tools.js';
import {
  handleShiftCell, handleMirrorCell, handleCopyCell,
  handleClearCell, handleNameCell, handleListCells,
} from '../../server/mcp/cell-tools.js';

describe('Cell tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
  });

  it('shifts all shapes in a cell', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleShiftCell(state, { cell: '0,0', dx: 3, dy: 2 });
    const shape = state.project.cells.getCell('0,0').shapes.getByName('box');
    expect(shape.params.x).toBe(3);
    expect(shape.params.y).toBe(2);
  });

  it('mirrors a cell horizontally', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' });
    handleMirrorCell(state, { cell: '0,0', axis: 'horizontal' });
    const shape = state.project.cells.getCell('0,0').shapes.getByName('dot');
    expect(shape.params.x).toBe(15); // cellSize - 1
  });

  it('copies a cell', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000' });
    handleCopyCell(state, { from: '0,0', to: '0,1' });
    const dest = state.project.cells.getCell('0,1');
    expect(dest.shapes.listByZ().length).toBe(1);
  });

  it('clears a cell', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000' });
    handleClearCell(state, { cell: '0,0' });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(0);
  });

  it('names a cell', () => {
    handleNameCell(state, { cell: '0,0', name: 'idle_1' });
    expect(state.project.cells.getCell('0,0').name).toBe('idle_1');
  });

  it('lists all cells', () => {
    const list = handleListCells(state, {});
    expect(list.length).toBe(4); // 2x2 grid
    expect(list[0].coord).toBe('0,0');
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleShiftCell(state, { cell: '0,0', dx: 1, dy: 1 })).toThrow('No project');
  });

  it('broadcasts on shift', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000' });
    handleShiftCell(state, { cell: '0,0', dx: 1, dy: 1 });
    expect(messages.some((m) => m.type === 'cell_shifted')).toBe(true);
  });
});
