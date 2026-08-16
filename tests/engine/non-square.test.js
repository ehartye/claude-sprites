import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { CellManager } from '../../server/engine/cell-manager.js';
import { CanvasRenderer } from '../../server/engine/canvas-renderer.js';
import { Palette } from '../../server/engine/palette.js';

describe('Non-square cells', () => {
  it('creates a project with independent cell width/height', () => {
    const p = Project.create({ name: 't', cellWidth: 16, cellHeight: 32, rows: 2, cols: 2 });
    expect(p.cellWidth).toBe(16);
    expect(p.cellHeight).toBe(32);
    const cell = p.cells.getCell('0,0');
    expect(cell.width).toBe(16);
    expect(cell.height).toBe(32);
  });

  it('still accepts legacy square cellSize', () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 2, cols: 2 });
    expect(p.cellWidth).toBe(16);
    expect(p.cellHeight).toBe(16);
  });

  it('round-trips cellWidth/cellHeight through toJSON/fromJSON', () => {
    const p = Project.create({ name: 't', cellWidth: 8, cellHeight: 24, rows: 1, cols: 2 });
    const revived = Project.fromJSON(p.toJSON());
    expect(revived.cellWidth).toBe(8);
    expect(revived.cellHeight).toBe(24);
    expect(revived.cells.getCell('0,1').height).toBe(24);
  });

  it('loads legacy JSON that only has cellSize', () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 1 });
    const json = p.toJSON();
    delete json.cellWidth;
    delete json.cellHeight;
    json.cellSize = 16;
    const revived = Project.fromJSON(json);
    expect(revived.cellWidth).toBe(16);
    expect(revived.cellHeight).toBe(16);
  });

  it('lays out the atlas with per-axis cell dimensions', () => {
    const p = Project.create({ name: 't', cellWidth: 16, cellHeight: 32, rows: 2, cols: 3 });
    const atlas = p.exportAseprite({ imageName: 't.png' });
    expect(atlas.frames[5].frame).toEqual({ x: 32, y: 32, w: 16, h: 32 }); // cell 1,2
    expect(atlas.meta.size).toEqual({ w: 48, h: 64 });
  });

  it('mirrors per-axis on a non-square cell', () => {
    const cm = new CellManager({ w: 8, h: 16 }, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('point', { x: 0, y: 0 }, '#fff', 'dot');
    cm.mirrorCell('0,0', 'horizontal');
    expect(cell.shapes.get('dot').params.x).toBe(7);
    cm.mirrorCell('0,0', 'vertical');
    expect(cell.shapes.get('dot').params.y).toBe(15);
  });

  it('flips a shape about a non-square cell per-axis', () => {
    const cm = new CellManager({ w: 8, h: 16 }, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('point', { x: 2, y: 3 }, '#fff', 'dot');
    cell.flipShape('dot', 'vertical', { about: 'cell' });
    expect(cell.shapes.get('dot').params.y).toBe(12); // (16-1) - 3
    expect(cell.shapes.get('dot').params.x).toBe(2);
  });

  it('rotates about the true center of a non-square cell', () => {
    const cm = new CellManager({ w: 8, h: 16 }, 1, 1);
    const cell = cm.getCell('0,0');
    cell.draw('point', { x: 0, y: 0 }, '#fff', 'dot');
    cm.rotateCell('0,0', 90);
    // pivot (3.5, 7.5): (0,0) -> (3.5 + 7.5, 7.5 - 3.5) = (11, 4)
    expect(cell.shapes.get('dot').params.x).toBe(11);
    expect(cell.shapes.get('dot').params.y).toBe(4);
  });

  it('renders a non-square cell at its true dimensions', () => {
    const p = Project.create({ name: 't', cellWidth: 16, cellHeight: 32, rows: 1, cols: 1 });
    const renderer = new CanvasRenderer(p.palette);
    const raw = renderer.renderCellRaw(p.cells.getCell('0,0'));
    expect(raw.length).toBe(16 * 32 * 4);
  });
});
