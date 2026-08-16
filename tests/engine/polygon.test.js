import { describe, it, expect } from 'vitest';
import { Cell } from '../../server/engine/cell.js';
import { CellManager } from '../../server/engine/cell-manager.js';
import { CanvasRenderer } from '../../server/engine/canvas-renderer.js';
import { Palette } from '../../server/engine/palette.js';
import { Shape } from '../../server/engine/shape.js';

function alphaAt(raw, w, x, y) {
  return raw[(y * w + x) * 4 + 3];
}

function renderRaw(cell) {
  return new CanvasRenderer(new Palette()).renderCellRaw(cell);
}

describe('polygon rendering', () => {
  it('draws a closed outline through all vertices', () => {
    const cell = new Cell(16);
    cell.draw('polygon', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }], filled: false }, '#ff0000', 'tri');
    const raw = renderRaw(cell);
    expect(alphaAt(raw, 16, 0, 0)).toBeGreaterThan(0);
    expect(alphaAt(raw, 16, 4, 0)).toBeGreaterThan(0);
    expect(alphaAt(raw, 16, 0, 4)).toBeGreaterThan(0);
    expect(alphaAt(raw, 16, 2, 0)).toBeGreaterThan(0);  // top edge
    expect(alphaAt(raw, 16, 1, 1)).toBe(0);              // interior stays empty
  });

  it('fills the interior when filled', () => {
    const cell = new Cell(16);
    cell.draw('polygon', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }], filled: true }, '#ff0000', 'tri');
    const raw = renderRaw(cell);
    expect(alphaAt(raw, 16, 1, 1)).toBeGreaterThan(0);
  });

  it('polyline stays open (no closing edge)', () => {
    const cell = new Cell(16);
    cell.draw('polyline', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }] }, '#ff0000', 'zig');
    const raw = renderRaw(cell);
    expect(alphaAt(raw, 16, 4, 2)).toBeGreaterThan(0); // second segment
    expect(alphaAt(raw, 16, 2, 2)).toBe(0);             // closing edge absent
  });
});

describe('polygon shape ops', () => {
  it('moveShape shifts every vertex', () => {
    const cell = new Cell(16);
    cell.draw('polygon', { points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }], filled: true }, '#fff', 'tri');
    cell.moveShape('tri', 2, 3);
    const pts = cell.shapes.get('tri').params.points;
    expect(pts[0]).toEqual({ x: 3, y: 4 });
    expect(pts[2]).toEqual({ x: 5, y: 8 });
  });

  it('flipShape mirrors vertices in place about the bbox', () => {
    const cell = new Cell(16);
    cell.draw('polygon', { points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 1, y: 5 }], filled: true }, '#fff', 'tri');
    cell.flipShape('tri', 'horizontal'); // bbox x 1..5, m = 6
    const pts = cell.shapes.get('tri').params.points;
    expect(pts[0]).toEqual({ x: 5, y: 1 });
    expect(pts[1]).toEqual({ x: 1, y: 1 });
    expect(pts[2]).toEqual({ x: 5, y: 5 });
  });

  it('rotateShape 90° about the cell rotates every vertex', () => {
    const cell = new Cell(16);
    cell.draw('polygon', { points: [{ x: 3, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 3 }], filled: true }, '#fff', 'tri');
    cell.rotateShape('tri', 90, { about: 'cell' });
    const pts = cell.shapes.get('tri').params.points;
    expect(pts[0]).toEqual({ x: 14, y: 3 }); // (15 - y, x)
    expect(pts[1]).toEqual({ x: 14, y: 5 });
  });

  it('mirrorCell and shiftCell handle polygons', () => {
    const cm = new CellManager(16, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('polygon', { points: [{ x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 6 }], filled: true }, '#fff', 'tri');
    cm.mirrorCell('0,0', 'horizontal');
    expect(cell.shapes.get('tri').params.points[0]).toEqual({ x: 15, y: 2 });
    cm.shiftCell('0,0', 1, 1);
    expect(cell.shapes.get('tri').params.points[0]).toEqual({ x: 16, y: 3 });
  });

  it('clone deep-copies points (no shared references)', () => {
    const s = new Shape('polygon', { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }], filled: true }, '#fff', { name: 'tri' });
    const c = s.clone();
    c.params.points[0].x = 9;
    expect(s.params.points[0].x).toBe(1);
  });
});
