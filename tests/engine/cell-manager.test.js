import { describe, it, expect } from 'vitest';
import { CellManager } from '../../server/engine/cell-manager.js';

describe('CellManager', () => {
  it('creates a grid of cells', () => {
    const cm = new CellManager(16, 3, 4);
    expect(cm.rows).toBe(3);
    expect(cm.cols).toBe(4);
    expect(cm.cellSize).toBe(16);
  });

  it('gets a cell by row,col', () => {
    const cm = new CellManager(16, 3, 4);
    const cell = cm.getCell('1,2');
    expect(cell).toBeDefined();
    expect(cell.size).toBe(16);
  });

  it('throws on out-of-bounds', () => {
    const cm = new CellManager(16, 3, 4);
    expect(() => cm.getCell('5,0')).toThrow('out of bounds');
  });

  it('resolves cell by name', () => {
    const cm = new CellManager(16, 2, 2);
    const cell = cm.getCell('0,0');
    cell.name = 'idle_1';
    expect(cm.getCell('idle_1')).toBe(cell);
  });

  it('copies a cell', () => {
    const cm = new CellManager(16, 2, 2);
    const src = cm.getCell('0,0');
    src.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    cm.copyCell('0,0', '0,1');
    const dst = cm.getCell('0,1');
    expect(dst.shapes.listByZ().length).toBe(1);
    expect(dst.shapes.listByZ()[0].type).toBe('rect');
  });

  it('shifts cell contents', () => {
    const cm = new CellManager(16, 2, 2);
    const cell = cm.getCell('0,0');
    cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red');
    cm.shiftCell('0,0', 2, 3);
    expect(cell.shapes.listByZ()[0].params.x).toBe(2);
    expect(cell.shapes.listByZ()[0].params.y).toBe(3);
  });

  it('mirrors a cell horizontally', () => {
    const cm = new CellManager(16, 2, 2);
    const cell = cm.getCell('0,0');
    cell.draw('point', { x: 2, y: 5 }, 'red');
    cm.mirrorCell('0,0', 'horizontal');
    expect(cell.shapes.listByZ()[0].params.x).toBe(13); // 16 - 1 - 2
  });

  it('lists all cells with coordinates', () => {
    const cm = new CellManager(16, 2, 2);
    const list = cm.listCells();
    expect(list.length).toBe(4);
    expect(list[0].coord).toBe('0,0');
  });

  it('enforces max grid size 10x10', () => {
    expect(() => new CellManager(16, 11, 5)).toThrow('max');
  });

  it('serializes and deserializes', () => {
    const cm = new CellManager(16, 2, 2);
    cm.getCell('0,0').draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    cm.getCell('0,0').name = 'idle';
    const json = cm.toJSON();
    const restored = CellManager.fromJSON(json, 16);
    expect(restored.rows).toBe(2);
    expect(restored.getCell('idle').shapes.getByName('box')).toBeDefined();
  });
});
