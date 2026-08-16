import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleViewCell, handleViewSheet } from '../../server/handlers/view.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function pngDims(p) {
  const buf = fs.readFileSync(p);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('view scale plumbing', () => {
  let state;
  let tmpDir;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 2, palette: 'pico8' }),
      broadcast: () => {},
    };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprites-viewscale-'));
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('cell view honors scale for PNG output', () => {
    const { path: p } = handleViewCell(state, { cell: '0,0', scale: 8 }, tmpDir);
    expect(pngDims(p)).toEqual({ w: 128, h: 128 });
  });

  it('clamps out-of-range scales', () => {
    const { path: p } = handleViewCell(state, { cell: '0,0', scale: 999 }, tmpDir);
    expect(pngDims(p)).toEqual({ w: 512, h: 512 }); // capped at 32x
  });

  it('sheet view renders with scale', () => {
    const { path: p } = handleViewSheet(state, { scale: 2 }, tmpDir);
    expect(pngDims(p)).toEqual({ w: 66, h: 32 }); // (2*16+1)*2 x 16*2
  });

  it('terminal view still works with a scale present', () => {
    const out = handleViewCell(state, { cell: '0,0', format: 'terminal', scale: 8 }, tmpDir);
    expect(out.terminal).toContain('0 1 2 3');
  });
});
