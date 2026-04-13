import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

function mkState() {
  return {
    project: Project.create({ name: 't', cellSize: 32, rows: 1, cols: 1, palette: 'pico8' }),
    broadcast: () => {},
  };
}

describe('draw ring', () => {
  it('emits pixels adjacent to the target circle (halo effect)', () => {
    const state = mkState();
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 16, cy: 16, r: 6, color: '#ffffff', shape_name: 'ball',
    });
    const res = handleDraw(state, 'ring', {
      cell: '0,0', shape: 'ball', color: '#000000',
    });
    expect(res.shapeNames.length).toBeGreaterThan(0);
    const cell = state.project.cells.getCell('0,0');
    // Every ring pixel should lie within ~r+1 of the center and be outside r.
    for (const name of res.shapeNames) {
      const s = cell.shapes.get(name);
      const dx = s.params.x - 16;
      const dy = s.params.y - 16;
      const d2 = dx * dx + dy * dy;
      expect(d2).toBeGreaterThan(0);           // not at center
      expect(d2).toBeLessThanOrEqual((6 + 2) * (6 + 2)); // just outside target
    }
  });

  it('defaults shape_name to <target>_ring', () => {
    const state = mkState();
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 16, cy: 16, r: 5, color: '#ffffff', shape_name: 'ball',
    });
    const res = handleDraw(state, 'ring', {
      cell: '0,0', shape: 'ball', color: '#000000',
    });
    expect(res.shapeNames[0]).toMatch(/^ball_ring_/);
  });

  it('honors explicit shape_name', () => {
    const state = mkState();
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 16, cy: 16, r: 5, color: '#ffffff', shape_name: 'ball',
    });
    const res = handleDraw(state, 'ring', {
      cell: '0,0', shape: 'ball', color: '#000000', shape_name: 'halo',
    });
    expect(res.shapeNames[0]).toMatch(/^halo_/);
  });

  it('supports clip_to mask', () => {
    const state = mkState();
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 16, cy: 16, r: 5, color: '#ffffff', shape_name: 'ball',
    });
    handleDraw(state, 'rect', {
      cell: '0,0', x: 16, y: 0, w: 16, h: 32, color: '#cccccc', shape_name: 'rightmask',
    });
    const res = handleDraw(state, 'ring', {
      cell: '0,0', shape: 'ball', color: '#000000', clip_to: 'rightmask',
    });
    const cell = state.project.cells.getCell('0,0');
    for (const name of res.shapeNames) {
      const s = cell.shapes.get(name);
      expect(s.params.x).toBeGreaterThanOrEqual(16);
    }
  });
});
