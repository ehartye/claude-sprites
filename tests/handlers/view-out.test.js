import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleViewCell, handleViewSheet } from '../../server/handlers/view.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('view --out plumbing', () => {
  let state;
  let tmpDir;
  let outDir;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 1, cols: 2, palette: 'pico8' }),
      broadcast: () => {},
    };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprites-viewout-tmp-'));
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprites-viewout-out-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('cell view writes to the requested path instead of a temp file', () => {
    const out = path.join(outDir, 'cell.png');
    const result = handleViewCell(state, { cell: '0,0', scale: 2, out }, tmpDir);
    expect(result.path).toBe(out);
    expect(fs.readFileSync(out).readUInt32BE(16)).toBe(32);
  });

  it('creates missing parent directories for the out path', () => {
    const out = path.join(outDir, 'nested', 'deep', 'sheet.png');
    const result = handleViewSheet(state, { out }, tmpDir);
    expect(result.path).toBe(out);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('without out, temp-path behavior is unchanged', () => {
    const result = handleViewCell(state, { cell: '0,0' }, tmpDir);
    expect(result.path.startsWith(tmpDir)).toBe(true);
  });
});
