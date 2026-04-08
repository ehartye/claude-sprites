import { describe, it, expect } from 'vitest';
import { Shape } from '../../server/engine/shape.js';

describe('Shape', () => {
  it('creates a shape with auto-generated id', () => {
    const shape = new Shape('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red');
    expect(shape.id).toBeDefined();
    expect(shape.type).toBe('rect');
    expect(shape.params).toEqual({ x: 0, y: 0, w: 5, h: 5, filled: true });
    expect(shape.color).toBe('red');
    expect(shape.zIndex).toBe(0);
    expect(shape.visible).toBe(true);
    expect(shape.name).toBeNull();
  });

  it('accepts optional name and zIndex', () => {
    const shape = new Shape('line', { x1: 0, y1: 0, x2: 5, y2: 5 }, 'blue', {
      name: 'diagonal',
      zIndex: 3,
    });
    expect(shape.name).toBe('diagonal');
    expect(shape.zIndex).toBe(3);
  });

  it('generates unique ids', () => {
    const a = new Shape('point', { x: 0, y: 0 }, 'red');
    const b = new Shape('point', { x: 1, y: 1 }, 'red');
    expect(a.id).not.toBe(b.id);
  });

  it('clones with new id', () => {
    const original = new Shape('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', { name: 'box' });
    const clone = original.clone();
    expect(clone.id).not.toBe(original.id);
    expect(clone.type).toBe(original.type);
    expect(clone.params).toEqual(original.params);
    expect(clone.params).not.toBe(original.params); // deep copy
    expect(clone.name).toBeNull(); // clones don't inherit names
  });

  it('serializes to JSON and deserializes', () => {
    const shape = new Shape('circle', { cx: 8, cy: 8, r: 3, filled: false }, 'outline', {
      name: 'head',
      zIndex: 2,
    });
    const json = shape.toJSON();
    const restored = Shape.fromJSON(json);
    expect(restored.id).toBe(shape.id);
    expect(restored.type).toBe('circle');
    expect(restored.params).toEqual({ cx: 8, cy: 8, r: 3, filled: false });
    expect(restored.color).toBe('outline');
    expect(restored.name).toBe('head');
    expect(restored.zIndex).toBe(2);
  });
});
