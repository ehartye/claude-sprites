import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

describe('highlight/shadow dithering', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 1, palette: 'pico8' }),
      broadcast: () => {},
    };
    handleDraw(state, 'circle', { cell: '0,0', cx: 8, cy: 8, r: 6, color: '#ff004d', shape_name: 'ball' });
  });

  function shapesByName(prefix) {
    return state.project.cells.getCell('0,0').shapes.listByZ()
      .filter(s => s.name && s.name.startsWith(prefix));
  }

  it('adds a checkerboard dither band next to the solid band', () => {
    const res = handleDraw(state, 'highlight', { cell: '0,0', shape: 'ball', count: 6, dither: true });
    const ditherNames = res.shapeNames.filter(n => n.includes('_d_'));
    expect(ditherNames.length).toBeGreaterThan(0);

    const band = shapesByName('ball_hl_').filter(s => !s.name.includes('_d_'));
    const dither = shapesByName('ball_hl_d_');
    const bandKeys = new Set(band.map(s => `${s.params.x},${s.params.y}`));
    for (const d of dither) {
      // checkerboard parity
      expect((((d.params.x + d.params.y) % 2) + 2) % 2).toBe(0);
      // never overlaps the solid band
      expect(bandKeys.has(`${d.params.x},${d.params.y}`)).toBe(false);
      // stays inside the target circle
      const dx = d.params.x - 8, dy = d.params.y - 8;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(36);
    }
  });

  it('dithers rect shadows one step further inward', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 1, y: 1, w: 12, h: 12, color: '#ff004d', shape_name: 'slab' });
    const res = handleDraw(state, 'shadow', { cell: '0,0', shape: 'slab', count: 6, dither: true });
    const dither = shapesByName('slab_sh_d_');
    expect(dither.length).toBeGreaterThan(0);
    for (const d of dither) {
      expect((((d.params.x + d.params.y) % 2) + 2) % 2).toBe(0);
      // strictly inside the 1px-inset band zone (2px inside the bbox)
      expect(d.params.x).toBeGreaterThanOrEqual(3);
      expect(d.params.y).toBeGreaterThanOrEqual(3);
      expect(d.params.x).toBeLessThanOrEqual(10);
      expect(d.params.y).toBeLessThanOrEqual(10);
    }
    expect(res.shapeNames.some(n => n.includes('_d_'))).toBe(true);
  });

  it('emits no dither shapes without the flag', () => {
    const res = handleDraw(state, 'highlight', { cell: '0,0', shape: 'ball', count: 6 });
    expect(res.shapeNames.some(n => n.includes('_d_'))).toBe(false);
  });
});
