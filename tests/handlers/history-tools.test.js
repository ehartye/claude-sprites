import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleUndo, handleRedo } from '../../server/handlers/history.js';

describe('History tools', () => {
  let state;
  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: () => {},
    };
  });

  it('undoes the last draw', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000' });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(1);
    const result = handleUndo(state, { cell: '0,0' });
    expect(result.success).toBe(true);
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(0);
  });

  it('redoes an undone action', () => {
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000' });
    handleUndo(state, { cell: '0,0' });
    const result = handleRedo(state, { cell: '0,0' });
    expect(result.success).toBe(true);
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(1);
  });

  it('returns false when nothing to undo', () => {
    const result = handleUndo(state, { cell: '0,0' });
    expect(result.success).toBe(false);
  });

  it('returns false when nothing to redo', () => {
    const result = handleRedo(state, { cell: '0,0' });
    expect(result.success).toBe(false);
  });

  it('throws without project', () => {
    state.project = null;
    expect(() => handleUndo(state, { cell: '0,0' })).toThrow('No project');
  });

  it('broadcasts on undo', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleDraw(state, 'point', { cell: '0,0', x: 0, y: 0, color: '#ff0000' });
    handleUndo(state, { cell: '0,0' });
    expect(messages.some((m) => m.type === 'undo')).toBe(true);
  });
});
