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

  describe('color ramps', () => {
    it('lighter returns next lighter color by name (pico8)', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → lighter → blue (#29adff)
      expect(p.lighter('dark-blue')).toBe('#29adff');
    });

    it('darker returns next darker color by name (pico8)', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → darker → black (#000000)
      expect(p.darker('dark-blue')).toBe('#000000');
    });

    it('lighter clamps at top (white → white)', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('white')).toBe('#fff1e8');
    });

    it('darker clamps at bottom (black → black)', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.darker('black')).toBe('#000000');
    });

    it('accepts hex input and resolves to palette name first', () => {
      const p = Palette.fromPreset('pico8');
      // #1d2b53 is dark-blue → lighter → blue (#29adff)
      expect(p.lighter('#1d2b53')).toBe('#29adff');
    });

    it('returns null for hex not in palette', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('#123456')).toBeNull();
    });

    it('returns null for name not in palette', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('chartreuse')).toBeNull();
    });

    it('works with gameboy palette', () => {
      const p = Palette.fromPreset('gameboy');
      // dark → lighter → light (#8bac0f)
      expect(p.lighter('dark')).toBe('#8bac0f');
      // light → darker → dark (#306230)
      expect(p.darker('light')).toBe('#306230');
    });

    it('gameboy clamps at edges', () => {
      const p = Palette.fromPreset('gameboy');
      expect(p.lighter('lightest')).toBe('#9bbc0f');
      expect(p.darker('darkest')).toBe('#0f380f');
    });

    it('multi-step ramp with strength', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → lighter(1) → blue, lighter(2) → lavender
      expect(p.lighter('dark-blue', 2)).toBe('#83769c');
    });

    it('strength clamps at edge', () => {
      const p = Palette.fromPreset('pico8');
      // white → lighter(3) still white
      expect(p.lighter('white', 3)).toBe('#fff1e8');
    });

    it('pico8 full ramp coverage — every color has lighter and darker', () => {
      const p = Palette.fromPreset('pico8');
      const names = p.list().map(c => c.name);
      for (const name of names) {
        expect(p.lighter(name)).not.toBeNull();
        expect(p.darker(name)).not.toBeNull();
      }
    });

    it('gameboy full ramp coverage', () => {
      const p = Palette.fromPreset('gameboy');
      const names = p.list().map(c => c.name);
      for (const name of names) {
        expect(p.lighter(name)).not.toBeNull();
        expect(p.darker(name)).not.toBeNull();
      }
    });

    it('palette without ramps returns null gracefully', () => {
      const p = new Palette([{ name: 'custom', color: '#aabbcc' }]);
      expect(p.lighter('custom')).toBeNull();
      expect(p.darker('custom')).toBeNull();
    });
  });
});
