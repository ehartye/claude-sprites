import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/mcp/drawing-tools.js';
import { handleViewCell, handleViewCells, handleViewSheet, handleExportPng, handleExportJson } from '../../server/mcp/view-tools.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('View tools', () => {
  let state;
  let tmpDir;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
    tmpDir = path.join(os.tmpdir(), `sprites-view-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renders a cell to a temp PNG', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 8, h: 8, color: '#ff0000' });
    const result = handleViewCell(state, { cell: '0,0' }, tmpDir);
    expect(fs.existsSync(result.path)).toBe(true);
    const buf = fs.readFileSync(result.path);
    expect(buf[0]).toBe(0x89); // PNG magic byte
  });

  it('renders multiple cells side by side', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#ff0000' });
    handleDraw(state, 'rect', { cell: '0,1', x: 0, y: 0, w: 4, h: 4, color: '#0000ff' });
    const result = handleViewCells(state, { cells: ['0,0', '0,1'] }, tmpDir);
    expect(fs.existsSync(result.path)).toBe(true);
    const buf = fs.readFileSync(result.path);
    expect(buf[0]).toBe(0x89);
  });

  it('renders full sheet', () => {
    const result = handleViewSheet(state, {}, tmpDir);
    expect(fs.existsSync(result.path)).toBe(true);
    const buf = fs.readFileSync(result.path);
    expect(buf[0]).toBe(0x89);
  });

  it('exports cell to a user-specified path', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 8, h: 8, color: '#ff0000' });
    const outPath = path.join(tmpDir, 'cell-export.png');
    handleExportPng(state, { target: '0,0', path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('exports sheet to a user-specified path', () => {
    const outPath = path.join(tmpDir, 'sheet-export.png');
    handleExportPng(state, { target: 'sheet', path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('exports group to a user-specified path', () => {
    state.project.groups.create('walk', ['0,0', '0,1']);
    const outPath = path.join(tmpDir, 'group-export.png');
    handleExportPng(state, { target: 'walk', path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('exports texture atlas JSON', () => {
    const outPath = path.join(tmpDir, 'atlas.json');
    handleExportJson(state, { path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    const atlas = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(atlas.name).toBe('test');
    expect(atlas.cellSize).toBe(16);
    expect(Object.keys(atlas.frames).length).toBe(4); // 2x2
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleViewCell(state, { cell: '0,0' }, tmpDir)).toThrow('No project');
  });
});
