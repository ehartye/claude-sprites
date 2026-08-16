import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleDuplicateShape } from '../../server/handlers/shape.js';

describe('duplicate (same-cell copy with optional mirror)', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 1, palette: 'pico8' }),
      broadcast: () => {},
    };
    handleDraw(state, 'polygon', {
      cell: '0,0', color: '#c2c3c7', shape_name: 'wing_l',
      points: [{ x: 1, y: 5 }, { x: 6, y: 8 }, { x: 6, y: 11 }, { x: 2, y: 9 }],
    });
  });

  function shape(name) {
    return state.project.cells.getCell('0,0').shapes.getByName(name);
  }

  it('duplicates a shape in place with a new name', () => {
    const res = handleDuplicateShape(state, { cell: '0,0', shape: 'wing_l', as: 'wing_b' });
    expect(res.shapeName).toBe('wing_b');
    expect(shape('wing_b').params.points).toEqual(shape('wing_l').params.points);
    expect(shape('wing_b').color).toBe('#c2c3c7');
  });

  it('deep-copies params (editing the copy leaves the original alone)', () => {
    handleDuplicateShape(state, { cell: '0,0', shape: 'wing_l', as: 'wing_b' });
    shape('wing_b').params.points[0].x = 9;
    expect(shape('wing_l').params.points[0].x).toBe(1);
  });

  it('--mirror flips the copy across the cell (the wing_l -> wing_r idiom)', () => {
    handleDuplicateShape(state, { cell: '0,0', shape: 'wing_l', as: 'wing_r', mirror: 'horizontal' });
    // x' = 15 - x for every vertex; y unchanged
    expect(shape('wing_r').params.points[0]).toEqual({ x: 14, y: 5 });
    expect(shape('wing_r').params.points[1]).toEqual({ x: 9, y: 8 });
    expect(shape('wing_l').params.points[0]).toEqual({ x: 1, y: 5 }); // original untouched
  });

  it('defaults the name to <shape>_copy', () => {
    const res = handleDuplicateShape(state, { cell: '0,0', shape: 'wing_l' });
    expect(res.shapeName).toBe('wing_l_copy');
  });

  it('errors on unknown shapes and without a project', () => {
    expect(() => handleDuplicateShape(state, { cell: '0,0', shape: 'ghost' })).toThrow(/ghost/);
    state.project = null;
    expect(() => handleDuplicateShape(state, { cell: '0,0', shape: 'wing_l' })).toThrow('No project');
  });
});
