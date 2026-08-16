import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';

function makeProject() {
  return Project.create({ name: 'hero', cellSize: 16, rows: 2, cols: 2, palette: 'pico8' });
}

describe('Project.exportAseprite', () => {
  it('emits one base frame per grid cell in row-major order (json-array form)', () => {
    const p = makeProject();
    const atlas = p.exportAseprite({ imageName: 'hero.png' });
    expect(atlas.frames).toHaveLength(4);
    const f = atlas.frames[3]; // cell 1,1
    expect(f.frame).toEqual({ x: 16, y: 16, w: 16, h: 16 });
    expect(f.rotated).toBe(false);
    expect(f.trimmed).toBe(false);
    expect(f.spriteSourceSize).toEqual({ x: 0, y: 0, w: 16, h: 16 });
    expect(f.sourceSize).toEqual({ w: 16, h: 16 });
    expect(f.duration).toBe(125); // default 8 fps
  });

  it('fills meta with image name, sheet size, format, and scale', () => {
    const p = makeProject();
    const atlas = p.exportAseprite({ imageName: 'hero.png' });
    expect(atlas.meta.image).toBe('hero.png');
    expect(atlas.meta.size).toEqual({ w: 32, h: 32 });
    expect(atlas.meta.format).toBe('RGBA8888');
    expect(atlas.meta.scale).toBe('1');
  });

  it('appends a frame run per cell group and tags it with the group fps', () => {
    const p = makeProject();
    const atlas = p.exportAseprite({
      imageName: 'hero.png',
      groups: { walk: ['0,0', '0,1'] },
      fpsMap: { walk: 10 },
    });
    expect(atlas.frames).toHaveLength(6);
    const tag = atlas.meta.frameTags.find(t => t.name === 'walk');
    expect(tag).toEqual({ name: 'walk', from: 4, to: 5, direction: 'forward' });
    expect(atlas.frames[4].duration).toBe(100); // 10 fps
    expect(atlas.frames[4].frame).toEqual(atlas.frames[0].frame); // same source rect as 0,0
  });

  it('skips empty groups', () => {
    const p = makeProject();
    const atlas = p.exportAseprite({ imageName: 'hero.png', groups: { ghost: [] } });
    expect(atlas.meta.frameTags).toHaveLength(0);
    expect(atlas.frames).toHaveLength(4);
  });

  it('uses cell names in filenames when set', () => {
    const p = makeProject();
    p.cells.getCell('0,0').name = 'idle';
    const atlas = p.exportAseprite({ imageName: 'hero.png' });
    expect(atlas.frames[0].filename).toContain('idle');
  });

  it('exports the pivot as an Aseprite slice with the pivot point', () => {
    const p = makeProject();
    p.pivot = { x: 8, y: 15 };
    const atlas = p.exportAseprite({ imageName: 'hero.png' });
    expect(atlas.meta.slices).toHaveLength(1);
    const key = atlas.meta.slices[0].keys[0];
    expect(key.bounds).toEqual({ x: 0, y: 0, w: 16, h: 16 });
    expect(key.pivot).toEqual({ x: 8, y: 15 });
  });

  it('emits no slices without a pivot', () => {
    const p = makeProject();
    const atlas = p.exportAseprite({ imageName: 'hero.png' });
    expect(atlas.meta.slices).toEqual([]);
  });

  it('round-trips the pivot through toJSON/fromJSON', () => {
    const p = makeProject();
    p.pivot = { x: 4, y: 12 };
    const revived = Project.fromJSON(p.toJSON());
    expect(revived.pivot).toEqual({ x: 4, y: 12 });
  });
});
