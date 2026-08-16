import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleTweenShape } from '../../server/handlers/shape.js';
import { handleCloneFanout } from '../../server/handlers/cell.js';

describe('server-side tween', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 4, palette: 'pico8' }),
      sessionId: 's1',
      db: { getCellGroups: () => ({ fly: ['0,0', '0,1', '0,2', '0,3'] }) },
      broadcast: () => {},
    };
    handleDraw(state, 'circle', { cell: '0,0', cx: 2, cy: 8, r: 2, color: '#ff004d', shape_name: 'ball' });
    handleCloneFanout(state, { from: '0,0', to: ['0,1', '0,2', '0,3'] });
  });

  function cxAt(cell) {
    return state.project.cells.getCell(cell).shapes.getByName('ball').params.cx;
  }

  it('tweens position linearly across the group', () => {
    const res = handleTweenShape(state, { group: 'fly', shape: 'ball', to: { x: 12, y: 8 } });
    expect(res.frames).toBe(4);
    expect(cxAt('0,0')).toBe(2);
    expect(cxAt('0,1')).toBe(5);
    expect(cxAt('0,2')).toBe(9);
    expect(cxAt('0,3')).toBe(12);
  });

  it('tweens numeric params via to_updates', () => {
    handleTweenShape(state, { group: 'fly', shape: 'ball', to_updates: { r: 5 } });
    const rAt = (c) => state.project.cells.getCell(c).shapes.getByName('ball').params.r;
    expect([rAt('0,0'), rAt('0,1'), rAt('0,2'), rAt('0,3')]).toEqual([2, 3, 4, 5]);
  });

  it('applies easing', () => {
    handleTweenShape(state, { group: 'fly', shape: 'ball', from: { x: 2, y: 8 }, to: { x: 12, y: 8 }, ease: 'in' });
    expect(cxAt('0,1')).toBe(3); // 2 + 10*(1/9)
    expect(cxAt('0,2')).toBe(6); // 2 + 10*(4/9)
  });

  it('rejects unknown groups, shapes, and eases', () => {
    expect(() => handleTweenShape(state, { group: 'nope', shape: 'ball', to: { x: 1, y: 1 } })).toThrow(/nope/);
    expect(() => handleTweenShape(state, { group: 'fly', shape: 'ghost', to: { x: 1, y: 1 } })).toThrow(/ghost/);
    expect(() => handleTweenShape(state, { group: 'fly', shape: 'ball', to: { x: 1, y: 1 }, ease: 'bouncy' })).toThrow(/bouncy/);
    expect(() => handleTweenShape(state, { group: 'fly', shape: 'ball' })).toThrow(/to/);
    expect(() => handleTweenShape(state, { group: 'fly', shape: 'ball', to_updates: { filled: 9 } })).toThrow(/filled/);
  });
});
