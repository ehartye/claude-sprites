import { describe, it, expect } from 'vitest';
import { Cell } from '../../server/engine/cell.js';
import { CellManager } from '../../server/engine/cell-manager.js';

describe('Cell.flipShape', () => {
  it('flips a line horizontally about its own center (endpoints swap x)', () => {
    const cell = new Cell(16);
    cell.draw('line', { x1: 2, y1: 3, x2: 10, y2: 5 }, '#fff', 'limb');
    cell.flipShape('limb', 'horizontal');
    const p = cell.shapes.get('limb').params;
    expect(p.x1).toBe(10);
    expect(p.y1).toBe(3);
    expect(p.x2).toBe(2);
    expect(p.y2).toBe(5);
  });

  it('flips a point horizontally about the cell', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 0, y: 7 }, '#fff', 'dot');
    cell.flipShape('dot', 'horizontal', { about: 'cell' });
    expect(cell.shapes.get('dot').params.x).toBe(15);
    expect(cell.shapes.get('dot').params.y).toBe(7);
  });

  it('flips a rect vertically about the cell', () => {
    const cell = new Cell(16);
    cell.draw('rect', { x: 1, y: 1, w: 5, h: 3 }, '#fff', 'box');
    cell.flipShape('box', 'vertical', { about: 'cell' });
    // y' = (size-1) - y - h + 1 = 15 - 1 - 3 + 1 = 12
    expect(cell.shapes.get('box').params.y).toBe(12);
    expect(cell.shapes.get('box').params.x).toBe(1);
  });

  it('is a no-op for a circle flipped about itself', () => {
    const cell = new Cell(16);
    cell.draw('circle', { cx: 8, cy: 8, r: 4 }, '#fff', 'ball');
    cell.flipShape('ball', 'horizontal');
    expect(cell.shapes.get('ball').params.cx).toBe(8);
  });

  it('is undoable', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 0, y: 0 }, '#fff', 'dot');
    cell.flipShape('dot', 'horizontal', { about: 'cell' });
    expect(cell.shapes.get('dot').params.x).toBe(15);
    cell.undo();
    expect(cell.shapes.get('dot').params.x).toBe(0);
    cell.redo();
    expect(cell.shapes.get('dot').params.x).toBe(15);
  });

  it('throws on unknown shape', () => {
    const cell = new Cell(16);
    expect(() => cell.flipShape('ghost', 'horizontal')).toThrow('not found');
  });
});

describe('Cell.rotateShape', () => {
  it('rotates a rect 90° CW about its own center (w/h swap, center kept)', () => {
    const cell = new Cell(16);
    cell.draw('rect', { x: 2, y: 4, w: 6, h: 2 }, '#fff', 'bar');
    cell.rotateShape('bar', 90);
    const p = cell.shapes.get('bar').params;
    expect(p.w).toBe(2);
    expect(p.h).toBe(6);
    expect(p.x).toBe(4);
    expect(p.y).toBe(2);
  });

  it('swaps rx/ry for an ellipse rotated 90°', () => {
    const cell = new Cell(16);
    cell.draw('ellipse', { cx: 8, cy: 8, rx: 5, ry: 2 }, '#fff', 'egg');
    cell.rotateShape('egg', 90);
    const p = cell.shapes.get('egg').params;
    expect(p.rx).toBe(2);
    expect(p.ry).toBe(5);
    expect(p.cx).toBe(8);
    expect(p.cy).toBe(8);
  });

  it('rotates a line 90° CW about its midpoint', () => {
    const cell = new Cell(16);
    cell.draw('line', { x1: 0, y1: 0, x2: 4, y2: 0 }, '#fff', 'limb');
    cell.rotateShape('limb', 90);
    const p = cell.shapes.get('limb').params;
    // horizontal east-pointing line becomes vertical south-pointing (CW, y-down)
    expect(p.x1).toBe(2);
    expect(p.y1).toBe(-2);
    expect(p.x2).toBe(2);
    expect(p.y2).toBe(2);
  });

  it('rotates a point 90° CW about the cell center', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 3, y: 1 }, '#fff', 'dot');
    cell.rotateShape('dot', 90, { about: 'cell' });
    const p = cell.shapes.get('dot').params;
    expect(p.x).toBe(14); // (size-1) - y
    expect(p.y).toBe(3);  // x
  });

  it('rejects angles that are not 90/180/270', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 3, y: 1 }, '#fff', 'dot');
    expect(() => cell.rotateShape('dot', 45)).toThrow(/90/);
  });

  it('is undoable', () => {
    const cell = new Cell(16);
    cell.draw('rect', { x: 2, y: 4, w: 6, h: 2 }, '#fff', 'bar');
    cell.rotateShape('bar', 90);
    cell.undo();
    const p = cell.shapes.get('bar').params;
    expect(p).toEqual({ x: 2, y: 4, w: 6, h: 2 });
  });
});

describe('CellManager.rotateCell', () => {
  it('rotates every shape 90° CW about the cell center', () => {
    const cm = new CellManager(16, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('rect', { x: 0, y: 0, w: 4, h: 2 }, '#fff', 'box');
    cell.draw('circle', { cx: 8, cy: 4, r: 3 }, '#fff', 'ball');
    cm.rotateCell('0,0', 90);
    const box = cell.shapes.get('box').params;
    expect(box).toEqual({ x: 14, y: 0, w: 2, h: 4 });
    const ball = cell.shapes.get('ball').params;
    expect(ball.cx).toBe(11);
    expect(ball.cy).toBe(8);
  });

  it('rotates 180° (point at origin lands at far corner)', () => {
    const cm = new CellManager(16, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('point', { x: 0, y: 0 }, '#fff', 'dot');
    cm.rotateCell('0,0', 180);
    expect(cell.shapes.get('dot').params.x).toBe(15);
    expect(cell.shapes.get('dot').params.y).toBe(15);
  });
});
