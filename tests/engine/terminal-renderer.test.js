import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalRenderer } from '../../server/engine/terminal-renderer.js';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

describe('TerminalRenderer', () => {
  let state;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2, palette: 'pico8' }),
      broadcast: () => {},
    };
  });

  it('renders an empty cell with transparent markers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    expect(typeof output).toBe('string');
    // Should contain dim grey dot markers for transparent pixels
    expect(output).toContain('·');
  });

  it('renders a cell with a colored shape as ANSI blocks', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 2, h: 2, color: '#ff004d' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // ANSI 24-bit color escape: \x1b[38;2;255;0;77m
    expect(output).toContain('\x1b[38;2;255;0;77m');
    // Should contain block characters
    expect(output).toContain('██');
  });

  it('includes hex column headers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Header should contain hex digits 0-F for 16px cell
    expect(output).toContain(' 0');
    expect(output).toContain(' F');
  });

  it('includes hex row headers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    const lines = output.split('\n');
    // Row 0 should start with '0 ' (after header line)
    const rowLines = lines.filter(l => /^[0-9A-F] /.test(l));
    expect(rowLines.length).toBe(16);
  });

  it('includes a color legend with shape names', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#ff004d', shape_name: 'hero' });
    handleDraw(state, 'circle', { cell: '0,0', cx: 10, cy: 10, r: 2, color: '#29adff', shape_name: 'gem' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Legend should contain color hex and shape name
    expect(output).toContain('#ff004d');
    expect(output).toContain('hero');
    expect(output).toContain('#29adff');
    expect(output).toContain('gem');
  });

  it('legend groups multiple shapes with same color', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 2, h: 2, color: '#ff004d', shape_name: 'a' });
    handleDraw(state, 'rect', { cell: '0,0', x: 4, y: 4, w: 2, h: 2, color: '#ff004d', shape_name: 'b' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Both names should appear on the same legend line
    const legendLines = output.split('\n').filter(l => l.includes('#ff004d'));
    expect(legendLines.length).toBe(1);
    expect(legendLines[0]).toContain('a');
    expect(legendLines[0]).toContain('b');
  });

  it('resets ANSI after each colored block', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 1, h: 1, color: '#ff004d' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Reset sequence after block
    expect(output).toContain('\x1b[0m');
  });

  it('handles 32px cell size with sparse headers', () => {
    const bigState = {
      project: Project.create({ name: 'big', cellSize: 32, rows: 1, cols: 1, palette: 'pico8' }),
      broadcast: () => {},
    };
    const cell = bigState.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(bigState.project.palette);
    const output = renderer.renderCell(cell);
    // Should have 32 row lines
    const rowLines = output.split('\n').filter(l => /^[0-9A-F]{1,2} /.test(l));
    expect(rowLines.length).toBe(32);
  });
});
