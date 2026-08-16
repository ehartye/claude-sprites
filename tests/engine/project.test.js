import { describe, it, expect, afterEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join(process.cwd(), '.tmp');
const TMP_FILE = path.join(TMP_DIR, 'test.sprites');

describe('Project', () => {
  afterEach(() => {
    if (fs.existsSync(TMP_FILE)) fs.unlinkSync(TMP_FILE);
    if (fs.existsSync(TMP_DIR)) fs.rmdirSync(TMP_DIR);
  });

  it('creates a new project', () => {
    const proj = Project.create({ name: 'test', cellSize: 16, rows: 3, cols: 4 });
    expect(proj.name).toBe('test');
    expect(proj.cellWidth).toBe(16);
    expect(proj.cells.rows).toBe(3);
    expect(proj.cells.cols).toBe(4);
    expect(proj.palette.list().length).toBe(0);
  });

  it('creates with a preset palette', () => {
    const proj = Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2, palette: 'pico8' });
    expect(proj.palette.list().length).toBe(16);
  });

  it('draws a shape and can access it', () => {
    const proj = Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 });
    const cell = proj.cells.getCell('0,0');
    cell.draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, '#ff0000', 'box');
    expect(cell.shapes.getByName('box')).toBeDefined();
  });

  it('saves to file and loads back', () => {
    const proj = Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 });
    proj.palette.add('red', '#ff0000');
    proj.cells.getCell('0,0').draw('rect', { x: 0, y: 0, w: 5, h: 5, filled: true }, 'red', 'box');
    proj.cells.getCell('0,0').name = 'idle';
    proj.groups.create('anim', ['0,0', '0,1']);

    fs.mkdirSync(TMP_DIR, { recursive: true });
    proj.save(TMP_FILE);

    const loaded = Project.load(TMP_FILE);
    expect(loaded.name).toBe('test');
    expect(loaded.cellWidth).toBe(16);
    expect(loaded.palette.getColor('red')).toBe('#ff0000');
    expect(loaded.cells.getCell('idle').shapes.getByName('box')).toBeDefined();
    expect(loaded.groups.get('anim')).toEqual(['0,0', '0,1']);
  });

  it('serializes to JSON matching design format', () => {
    const proj = Project.create({ name: 'crab', cellSize: 16, rows: 2, cols: 3 });
    const json = proj.toJSON();
    expect(json.version).toBe(1);
    expect(json.name).toBe('crab');
    expect(json.cellWidth).toBe(16);
    expect(json.grid).toEqual({ rows: 2, cols: 3 });
    expect(json.background).toEqual({ mode: 'transparent' });
    expect(json.palette).toEqual([]);
    expect(json.cells).toEqual({});
    expect(json.groups).toEqual({});
  });

  it('exports an Aseprite atlas JSON', () => {
    const proj = Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 3 });
    proj.cells.getCell('0,0').name = 'idle';
    const atlas = proj.exportAseprite({ imageName: 'test.png' });
    expect(atlas.frames[0].frame).toEqual({ x: 0, y: 0, w: 16, h: 16 });
    expect(atlas.frames[0].filename).toBe('0');
    expect(atlas.frames[1].frame.x).toBe(16);
    expect(atlas.frames.at(-1).filename).toBe('idle'); // named-cell alias
    expect(atlas.meta.size).toEqual({ w: 48, h: 32 });
  });
});
