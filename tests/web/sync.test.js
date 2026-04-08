import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { dispatchWebMessage } from '../../server/web/http.js';

describe('WebSocket sync', () => {
  let state;
  let broadcasts;

  beforeEach(() => {
    broadcasts = [];
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2 }),
      broadcast: (msg) => broadcasts.push(msg),
    };
  });

  it('dispatches draw operations', () => {
    const result = dispatchWebMessage(state, {
      action: 'draw',
      type: 'rect',
      params: { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000' },
    });
    expect(result.shapeId).toBeDefined();
    expect(broadcasts.length).toBe(1);
  });

  it('dispatches move_shape', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'rect',
      params: { cell: '0,0', x: 0, y: 0, w: 5, h: 5, color: '#ff0000', shape_name: 'box' },
    });
    dispatchWebMessage(state, {
      action: 'move_shape',
      params: { cell: '0,0', name: 'box', dx: 2, dy: 3 },
    });
    const shape = state.project.cells.getCell('0,0').shapes.getByName('box');
    expect(shape.params.x).toBe(2);
    expect(shape.params.y).toBe(3);
  });

  it('dispatches recolor_shape', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' },
    });
    dispatchWebMessage(state, {
      action: 'recolor_shape',
      params: { cell: '0,0', name: 'dot', color: '#00ff00' },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot').color).toBe('#00ff00');
  });

  it('dispatches delete_shape', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' },
    });
    dispatchWebMessage(state, {
      action: 'delete_shape',
      params: { cell: '0,0', name: 'dot' },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot')).toBeNull();
  });

  it('dispatches name_shape', () => {
    const { shapeId } = dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000' },
    });
    dispatchWebMessage(state, {
      action: 'name_shape',
      params: { cell: '0,0', shape_id: shapeId, name: 'pixel' },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('pixel')).toBeDefined();
  });

  it('dispatches set_z', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' },
    });
    dispatchWebMessage(state, {
      action: 'set_z',
      params: { cell: '0,0', name: 'dot', z: 99 },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot').zIndex).toBe(99);
  });

  it('dispatches undo and redo', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000' },
    });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(1);
    dispatchWebMessage(state, { action: 'undo', params: { cell: '0,0' } });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(0);
    dispatchWebMessage(state, { action: 'redo', params: { cell: '0,0' } });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(1);
  });

  it('dispatches shift_cell', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' },
    });
    dispatchWebMessage(state, {
      action: 'shift_cell',
      params: { cell: '0,0', dx: 5, dy: 3 },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot').params.x).toBe(5);
  });

  it('dispatches mirror_cell', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000', shape_name: 'dot' },
    });
    dispatchWebMessage(state, {
      action: 'mirror_cell',
      params: { cell: '0,0', axis: 'horizontal' },
    });
    expect(state.project.cells.getCell('0,0').shapes.getByName('dot').params.x).toBe(15);
  });

  it('dispatches copy_cell', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000' },
    });
    dispatchWebMessage(state, {
      action: 'copy_cell',
      params: { from: '0,0', to: '1,1' },
    });
    expect(state.project.cells.getCell('1,1').shapes.listByZ().length).toBe(1);
  });

  it('dispatches clear_cell', () => {
    dispatchWebMessage(state, {
      action: 'draw',
      type: 'point',
      params: { cell: '0,0', x: 0, y: 0, color: '#ff0000' },
    });
    dispatchWebMessage(state, {
      action: 'clear_cell',
      params: { cell: '0,0' },
    });
    expect(state.project.cells.getCell('0,0').shapes.listByZ().length).toBe(0);
  });

  it('dispatches name_cell', () => {
    dispatchWebMessage(state, {
      action: 'name_cell',
      params: { cell: '0,0', name: 'idle_1' },
    });
    expect(state.project.cells.getCell('0,0').name).toBe('idle_1');
  });

  it('dispatches create_group', () => {
    dispatchWebMessage(state, {
      action: 'create_group',
      params: { name: 'walk', cells: ['0,0', '0,1'] },
    });
    expect(state.project.groups.get('walk')).toEqual(['0,0', '0,1']);
  });

  it('dispatches add_to_group and remove_from_group', () => {
    dispatchWebMessage(state, {
      action: 'create_group',
      params: { name: 'walk', cells: ['0,0'] },
    });
    dispatchWebMessage(state, {
      action: 'add_to_group',
      params: { name: 'walk', cells: ['0,1'] },
    });
    expect(state.project.groups.get('walk')).toEqual(['0,0', '0,1']);
    dispatchWebMessage(state, {
      action: 'remove_from_group',
      params: { name: 'walk', cells: ['0,0'] },
    });
    expect(state.project.groups.get('walk')).toEqual(['0,1']);
  });

  it('throws on unknown action', () => {
    expect(() => dispatchWebMessage(state, { action: 'fly', params: {} }))
      .toThrow('Unknown action');
  });
});
