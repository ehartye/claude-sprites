/**
 * Canvas editor — pixel grid with zoom, pan, and shape rendering.
 * Mirrors server-side CanvasRenderer drawing logic for client-side preview.
 */

const MIN_ZOOM = 2;
const MAX_ZOOM = 40;
const GRID_COLOR = 'rgba(255, 255, 255, 0.12)';
const GRID_HIGHLIGHT = 'rgba(255, 255, 255, 0.25)';

export class CanvasEditor {
  constructor() {
    /** @type {HTMLCanvasElement} */
    this.canvas = null;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = null;

    this.cellSize = 16;
    this.zoom = 16;
    this.panX = 0;
    this.panY = 0;

    this._shapes = [];
    this._background = { mode: 'transparent' };
    this._palette = {};

    this._isPanning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._spaceHeld = false;

    this._pixelClickCb = null;
    this._pixelMoveCb = null;
    this._pixelUpCb = null;
    this._cursorMoveCb = null;
    this._zoomChangeCb = null;
    this._onionSkinData = null;

    this._abortController = null;
  }

  init(container, cellSize = 16) {
    this.cellSize = cellSize;
    this.canvas = document.getElementById('editor-canvas');
    this.ctx = this.canvas.getContext('2d');

    this._resize(container);
    this._bindEvents(container);
    this.render();
  }

  destroy() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /* -- Public API -- */

  setCell(cellData) {
    if (!cellData) return;
    this._shapes = (cellData.shapes || [])
      .filter(s => s.visible !== false)
      .sort((a, b) => a.zIndex - b.zIndex);
    this.render();
  }

  setCellSize(size) {
    this.cellSize = size;
    this.render();
  }

  setPalette(paletteMap) {
    this._palette = paletteMap;
  }

  setBackground(bg) {
    this._background = bg || { mode: 'transparent' };
  }

