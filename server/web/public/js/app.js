/**
 * App entry — wires canvas editor, WebSocket, tools, panels, and cell nav.
 */

import { CanvasEditor } from './canvas-editor.js';
import { WebSocketClient } from './websocket.js';
import { ToolManager } from './tools.js';
import { ShapePanel, GroupPanel } from './panels.js';
import { CellNavigator } from './cell-nav.js';
import { AnimationPreview } from './animation.js';

/** Application state */
const state = {
  project: null,
  activeCell: '0,0',
  activeTool: 'point',
  activeColor: null,
  palette: {},
};

const editor = new CanvasEditor();
const ws = new WebSocketClient();
const tools = new ToolManager();
const shapePanel = new ShapePanel();
const groupPanel = new GroupPanel();
const cellNav = new CellNavigator();
const animPreview = new AnimationPreview();

/* -- Initialization -- */

function init() {
  const container = document.getElementById('canvas-container');
  editor.init(container, 16);

  ws.connect();
  ws.on('project', onProjectData);
  ws.on('draw', onDrawUpdate);
  ws.on('shape_update', onShapeUpdate);
  ws.on('cell_update', onCellUpdate);
  ws.on('error', onError);

  // MCP tool broadcasts use specific event types — request full state refresh
  const refreshEvents = [
    'shape_named', 'shape_moved', 'shape_recolored', 'shape_deleted', 'shape_z',
    'cell_shifted', 'cell_mirrored', 'cell_copied', 'cell_cleared', 'cell_named',
    'group_created', 'group_cells_added', 'group_cells_removed', 'group_deleted',
    'palette', 'undo', 'redo',
  ];
  for (const evt of refreshEvents) {
    ws.on(evt, () => {
      // Request full project state to resync after MCP mutation
      ws.send({ action: 'get_project' });
    });
  }

  tools.init({
    send: (msg) => ws.send(msg),
    getCellRef: () => state.activeCell,
    getColor: () => state.activeColor,
  });
  tools.onToolChange((toolId) => { state.activeTool = toolId; });

  shapePanel.init({
    onSelect: (shapeId) => {
      shapePanel.setSelected(shapeId);
    },
    onAction: (action, shapeId) => {
      handleShapeAction(action, shapeId);
    },
  });

  animPreview.init();
  animPreview.onOnionSkin((data) => {
    editor.setOnionSkin(data);
  });

  groupPanel.init({
    onSelect: (groupName) => {
      if (groupName && state.project?.groups?.[groupName]) {
        const frames = state.project.groups[groupName];
        cellNav.setFilter(frames);
        animPreview.setFrames(frames);
      } else {
        cellNav.setFilter(null);
        animPreview.setFrames([]);
      }
    },
    onCreate: () => {
      const name = prompt('Group name:');
      if (name) {
        ws.send({ action: 'create_group', params: { name, cells: [] } });
      }
    },
    onDelete: (name) => {
      ws.send({ action: 'delete_group', params: { name } });
    },
  });

  cellNav.init({
    onSelect: (ref) => selectCell(ref),
  });

  editor.onPixelClick((x, y) => tools.handleClick(x, y));
  editor.onPixelMove((x, y) => tools.handleMove(x, y));
  editor.onPixelUp((x, y) => tools.handleUp(x, y));
  editor.onCursorMove((x, y, inBounds) => {
    document.getElementById('cursor-pos').textContent = inBounds ? `${x}, ${y}` : '—';
  });
  editor.onZoomChange((zoom) => {
    document.getElementById('zoom-level').textContent = `${zoom}x`;
  });

  updateCellRef();
}

/* -- WebSocket handlers -- */

function onProjectData(data) {
  state.project = data;
  document.getElementById('project-name').textContent = data.name || 'Untitled';

  // Set up palette lookup
  state.palette = {};
  if (data.palette) {
    for (const { name, color } of data.palette) {
      state.palette[name] = color;
    }
  }
  editor.setPalette(state.palette);
  editor.setBackground(data.background);
  editor.setCellSize(data.cellSize || 16);
  shapePanel.setPalette(state.palette);
  cellNav.setPalette(state.palette);
  animPreview.setPalette(state.palette);
  animPreview.setCellSize(data.cellSize || 16);
  animPreview.setCells(data.cells || {});

  // Auto-zoom to fit nicely
  const container = document.getElementById('canvas-container');
  const maxDim = Math.min(container.clientWidth, container.clientHeight) * 0.75;
  const idealZoom = Math.floor(maxDim / (data.cellSize || 16));
  editor.setZoom(Math.max(4, Math.min(24, idealZoom)));

  renderPalette();
  cellNav.setGrid(data.grid.rows, data.grid.cols, data.cellSize || 16);
  cellNav.setCells(data.cells || {});
  cellNav.render();
  groupPanel.setGroups(data.groups || {});
  selectCell(state.activeCell);
}

