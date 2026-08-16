import { describe, it, expect } from 'vitest';
import { Cell } from '../../server/engine/cell.js';

describe('Cell', () => {
  it('creates with given size', () => {
    const cell = new Cell(16);
    expect(cell.width).toBe(16);
    expect(cell.height).toBe(16);
    expect(cell.shapes.listByZ()).toEqual([]);
  });

  it('draws a shape and returns it', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red');
    expect(shape.type).toBe('rect');
    expect(cell.shapes.getById(shape.id)).toBe(shape);
  });

  it('draws with auto-incrementing zIndex', () => {
    const cell = new Cell(16);
    const a = cell.draw('point', { x: 0, y: 0 }, 'red');
    const b = cell.draw('point', { x: 1, y: 1 }, 'blue');
    expect(b.zIndex).toBeGreaterThan(a.zIndex);
  });

  it('undoes a draw', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red');
    cell.undo();
    expect(cell.shapes.getById(shape.id)).toBeNull();
  });

  it('redoes an undone draw', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red');
    const id = shape.id;
    cell.undo();
    cell.redo();
    expect(cell.shapes.getById(id)).not.toBeNull();
  });

  it('clears redo stack on new draw after undo', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 0, y: 0 }, 'red');
    cell.undo();
    cell.draw('point', { x: 1, y: 1 }, 'blue');
    cell.redo(); // should be no-op
    expect(cell.shapes.listByZ().length).toBe(1);
  });

  it('respects max undo depth', () => {
    const cell = new Cell(16, { maxUndo: 3 });
    cell.draw('point', { x: 0, y: 0 }, 'a');
    cell.draw('point', { x: 1, y: 1 }, 'b');
    cell.draw('point', { x: 2, y: 2 }, 'c');
    cell.draw('point', { x: 3, y: 3 }, 'd');
    // 4 draws, max 3 undo — oldest should be gone
    cell.undo();
    cell.undo();
    cell.undo();
    cell.undo(); // no-op, stack exhausted
    expect(cell.shapes.listByZ().length).toBe(1); // first draw not undoable
  });

  it('moves a shape with undo support', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    cell.moveShape('box', 3, 2);
    expect(shape.params.x).toBe(3);
    expect(shape.params.y).toBe(2);
    cell.undo();
    expect(shape.params.x).toBe(0);
    expect(shape.params.y).toBe(0);
  });

  it('recolors a shape with undo support', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    cell.recolorShape('box', 'blue');
    expect(shape.color).toBe('blue');
    cell.undo();
    expect(shape.color).toBe('red');
  });

  it('has optional name', () => {
    const cell = new Cell(16);
    expect(cell.name).toBeNull();
    cell.name = 'idle_1';
    expect(cell.name).toBe('idle_1');
  });

  it('serializes and deserializes', () => {
    const cell = new Cell(16);
    cell.name = 'test';
    cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    const json = cell.toJSON();
    const restored = Cell.fromJSON(json, 16);
    expect(restored.name).toBe('test');
    expect(restored.shapes.getByName('box')).toBeDefined();
  });
});
