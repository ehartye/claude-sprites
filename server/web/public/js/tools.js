/**
 * Drawing tool handlers — translates mouse events on the canvas into
 * WebSocket operations sent to the server.
 */

const TOOLS = [
  { id: 'point',  label: 'Point',  icon: '.' },
  { id: 'line',   label: 'Line',   icon: '/' },
  { id: 'rect',   label: 'Rect',   icon: '#' },
  { id: 'circle', label: 'Circle', icon: 'O' },
  { id: 'fill',   label: 'Fill',   icon: '%' },
  { id: 'select', label: 'Select', icon: '+' },
];

export class ToolManager {
  constructor() {
    this._activeTool = 'point';
    this._sendFn = null;
    this._getCellRef = null;
    this._getColor = null;

    // Multi-click tool state (line, rect, circle)
    this._startX = null;
    this._startY = null;
    this._dragShape = null;

    this._toolChangeCb = null;
    this._previewCb = null;
  }

  /**
   * Initialize tool buttons in the DOM.
   * @param {object} opts
   * @param {Function} opts.send - Send operation to server via WebSocket
   * @param {Function} opts.getCellRef - Returns current active cell ref string
   * @param {Function} opts.getColor - Returns current active color name
   */
  init({ send, getCellRef, getColor }) {
    this._sendFn = send;
    this._getCellRef = getCellRef;
    this._getColor = getColor;
    this._renderButtons();
  }

  get activeTool() { return this._activeTool; }

  setTool(toolId) {
    this._activeTool = toolId;
    this._resetDrag();
    this._updateButtonHighlight();
    if (this._toolChangeCb) this._toolChangeCb(toolId);
  }

  onToolChange(cb) { this._toolChangeCb = cb; }
  onPreview(cb) { this._previewCb = cb; }

  /* -- Mouse event handlers (called by canvas-editor via app.js) -- */

  handleClick(x, y) {
    const tool = this._activeTool;
    const cell = this._getCellRef();
    const color = this._getColor();

    switch (tool) {
      case 'point':
        this._send({ action: 'draw', type: 'point', params: { cell, x, y, color } });
        break;

      case 'fill':
        this._send({ action: 'draw', type: 'fill', params: { cell, x, y, color } });
        break;

      case 'line':
        if (this._startX === null) {
          this._startX = x;
          this._startY = y;
        } else {
          this._send({
            action: 'draw', type: 'line',
            params: { cell, x1: this._startX, y1: this._startY, x2: x, y2: y, color },
          });
          this._resetDrag();
        }
        break;

      case 'rect':
        if (this._startX === null) {
          this._startX = x;
          this._startY = y;
        }
        break;

      case 'circle':
        if (this._startX === null) {
          this._startX = x;
          this._startY = y;
        }
        break;

      case 'select':
        // Select is handled differently — find shape at pixel
        this._send({ action: 'select', params: { cell, x, y } });
        break;
    }
  }

  handleMove(x, y) {
    if (this._startX === null) return;

    const tool = this._activeTool;
    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      this._emitPreview(tool, x, y);
    }
  }

  handleUp(x, y) {
    const tool = this._activeTool;
    const cell = this._getCellRef();
    const color = this._getColor();

    if (tool === 'rect' && this._startX !== null) {
      const rx = Math.min(this._startX, x);
      const ry = Math.min(this._startY, y);
      const w = Math.abs(x - this._startX) + 1;
      const h = Math.abs(y - this._startY) + 1;
      this._send({
        action: 'draw', type: 'rect',
        params: { cell, x: rx, y: ry, w, h, filled: true, color },
      });
      this._resetDrag();
    }

    if (tool === 'circle' && this._startX !== null) {
      const dx = x - this._startX;
      const dy = y - this._startY;
      const r = Math.round(Math.sqrt(dx * dx + dy * dy));
      this._send({
        action: 'draw', type: 'circle',
        params: { cell, cx: this._startX, cy: this._startY, r, filled: true, color },
      });
      this._resetDrag();
    }

    if (tool === 'select' && this._startX !== null) {
      const dx = x - this._startX;
      const dy = y - this._startY;
      if (dx !== 0 || dy !== 0) {
        this._send({ action: 'move_shape', params: { cell, dx, dy } });
      }
      this._resetDrag();
    }
  }

  /* -- Internal -- */

  _send(msg) {
    if (this._sendFn) this._sendFn(msg);
  }

  _resetDrag() {
    this._startX = null;
    this._startY = null;
    this._dragShape = null;
    if (this._previewCb) this._previewCb(null);
  }

  _emitPreview(tool, x, y) {
    if (!this._previewCb) return;
    const color = this._getColor();

    switch (tool) {
      case 'line':
        this._previewCb({
          type: 'line',
          params: { x1: this._startX, y1: this._startY, x2: x, y2: y },
          color,
        });
        break;
      case 'rect': {
        const rx = Math.min(this._startX, x);
        const ry = Math.min(this._startY, y);
        const w = Math.abs(x - this._startX) + 1;
        const h = Math.abs(y - this._startY) + 1;
        this._previewCb({
          type: 'rect',
          params: { x: rx, y: ry, w, h, filled: true },
          color,
        });
        break;
      }
      case 'circle': {
        const dx = x - this._startX;
        const dy = y - this._startY;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        this._previewCb({
          type: 'circle',
          params: { cx: this._startX, cy: this._startY, r, filled: true },
          color,
        });
        break;
      }
    }
  }

  _renderButtons() {
    const container = document.getElementById('tool-buttons');
    container.innerHTML = '';

    for (const tool of TOOLS) {
      const btn = document.createElement('button');
      btn.dataset.tool = tool.id;
      btn.textContent = tool.label;
      btn.title = tool.label;
      if (tool.id === this._activeTool) btn.classList.add('active');
      btn.addEventListener('click', () => this.setTool(tool.id));
      container.appendChild(btn);
    }
  }

  _updateButtonHighlight() {
    document.querySelectorAll('#tool-buttons button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this._activeTool);
    });
  }
}