function onDrawUpdate(data) {
  if (!state.project) return;
  // Ensure cell exists in local state (empty cells aren't in project JSON)
  if (!state.project.cells) state.project.cells = {};
  if (!state.project.cells[data.cell]) {
    state.project.cells[data.cell] = { shapes: [] };
  }
  const cell = state.project.cells[data.cell];
  if (data.shape) {
    if (!cell.shapes) cell.shapes = [];
    cell.shapes.push(data.shape);
    cell.shapes.sort((a, b) => a.zIndex - b.zIndex);
  }
  if (data.cell === state.activeCell) {
    editor.setCell(cell);
    refreshShapePanel();
  }
  cellNav.setCells(state.project.cells);
  cellNav.render();
  animPreview.setCells(state.project.cells);
}

function onShapeUpdate(data) {
  if (!state.project) return;
  if (!state.project.cells) state.project.cells = {};
  if (data.cell && data.shapes) {
    if (!state.project.cells[data.cell]) {
      state.project.cells[data.cell] = { shapes: [] };
    }
    state.project.cells[data.cell].shapes = data.shapes;
  }
  if (data.cell === state.activeCell) {
    editor.setCell(state.project.cells[data.cell]);
    refreshShapePanel();
  }
  cellNav.setCells(state.project.cells);
  cellNav.render();
  animPreview.setCells(state.project.cells);
}

function onCellUpdate(data) {
  if (!state.project) return;
  if (data.cell && data.cellData) {
    setCellData(data.cell, data.cellData);
  }
  if (data.cell === state.activeCell) {
    editor.setCell(findCell(state.activeCell));
    refreshShapePanel();
  }
  cellNav.setCells(state.project.cells || {});
  cellNav.render();
  animPreview.setCells(state.project.cells || {});
}

function onError(data) {
  console.error('Server error:', data.message || data);
}

/* -- Shape actions -- */

function handleShapeAction(action, shapeId) {
  const cell = state.activeCell;
  switch (action) {
    case 'rename': {
      const name = prompt('New shape name:');
      if (name !== null) {
        ws.send({ action: 'rename_shape', params: { cell, shape: shapeId, name } });
      }
      break;
    }
    case 'recolor': {
      const color = prompt('New color (name or #hex):');
      if (color !== null) {
        ws.send({ action: 'recolor_shape', params: { cell, shape: shapeId, color } });
      }
      break;
    }
    case 'z_up':
      ws.send({ action: 'shape_z', params: { cell, shape: shapeId, direction: 'up' } });
      break;
    case 'z_down':
      ws.send({ action: 'shape_z', params: { cell, shape: shapeId, direction: 'down' } });
      break;
    case 'delete':
      ws.send({ action: 'delete_shape', params: { cell, shape: shapeId } });
      break;
  }
}

/* -- Cell helpers -- */

function findCell(ref) {
  if (!state.project || !state.project.cells) return null;
  return state.project.cells[ref] || null;
}

function setCellData(ref, data) {
  if (!state.project || !state.project.cells) return;
  state.project.cells[ref] = data;
}

function selectCell(ref) {
  state.activeCell = ref;
  const cell = findCell(ref);
  editor.setCell(cell);
  updateCellRef();
  refreshShapePanel();
  cellNav.setActive(ref);
  animPreview.setActiveCell(ref);
  editor.setOnionSkin(animPreview.getOnionSkinData());
}

function updateCellRef() {
  document.getElementById('cell-ref').textContent = `Cell ${state.activeCell}`;
}

function refreshShapePanel() {
  const cell = findCell(state.activeCell);
  shapePanel.setShapes(cell?.shapes || []);
}

/* -- Palette rendering -- */

function renderPalette() {
  const container = document.getElementById('palette-swatches');
  container.innerHTML = '';

  const entries = Object.entries(state.palette);
  if (entries.length === 0) return;

  if (!state.activeColor && entries.length > 0) {
    setActiveColor(entries[0][0], entries[0][1]);
  }

  for (const [name, color] of entries) {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    if (name === state.activeColor) swatch.classList.add('active');
    swatch.style.backgroundColor = color;
    swatch.title = `${name} (${color})`;
    swatch.dataset.name = name;
    swatch.addEventListener('click', () => setActiveColor(name, color));
    container.appendChild(swatch);
  }
}

function setActiveColor(name, color) {
  state.activeColor = name;
  document.getElementById('active-color-swatch').style.backgroundColor = color;
  document.getElementById('active-color-name').textContent = name;

  document.querySelectorAll('#palette-swatches .swatch').forEach((el) => {
    el.classList.toggle('active', el.dataset.name === name);
  });
}

/* -- Boot -- */

document.addEventListener('DOMContentLoaded', init);
