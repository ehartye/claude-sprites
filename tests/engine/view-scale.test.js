import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { CanvasRenderer } from '../../server/engine/canvas-renderer.js';
import { loadImage, createCanvas } from 'canvas';

function pngDims(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('renderer scale option', () => {
  it('upscales single-cell renders by an integer factor', () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 1, palette: 'pico8' });
    const r = new CanvasRenderer(p.palette);
    const buf = r.renderCell(p.cells.getCell('0,0'), { scale: 4 });
    expect(pngDims(buf)).toEqual({ w: 64, h: 64 });
  });

  it('uses nearest-neighbor (a point becomes a crisp solid block)', async () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 1, palette: 'pico8' });
    const cell = p.cells.getCell('0,0');
    cell.draw('point', { x: 0, y: 0 }, '#ff004d', 'dot');
    const r = new CanvasRenderer(p.palette);
    const img = await loadImage(r.renderCell(cell, { scale: 4 }));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const at = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    expect(at(0, 0)).toEqual([255, 0, 77, 255]);
    expect(at(3, 3)).toEqual([255, 0, 77, 255]); // same block, no smoothing blur
    expect(at(4, 4)[3]).toBe(0);                 // next block transparent
  });

  it('upscales sheet renders after composition (gaps included)', () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 2, palette: 'pico8' });
    const r = new CanvasRenderer(p.palette);
    const buf = r.renderSheet(p.cells, { scale: 2 });
    // (2*16 + 1 gap) * 2 = 66 wide, 16 * 2 = 32 tall
    expect(pngDims(buf)).toEqual({ w: 66, h: 32 });
  });

  it('scale 1 (or absent) leaves output unchanged', () => {
    const p = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 1, palette: 'pico8' });
    const r = new CanvasRenderer(p.palette);
    expect(pngDims(r.renderCell(p.cells.getCell('0,0')))).toEqual({ w: 16, h: 16 });
    expect(pngDims(r.renderCell(p.cells.getCell('0,0'), { scale: 1 }))).toEqual({ w: 16, h: 16 });
  });
});
