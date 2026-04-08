import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/mcp/drawing-tools.js';
import {
  handleNameShape, handleMoveShape, handleRecolorShape,
  handleDeleteShape, handleListShapes, handleSetZ,
} from '../../server/mcp/shape-tools.js';

describe('Shape tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
  });

  it('names a shape', () => {
    const { shapeId } = handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000' });
    handleNameShape(state, { cell: '0,0', shape_id: shapeId, name: 'box' });
    const cell = state.project.cells.getCell('0,0');
    expect(cell.shapes.getByName('box')).toBeDefined();
  });

  it('moves a shape', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleMoveShape(state, { cell: '0,0', name: 'box', dx: 3, dy: 2 });
    const shape = state.project.cells.getCell('0,0').shapes.getByName('box');
    expect(shape.params.x).toBe(3);
    expect(shape.params.y).toBe(2);
  });

  it('recolors a shape', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleRecolorShape(state, { cell: '0,0', name: 'box', color: '#0000ff' });
    expect(state.project.cells.getCell('0,0').shapes.getByName('box').color).toBe('#0000ff');
  });

  it('deletes a shape', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleDeleteShape(state, { cell: '0,0', name: 'box' });
    expect(state.project.cells.getCell('0,0').shapes.getByName('box')).toBeNull();
  });

  it('lists shapes', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'a' });
    handleDraw(state, 'point', { cell: '0,0', x: 1, y: 1, color: '#0000ff', shape_name: 'b' });
    const list = handleListShapes(state, { cell: '0,0' });
    expect(list.length).toBe(2);
  });

  it('sets z-index', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleSetZ(state, { cell: '0,0', name: 'box', z: 10 });
    expect(state.project.cells.getCell('0,0').shapes.getByName('box').zIndex).toBe(10);
  });

  it('broadcasts on move', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' });
    handleMoveShape(state, { cell: '0,0', name: 'box', dx: 1, dy: 1 });
    expect(messages.some((m) => m.type === 'shape_moved')).toBe(true);
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleListShapes(state, { cell: '0,0' })).toThrow('No project');
  });
});
