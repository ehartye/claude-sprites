import { describe, it, expect } from 'vitest';
import { Palette } from '../../server/engine/palette.js';

describe('Palette', () => {
  it('creates with initial colors', () => {
    const p = new Palette([{ name: 'red', color: '#ff0000' }]);
    expect(p.getColor('red')).toBe('#ff0000');
  });

  it('adds a color', () => {
    const p = new Palette();
    p.add('sky', '#87ceeb');
    expect(p.getColor('sky')).toBe('#87ceeb');
  });

  it('throws on duplicate name', () => {
    const p = new Palette([{ name: 'red', color: '#ff0000' }]);
    expect(() => p.add('red', '#cc0000')).toThrow('already exists');
  });

  it('updates a color', () => {
    const p = new Palette([{ name: 'red', color: '#ff0000' }]);
    p.update('red', '#cc0000');
    expect(p.getColor('red')).toBe('#cc0000');
  });

  it('removes a color', () => {
    const p = new Palette([{ name: 'red', color: '#ff0000' }]);
    p.remove('red');
    expect(p.getColor('red')).toBeNull();
  });

  it('lists all colors', () => {
    const p = new Palette([
      { name: 'red', color: '#ff0000' },
      { name: 'blue', color: '#0000ff' },
    ]);
    expect(p.list()).toEqual([
      { name: 'red', color: '#ff0000' },
      { name: 'blue', color: '#0000ff' },
    ]);
  });

  it('resolves hex pass-through', () => {
    const p = new Palette();
    expect(p.resolve('#ff0000')).toBe('#ff0000');
  });

  it('resolves palette name to hex', () => {
    const p = new Palette([{ name: 'red', color: '#ff0000' }]);
    expect(p.resolve('red')).toBe('#ff0000');
  });

  it('serializes and deserializes', () => {
    const p = new Palette([{ name: 'a', color: '#111' }, { name: 'b', color: '#222' }]);
    const json = p.toJSON();
    const restored = Palette.fromJSON(json);
    expect(restored.list()).toEqual(p.list());
  });

  it('loads a preset', () => {
    const p = Palette.fromPreset('pico8');
    expect(p.list().length).toBeGreaterThan(0);
    // PICO-8 has 16 colors
    expect(p.list().length).toBe(16);
  });
});
