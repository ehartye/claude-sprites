import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleCloneFanout } from '../../server/handlers/cell.js';

function mkState() {
  const project = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 4, palette: 'pico8' });
  handleDraw({ project, broadcast: () => {} }, 'rect', {
    cell: '0,0', x: 0, y: 0, w: 3, h: 3, color: '#ffffff', shape_name: 'base',
  });
  return { project, broadcast: () => {} };
}

describe('handleCloneFanout', () => {
  it('copies source shapes to every destination cell', () => {
    const state = mkState();
    const res = handleCloneFanout(state, { from: '0,0', to: ['0,1', '0,2', '0,3'] });
    expect(res.cloned).toEqual(['0,1', '0,2', '0,3']);
    for (const c of ['0,1', '0,2', '0,3']) {
      const cell = state.project.cells.getCell(c);
      const shape = cell.shapes.get('base');
      expect(shape).toBeDefined();
      expect(shape.type).toBe('rect');
      expect(shape.color).toBe('#ffffff');
    }
    // source unchanged
    expect(state.project.cells.getCell('0,0').shapes.get('base')).toBeDefined();
  });

  it('errors when "to" is missing or empty', () => {
    const state = mkState();
    expect(() => handleCloneFanout(state, { from: '0,0' }))
      .toThrow(/to.*required|non-empty/i);
    expect(() => handleCloneFanout(state, { from: '0,0', to: [] }))
      .toThrow(/to.*required|non-empty/i);
  });

  it('atomic: invalid destination aborts before any copy happens', () => {
    const state = mkState();
    // Snapshot shape names present in '0,1' before the call.
    const before = state.project.cells.getCell('0,1').shapes.listByZ().map(s => s.name);
    expect(() => handleCloneFanout(state, { from: '0,0', to: ['0,1', '9,9'] }))
      .toThrow();
    // '0,1' must not have been copied to.
    const after = state.project.cells.getCell('0,1').shapes.listByZ().map(s => s.name);
    expect(after).toEqual(before);
  });

  it('errors when from === any destination', () => {
    const state = mkState();
    expect(() => handleCloneFanout(state, { from: '0,0', to: ['0,1', '0,0'] }))
      .toThrow(/source|same/i);
  });

  it('broadcasts cell_cloned_fanout event', () => {
    const events = [];
    const project = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 3, palette: 'pico8' });
    handleDraw({ project, broadcast: () => {} }, 'rect', {
      cell: '0,0', x: 0, y: 0, w: 2, h: 2, color: '#fff', shape_name: 'b',
    });
    const state = { project, broadcast: (m) => events.push(m) };
    handleCloneFanout(state, { from: '0,0', to: ['0,1', '0,2'] });
    expect(events.some(e => e.type === 'cell_cloned_fanout')).toBe(true);
  });
});
