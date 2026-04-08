/**
 * App entry — wires canvas editor, WebSocket, and UI panels together.
 */

import { CanvasEditor } from './canvas-editor.js';
import { WebSocketClient } from './websocket.js';
import { ToolManager } from './tools.js';

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

  tools.init({
    send: (msg) => ws.send(msg),
    getCellRef: () => state.activeCell,
    getColor: () => state.activeColor,
  });
  tools.onToolChange((toolId) => { state.activeTool = toolId; });

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

  // Auto-zoom to fit nicely
  const container = document.getElementById('canvas-container');
  const maxDim = Math.min(container.clientWidth, container.clientHeight) * 0.75;
  const idealZoom = Math.floor(maxDim / (data.cellSize || 16));
  editor.setZoom(Math.max(4, Math.min(24, idealZoom)));

  renderPalette();
  renderCellStrip();
  selectCell(state.activeCell);
}

function onDrawUpdate(data) {
  if (!state.project) return;
  // Update local cell data and re-render if it's the active cell
  const cell = findCell(data.cell);
  if (cell && data.shape) {
    cell.shapes.push(data.shape);
    cell.shapes.sort((a, b) => a.zIndex - b.zIndex);
  }
  if (data.cell === state.activeCell) {
    editor.setCell(findCell(state.activeCell));
  }
  renderShapeList();
}

function onShapeUpdate(data) {
  if (!state.project) return;
  if (data.cell === state.activeCell) {
    const cell = findCell(state.activeCell);
    if (cell && data.shapes) {
      cell.shapes = data.shapes;
    }
    editor.setCell(cell);
    renderShapeList();
  }
}

function onCellUpdate(data) {
  if (!state.project) return;
  // Full cell data refresh
  if (data.cell && data.cellData) {
    setCellData(data.cell, data.cellData);
  }
  if (data.cell === state.activeCell) {
    editor.setCell(findCell(state.activeCell));
    renderShapeList();
  }
  renderCellStrip();
}

function onError(data) {
  console.error('Server error:', data.message || data);
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
  renderShapeList();

  // Update active thumb highlight
  document.querySelectorAll('#cell-strip .cell-thumb').forEach((el) => {
    el.classList.toggle('active', el.dataset.ref === ref);
  });
}

function updateCellRef() {
  document.getElementById('cell-ref').textContent = `Cell ${state.activeCell}`;
}

/* -- Palette rendering -- */

function renderPalette() {
  const container = document.getElementById('palette-swatches');
  container.innerHTML = '';

  const entries = Object.entries(state.palette);
  if (entries.length === 0) return;

  // Auto-select first color if none selected
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

/* -- Shape list -- */

function renderShapeList() {
  const ul = document.getElementById('shape-items');
  ul.innerHTML = '';

  const cell = findCell(state.activeCell);
  if (!cell || !cell.shapes) return;

  for (const shape of cell.shapes) {
    const li = document.createElement('li');
    const colorDot = document.createElement('span');
    colorDot.className = 'shape-color';
    const resolved = shape.color?.startsWith('#') ? shape.color : (state.palette[shape.color] || '#888');
    colorDot.style.backgroundColor = resolved;
    li.appendChild(colorDot);

    const label = document.createTextNode(shape.name || `${shape.type} (${shape.id})`);
    li.appendChild(label);

    li.dataset.shapeId = shape.id;
    ul.appendChild(li);
  }
}

/* -- Cell strip -- */

function renderCellStrip() {
  const strip = document.getElementById('cell-strip');
  strip.innerHTML = '';

  if (!state.project) return;

  const { rows, cols } = state.project.grid;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ref = `${r},${c}`;
      const thumb = document.createElement('div');
      thumb.className = 'cell-thumb';
      if (ref === state.activeCell) thumb.classList.add('active');
      thumb.dataset.ref = ref;

      const cell = findCell(ref);
      const name = cell?.name || ref;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = name;
      thumb.appendChild(label);

      thumb.addEventListener('click', () => selectCell(ref));
      strip.appendChild(thumb);
    }
  }
}

/* -- Boot -- */

document.addEventListener('DOMContentLoaded', init);
