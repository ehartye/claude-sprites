import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleFlipShape, handleRotateShape } from '../../server/handlers/shape.js';
import { handleRotateCell } from '../../server/handlers/cell.js';

describe('Transform tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
  });

  it('flips a shape about the cell', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 7, color: '#ff0000', shape_name: 'dot' });
    handleFlipShape(state, { cell: '0,0', name: 'dot', axis: 'horizontal', about: 'cell' });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot').params.x).toBe(15);
  });

  it('rotates a shape 90° about itself', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 2, y: 4, w: 6, h: 2, color: '#ff0000', shape_name: 'bar' });
    handleRotateShape(state, { cell: '0,0', name: 'bar', deg: 90 });
    const p = state.project.cells.getCell('0,0').shapes.getByName('bar').params;
    expect(p.w).toBe(2);
    expect(p.h).toBe(6);
  });

  it('rotates a whole cell', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 3, y: 1, color: '#ff0000', shape_name: 'dot' });
    handleRotateCell(state, { cell: '0,0', deg: 90 });
    const p = state.project.cells.getCell('0,0').shapes.getByName('dot').params;
    expect(p.x).toBe(14);
    expect(p.y).toBe(3);
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleFlipShape(state, { cell: '0,0', name: 'x', axis: 'horizontal' })).toThrow('No project');
    expect(() => handleRotateShape(state, { cell: '0,0', name: 'x', deg: 90 })).toThrow('No project');
    expect(() => handleRotateCell(state, { cell: '0,0', deg: 90 })).toThrow('No project');
  });
});