  setZoom(level) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    if (this._zoomChangeCb) this._zoomChangeCb(this.zoom);
    this.render();
  }

  onPixelClick(cb) { this._pixelClickCb = cb; }
  onPixelMove(cb) { this._pixelMoveCb = cb; }
  onPixelUp(cb) { this._pixelUpCb = cb; }
  onCursorMove(cb) { this._cursorMoveCb = cb; }
  onZoomChange(cb) { this._zoomChangeCb = cb; }

  /**
   * Set onion skin overlay data. Pass null to clear.
   * @param {{ prev: object[], next: object[] }|null} data
   */
  setOnionSkin(data) {
    this._onionSkinData = data;
    this.render();
  }

  /* -- Rendering -- */

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const z = this.zoom;
    const gridPx = this.cellSize * z;

    ctx.clearRect(0, 0, cw, ch);

    // Offset to center the grid
    const ox = Math.floor((cw - gridPx) / 2) + this.panX;
    const oy = Math.floor((ch - gridPx) / 2) + this.panY;

    // Background
    this._renderBackground(ctx, ox, oy, gridPx);

    // Onion skin (rendered before main shapes at 30% opacity)
    if (this._onionSkinData) {
      this._renderOnionSkin(ctx, ox, oy, z);
    }

    // Shapes
    this._renderShapes(ctx, ox, oy, z);

    // Grid
    this._renderGrid(ctx, ox, oy, z);
  }

  _renderBackground(ctx, ox, oy, gridPx) {
    if (this._background.mode === 'chroma') {
      ctx.fillStyle = this._background.color;
      ctx.fillRect(ox, oy, gridPx, gridPx);
    } else {
      // Checkerboard for transparent
      const tileSize = Math.max(4, this.zoom);
      for (let y = 0; y < gridPx; y += tileSize) {
        for (let x = 0; x < gridPx; x += tileSize) {
          const dark = ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2) === 0;
          ctx.fillStyle = dark ? '#2a2a3e' : '#323248';
          const w = Math.min(tileSize, gridPx - x);
          const h = Math.min(tileSize, gridPx - y);
          ctx.fillRect(ox + x, oy + y, w, h);
        }
      }
    }
  }

  _renderOnionSkin(ctx, ox, oy, z) {
    const { prev, next } = this._onionSkinData;
    // Previous frame: blue-tinted at 30% opacity
    if (prev && prev.length > 0) {
      ctx.globalAlpha = 0.3;
      for (const shape of prev) {
        ctx.fillStyle = '#4488ff';
        this._renderOneShape(ctx, ox, oy, z, shape);
      }
      ctx.globalAlpha = 1;
    }
    // Next frame: red-tinted at 30% opacity
    if (next && next.length > 0) {
      ctx.globalAlpha = 0.3;
      for (const shape of next) {
        ctx.fillStyle = '#ff4444';
        this._renderOneShape(ctx, ox, oy, z, shape);
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Render a single shape without setting fillStyle (caller sets it). */
  _renderOneShape(ctx, ox, oy, z, shape) {
    const p = shape.params;
    switch (shape.type) {
      case 'point':
        ctx.fillRect(ox + p.x * z, oy + p.y * z, z, z);
        break;
      case 'line':
        this._drawLine(ctx, ox, oy, z, p.x1, p.y1, p.x2, p.y2);
        break;
      case 'rect':
        if (p.filled) {
          ctx.fillRect(ox + p.x * z, oy + p.y * z, p.w * z, p.h * z);
        } else {
          ctx.fillRect(ox + p.x * z, oy + p.y * z, p.w * z, z);
          ctx.fillRect(ox + p.x * z, oy + (p.y + p.h - 1) * z, p.w * z, z);
          ctx.fillRect(ox + p.x * z, oy + p.y * z, z, p.h * z);
          ctx.fillRect(ox + (p.x + p.w - 1) * z, oy + p.y * z, z, p.h * z);
        }
        break;
      case 'circle':
        if (p.filled) {
          for (let y = -p.r; y <= p.r; y++) {
            for (let x = -p.r; x <= p.r; x++) {
              if (x * x + y * y <= p.r * p.r) {
                ctx.fillRect(ox + (p.cx + x) * z, oy + (p.cy + y) * z, z, z);
              }
            }
          }
        }
        break;
    }
  }

  _renderShapes(ctx, ox, oy, z) {
    for (const shape of this._shapes) {
      const color = this._resolveColor(shape.color);
      ctx.fillStyle = color;

      const p = shape.params;
      switch (shape.type) {
        case 'point':
          ctx.fillRect(ox + p.x * z, oy + p.y * z, z, z);
          break;
        case 'line':
          this._drawLine(ctx, ox, oy, z, p.x1, p.y1, p.x2, p.y2);
          break;
        case 'rect':
          if (p.filled) {
            ctx.fillRect(ox + p.x * z, oy + p.y * z, p.w * z, p.h * z);
          } else {
            ctx.fillRect(ox + p.x * z, oy + p.y * z, p.w * z, z);
            ctx.fillRect(ox + p.x * z, oy + (p.y + p.h - 1) * z, p.w * z, z);
            ctx.fillRect(ox + p.x * z, oy + p.y * z, z, p.h * z);
            ctx.fillRect(ox + (p.x + p.w - 1) * z, oy + p.y * z, z, p.h * z);
          }
          break;
        case 'circle':
          this._drawCircle(ctx, ox, oy, z, p.cx, p.cy, p.r, p.filled);
          break;
        case 'fill':
          // Fill is computed server-side; we just render the resulting pixel data
          // For preview, we show a single pixel marker
          ctx.globalAlpha = 0.5;
          ctx.fillRect(ox + p.x * z, oy + p.y * z, z, z);
          ctx.globalAlpha = 1;
          break;
      }
    }
  }

  _drawLine(ctx, ox, oy, z, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      ctx.fillRect(ox + x * z, oy + y * z, z, z);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  _drawCircle(ctx, ox, oy, z, cx, cy, r, filled) {
    if (filled) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) {
            ctx.fillRect(ox + (cx + x) * z, oy + (cy + y) * z, z, z);
          }
        }
      }
    } else {
      let x = r, y = 0, err = 1 - r;
      while (x >= y) {
        const pts = [
          [cx + x, cy + y], [cx + y, cy + x],
          [cx - y, cy + x], [cx - x, cy + y],
          [cx - x, cy - y], [cx - y, cy - x],
          [cx + y, cy - x], [cx + x, cy - y],
        ];
        for (const [px, py] of pts) {
          ctx.fillRect(ox + px * z, oy + py * z, z, z);
        }
        y++;
        if (err < 0) {
          err += 2 * y + 1;
        } else {
          x--;
          err += 2 * (y - x) + 1;
        }
      }
    }
  }

  _renderGrid(ctx, ox, oy, z) {
    const gridPx = this.cellSize * z;

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i <= this.cellSize; i++) {
      const pos = i * z;
      // Highlight every 8 pixels
      if (i > 0 && i < this.cellSize && i % 8 === 0) continue;
      ctx.moveTo(ox + pos + 0.5, oy);
      ctx.lineTo(ox + pos + 0.5, oy + gridPx);
      ctx.moveTo(ox, oy + pos + 0.5);
      ctx.lineTo(ox + gridPx, oy + pos + 0.5);
    }
    ctx.stroke();

    // Highlight lines every 8 pixels
    ctx.strokeStyle = GRID_HIGHLIGHT;
    ctx.beginPath();
    for (let i = 8; i < this.cellSize; i += 8) {
      const pos = i * z;
      ctx.moveTo(ox + pos + 0.5, oy);
      ctx.lineTo(ox + pos + 0.5, oy + gridPx);
      ctx.moveTo(ox, oy + pos + 0.5);
      ctx.lineTo(ox + gridPx, oy + pos + 0.5);
    }
    ctx.stroke();
  }

  /* -- Color resolution -- */

  _resolveColor(ref) {
    if (!ref) return '#ff00ff';
    if (ref.startsWith('#')) return ref;
    return this._palette[ref] || '#ff00ff';
  }

  /* -- Coordinate mapping -- */

  _canvasToPixel(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const gridPx = this.cellSize * this.zoom;
    const ox = Math.floor((this.canvas.width - gridPx) / 2) + this.panX;
    const oy = Math.floor((this.canvas.height - gridPx) / 2) + this.panY;
    const px = Math.floor((cx - ox) / this.zoom);
    const py = Math.floor((cy - oy) / this.zoom);
    return { x: px, y: py, inBounds: px >= 0 && px < this.cellSize && py >= 0 && py < this.cellSize };
  }

  /* -- Resize -- */

  _resize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.render();
  }

  /* -- Events -- */

  _bindEvents(container) {
    this._abortController = new AbortController();
    const sig = { signal: this._abortController.signal };

    window.addEventListener('resize', () => this._resize(container), sig);

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (this._spaceHeld && e.button === 0)) {
        this._isPanning = true;
        this._panStartX = e.clientX - this.panX;
        this._panStartY = e.clientY - this.panY;
        e.preventDefault();
        return;
      }
      if (e.button === 0 && !this._spaceHeld) {
        const px = this._canvasToPixel(e.clientX, e.clientY);
        if (px.inBounds && this._pixelClickCb) {
          this._pixelClickCb(px.x, px.y, e);
        }
      }
    }, sig);

    this.canvas.addEventListener('mousemove', (e) => {
      if (this._isPanning) {
        this.panX = e.clientX - this._panStartX;
        this.panY = e.clientY - this._panStartY;
        this.render();
        return;
      }
      const px = this._canvasToPixel(e.clientX, e.clientY);
      if (this._cursorMoveCb) this._cursorMoveCb(px.x, px.y, px.inBounds);
      if (px.inBounds && this._pixelMoveCb) this._pixelMoveCb(px.x, px.y, e);
    }, sig);

    this.canvas.addEventListener('mouseup', (e) => {
      if (this._isPanning) {
        this._isPanning = false;
        return;
      }
      if (e.button === 0) {
        const px = this._canvasToPixel(e.clientX, e.clientY);
        if (px.inBounds && this._pixelUpCb) {
          this._pixelUpCb(px.x, px.y, e);
        }
      }
    }, sig);

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      this.setZoom(this.zoom + delta * Math.max(1, Math.floor(this.zoom / 8)));
    }, { passive: false, signal: this._abortController.signal });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), sig);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        this._spaceHeld = true;
        this.canvas.style.cursor = 'grab';
      }
    }, sig);
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceHeld = false;
        this.canvas.style.cursor = 'crosshair';
      }
    }, sig);
  }
}
