import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleMoveShapeTo } from '../../server/handlers/shape.js';

describe('polygon draw tool', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 1 }),
      broadcast: () => {},
    };
  });

  it('draws a polygon from an array of points', () => {
    const res = handleDraw(state, 'polygon', {
      cell: '0,0', color: '#ff0000', shape_name: 'tri',
      points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 6 }],
    });
    expect(res.shapeName).toBe('tri');
    const shape = state.project.cells.getCell('0,0').shapes.getByName('tri');
    expect(shape.type).toBe('polygon');
    expect(shape.params.points).toHaveLength(3);
    expect(shape.params.filled).toBe(true);
  });

  it('parses a "x,y x,y" points string (CLI form)', () => {
    handleDraw(state, 'polyline', {
      cell: '0,0', color: '#ff0000', shape_name: 'zig',
      points: '0,0 4,0 4,4',
    });
    const shape = state.project.cells.getCell('0,0').shapes.getByName('zig');
    expect(shape.params.points).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }]);
  });

  it('rejects a polygon with fewer than 3 points', () => {
    expect(() => handleDraw(state, 'polygon', { cell: '0,0', color: '#f00', points: '0,0 4,4' }))
      .toThrow(/3/);
  });

  it('rejects a polyline with fewer than 2 points', () => {
    expect(() => handleDraw(state, 'polyline', { cell: '0,0', color: '#f00', points: '1,1' }))
      .toThrow(/2/);
  });

  it('move-to anchors on the first vertex', () => {
    handleDraw(state, 'polygon', {
      cell: '0,0', color: '#ff0000', shape_name: 'tri',
      points: [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 6 }],
    });
    handleMoveShapeTo(state, { cell: '0,0', shape: 'tri', x: 0, y: 0 });
    const pts = state.project.cells.getCell('0,0').shapes.getByName('tri').params.points;
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 4, y: 0 });
  });
});
