/**
 * Cell navigator — thumbnail strip at the bottom showing all cells.
 * Click to switch active cell, filter by group.
 */

export class CellNavigator {
  constructor() {
    this._grid = { rows: 0, cols: 0 };
    this._cellSize = 16;
    this._palette = {};
    this._cells = {};
    this._activeRef = '0,0';
    this._filter = null; // null = all, or array of cell refs

    this._selectCb = null;
  }

  /**
   * @param {object} opts
   * @param {Function} opts.onSelect - Called with cell ref string when clicked
   */
  init({ onSelect }) {
    this._selectCb = onSelect;
  }

  setGrid(rows, cols, cellSize = 16) {
    this._grid = { rows, cols };
    this._cellSize = cellSize;
  }

  setPalette(paletteMap) {
    this._palette = paletteMap;
  }

  setCells(cells) {
    this._cells = cells || {};
  }

  setActive(ref) {
    this._activeRef = ref;
    this._updateHighlight();
  }

  /**
   * Filter to show only specific cells (e.g., cells in a group).
   * Pass null to show all cells.
   * @param {string[]|null} refs
   */
  setFilter(refs) {
    this._filter = refs;
    this.render();
  }

  render() {
    const strip = document.getElementById('cell-strip');
    strip.innerHTML = '';

    const refs = this._filter || this._allRefs();

    for (const ref of refs) {
      const thumb = document.createElement('div');
      thumb.className = 'cell-thumb';
      thumb.dataset.ref = ref;
      if (ref === this._activeRef) thumb.classList.add('active');

      // Thumbnail canvas for cell preview
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      canvas.className = 'cell-thumb-canvas';
      this._renderThumb(canvas, ref);
      thumb.appendChild(canvas);

      const label = document.createElement('span');
      label.className = 'label';
      const cell = this._cells[ref];
      label.textContent = cell?.name || ref;
      thumb.appendChild(label);

      thumb.addEventListener('click', () => {
        this._activeRef = ref;
        this._updateHighlight();
        if (this._selectCb) this._selectCb(ref);
      });

      strip.appendChild(thumb);
    }
  }

  _allRefs() {
    const refs = [];
    for (let r = 0; r < this._grid.rows; r++) {
      for (let c = 0; c < this._grid.cols; c++) {
        refs.push(`${r},${c}`);
      }
    }
    return refs;
  }

  _updateHighlight() {
    document.querySelectorAll('#cell-strip .cell-thumb').forEach((el) => {
      el.classList.toggle('active', el.dataset.ref === this._activeRef);
    });
  }

  /**
   * Render a small preview of the cell's shapes into a thumbnail canvas.
   */
  _renderThumb(canvas, ref) {
    const ctx = canvas.getContext('2d');
    const cell = this._cells[ref];
    if (!cell || !cell.shapes || cell.shapes.length === 0) {
      // Empty cell — draw subtle grid hint
      ctx.fillStyle = '#2a2a3e';
      ctx.fillRect(0, 0, 48, 48);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeRect(0.5, 0.5, 47, 47);
      return;
    }

    const cellSize = this._cellSize;
    const scale = 48 / cellSize;

    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(0, 0, 48, 48);

    const sorted = [...cell.shapes]
      .filter(s => s.visible !== false)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const shape of sorted) {
      ctx.fillStyle = this._resolveColor(shape.color);
      const p = shape.params;

      switch (shape.type) {
        case 'point':
          ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
          break;
        case 'line':
          this._thumbLine(ctx, scale, p.x1, p.y1, p.x2, p.y2);
          break;
        case 'rect':
          if (p.filled) {
            ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
          } else {
            ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, scale);
            ctx.fillRect(p.x * scale, (p.y + p.h - 1) * scale, p.w * scale, scale);
            ctx.fillRect(p.x * scale, p.y * scale, scale, p.h * scale);
            ctx.fillRect((p.x + p.w - 1) * scale, p.y * scale, scale, p.h * scale);
          }
          break;
        case 'circle':
          if (p.filled) {
            for (let y = -p.r; y <= p.r; y++) {
              for (let x = -p.r; x <= p.r; x++) {
                if (x * x + y * y <= p.r * p.r) {
                  ctx.fillRect((p.cx + x) * scale, (p.cy + y) * scale, scale, scale);
                }
              }
            }
          }
          break;
      }
    }
  }

  _resolveColor(ref) {
    if (!ref) return '#888';
    if (ref.startsWith('#')) return ref;
    return this._palette[ref] || '#888';
  }

  _thumbLine(ctx, scale, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      ctx.fillRect(x * scale, y * scale, scale, scale);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
}
