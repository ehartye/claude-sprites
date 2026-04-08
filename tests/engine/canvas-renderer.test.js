import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../../server/engine/canvas-renderer.js';
import { Cell } from '../../server/engine/cell.js';
import { Palette } from '../../server/engine/palette.js';

describe('CanvasRenderer', () => {
  const palette = new Palette([
    { name: 'red', color: '#ff0000' },
    { name: 'blue', color: '#0000ff' },
  ]);

  it('renders a cell to a Buffer (PNG)', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 0, y: 0 }, 'red');
    const renderer = new CanvasRenderer(palette);
    const buf = renderer.renderCell(cell);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x4e); // N
    expect(buf[3]).toBe(0x47); // G
  });

  it('renders a point at the correct pixel', () => {
    const cell = new Cell(16);
    cell.draw('point', { x: 5, y: 3 }, '#ff0000');
    const renderer = new CanvasRenderer(palette);
    const imageData = renderer.renderCellRaw(cell);
    // imageData is a flat RGBA array, width=16
    const idx = (3 * 16 + 5) * 4;
    expect(imageData[idx]).toBe(255);     // R
    expect(imageData[idx + 1]).toBe(0);   // G
    expect(imageData[idx + 2]).toBe(0);   // B
    expect(imageData[idx + 3]).toBe(255); // A
  });

  it('renders a filled rect', () => {
    const cell = new Cell(16);
    cell.draw('rect', { x: 2, y: 2, w: 3, h: 3, filled: true }, 'blue');
    const renderer = new CanvasRenderer(palette);
    const imageData = renderer.renderCellRaw(cell);
    // Check center pixel of the rect (3,3)
    const idx = (3 * 16 + 3) * 4;
    expect(imageData[idx]).toBe(0);       // R
    expect(imageData[idx + 1]).toBe(0);   // G
    expect(imageData[idx + 2]).toBe(255); // B
    expect(imageData[idx + 3]).toBe(255); // A
  });

  it('renders shapes in z-order (higher z on top)', () => {
    const cell = new Cell(16);
    cell.draw('rect', { x: 0, y: 0, w: 16, h: 16, filled: true }, '#ff0000');
    cell.draw('rect', { x: 0, y: 0, w: 16, h: 16, filled: true }, '#0000ff');
    const renderer = new CanvasRenderer(palette);
    const imageData = renderer.renderCellRaw(cell);
    // Top shape is blue
    expect(imageData[0]).toBe(0);
    expect(imageData[2]).toBe(255);
  });

  it('renders a line', () => {
    const cell = new Cell(16);
    cell.draw('line', { x1: 0, y1: 0, x2: 15, y2: 0 }, '#ff0000');
    const renderer = new CanvasRenderer(palette);
    const imageData = renderer.renderCellRaw(cell);
    // First pixel should be red
    expect(imageData[0]).toBe(255);
    expect(imageData[3]).toBe(255);
  });

  it('renders multiple cells side by side', () => {
    const cell1 = new Cell(16);
    const cell2 = new Cell(16);
    cell1.draw('rect', { x: 0, y: 0, w: 16, h: 16, filled: true }, 'red');
    cell2.draw('rect', { x: 0, y: 0, w: 16, h: 16, filled: true }, 'blue');
    const renderer = new CanvasRenderer(palette);
    const buf = renderer.renderCells([cell1, cell2]);
    expect(buf).toBeInstanceOf(Buffer);
    // Should be wider than a single cell
  });

  it('renders with chroma background', () => {
    const cell = new Cell(16);
    // No shapes — just background
    const renderer = new CanvasRenderer(palette, { background: { mode: 'chroma', color: '#ff00ff' } });
    const imageData = renderer.renderCellRaw(cell);
    // First pixel should be magenta
    expect(imageData[0]).toBe(255);
    expect(imageData[1]).toBe(0);
    expect(imageData[2]).toBe(255);
    expect(imageData[3]).toBe(255);
  });

  it('skips invisible shapes', () => {
    const cell = new Cell(16);
    const shape = cell.draw('rect', { x: 0, y: 0, w: 16, h: 16, filled: true }, '#ff0000');
    shape.visible = false;
    const renderer = new CanvasRenderer(palette);
    const imageData = renderer.renderCellRaw(cell);
    // Should be transparent (default background)
    expect(imageData[3]).toBe(0);
  });
});
