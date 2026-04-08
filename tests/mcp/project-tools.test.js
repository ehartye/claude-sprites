import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleNewProject, handleSaveProject, handleSetPalette, handleLoadPalette } from '../../server/mcp/project-tools.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Project tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: null,
      broadcast: () => {},
    };
  });

  it('creates a new project', () => {
    const result = handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 2, grid_cols: 3 });
    expect(state.project).not.toBeNull();
    expect(state.project.name).toBe('test');
    expect(state.project.cellSize).toBe(16);
    expect(state.project.cells.rows).toBe(2);
    expect(state.project.cells.cols).toBe(3);
    expect(result.name).toBe('test');
  });

  it('creates a project with a palette preset', () => {
    handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 1, grid_cols: 1, palette: 'pico8' });
    expect(state.project.palette.list().length).toBe(16);
  });

  it('broadcasts on new project', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 1, grid_cols: 1 });
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('project');
  });

  it('saves and loads a project', () => {
    handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 1, grid_cols: 1 });
    const tmpFile = path.join(os.tmpdir(), `sprites-test-${Date.now()}.sprites`);
    try {
      handleSaveProject(state, { path: tmpFile });
      expect(fs.existsSync(tmpFile)).toBe(true);
      expect(state.project.path).toBe(tmpFile);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('throws on save without project', () => {
    expect(() => handleSaveProject(state, {})).toThrow('No project');
  });

  it('sets palette colors', () => {
    handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 1, grid_cols: 1 });
    handleSetPalette(state, { colors: [{ name: 'red', color: '#ff0000' }, { name: 'blue', color: '#0000ff' }] });
    expect(state.project.palette.list().length).toBe(2);
    expect(state.project.palette.getColor('red')).toBe('#ff0000');
  });

  it('loads a palette preset', () => {
    handleNewProject(state, { name: 'test', cell_size: 16, grid_rows: 1, grid_cols: 1 });
    handleLoadPalette(state, { preset: 'gameboy' });
    expect(state.project.palette.list().length).toBe(4);
  });

  it('throws on set palette without project', () => {
    expect(() => handleSetPalette(state, { colors: [] })).toThrow('No project');
  });

  it('throws on load palette without project', () => {
    expect(() => handleLoadPalette(state, { preset: 'pico8' })).toThrow('No project');
  });
});
