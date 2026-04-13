import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

function mkProject() {
  return {
    project: Project.create({ name: 't', cellSize: 64, rows: 1, cols: 1, palette: 'db-32' }),
    broadcast: () => {},
  };
}

function tiersOf(shapeNames) {
  return new Set(shapeNames.map(n => n.replace(/_\d+$/, '')));
}

describe('draw sphere-shade', () => {
  it('emits 5 tiers on a large (r=16) circle (intensity auto → high)', () => {
    const state = mkProject();
    handleDraw(state, 'circle', { cell: '0,0', cx: 32, cy: 32, r: 16, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball' });
    const tiers = tiersOf(res.shapeNames);
    expect(tiers.has('ball_shade_mid')).toBe(true);
    expect(tiers.has('ball_shade_core')).toBe(true);
    expect(tiers.has('ball_shade_rim')).toBe(true);
    expect(tiers.has('ball_shade_hl')).toBe(true);
    expect(tiers.has('ball_shade_spec')).toBe(true);
  });

  it('low intensity emits 2 tiers', () => {
    const state = mkProject();
    handleDraw(state, 'circle', { cell: '0,0', cx: 8, cy: 8, r: 4, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball', intensity: 'low' });
    const tiers = tiersOf(res.shapeNames);
    expect(tiers.size).toBe(2);
  });

  it('auto picks low for small (r=4) circles', () => {
    const state = mkProject();
    handleDraw(state, 'circle', { cell: '0,0', cx: 8, cy: 8, r: 4, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball' });
    expect(tiersOf(res.shapeNames).size).toBe(2);
  });

  it('auto picks med for medium (r=10) circles', () => {
    const state = mkProject();
    handleDraw(state, 'circle', { cell: '0,0', cx: 16, cy: 16, r: 10, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball' });
    expect(tiersOf(res.shapeNames).size).toBe(3);
  });

  it('errors on rect target', () => {
    const state = mkProject();
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#639bff', shape_name: 'box' });
    expect(() => handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'box' }))
      .toThrow(/circle or ellipse/);
  });

  it('errors on missing target shape', () => {
    const state = mkProject();
    expect(() => handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'nope' }))
      .toThrow(/not found/);
  });

  it('errors on invalid intensity value', () => {
    const state = mkProject();
    handleDraw(state, 'circle', { cell: '0,0', cx: 8, cy: 8, r: 6, color: '#639bff', shape_name: 'ball' });
    expect(() => handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball', intensity: 'bogus' }))
      .toThrow(/low\|med\|high\|auto/);
  });

  it('works on ellipse targets', () => {
    const state = mkProject();
    handleDraw(state, 'ellipse', { cell: '0,0', cx: 32, cy: 32, rx: 16, ry: 12, color: '#639bff', shape_name: 'egg' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'egg' });
    expect(tiersOf(res.shapeNames).size).toBe(5);
  });
});
