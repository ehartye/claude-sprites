import { createCanvas } from 'canvas';

export class CanvasRenderer {
  constructor(palette, opts = {}) {
    this.palette = palette;
    this.background = opts.background ?? { mode: 'transparent' };
  }

  _resolveColor(colorRef) {
    return this.palette.resolve(colorRef);
  }

  _applyBackground(ctx, width, height) {
    if (this.background.mode === 'chroma') {
      ctx.fillStyle = this.background.color;
      ctx.fillRect(0, 0, width, height);
    }
    // transparent = default canvas state (all zeros)
  }

  _drawShape(ctx, shape) {
    if (!shape.visible) return;
    const color = this._resolveColor(shape.color);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    const p = shape.params;
    switch (shape.type) {
      case 'point':
        ctx.fillRect(p.x, p.y, 1, 1);
        break;
      case 'line':
        this._drawLine(ctx, p.x1, p.y1, p.x2, p.y2);
        break;
      case 'rect':
        if (p.filled) {
          ctx.fillRect(p.x, p.y, p.w, p.h);
        } else {
          // 1px outline
          ctx.fillRect(p.x, p.y, p.w, 1);           // top
          ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1); // bottom
          ctx.fillRect(p.x, p.y, 1, p.h);            // left
          ctx.fillRect(p.x + p.w - 1, p.y, 1, p.h);  // right
        }
        break;
      case 'circle':
        this._drawCircle(ctx, p.cx, p.cy, p.r, p.filled);
        break;
      case 'ellipse':
        this._drawEllipse(ctx, p.cx, p.cy, p.rx, p.ry, p.filled);
        break;
      case 'fill':
        this._floodFill(ctx, p.x, p.y, color);
        break;
    }
  }

  // Bresenham's line for pixel-perfect lines
  _drawLine(ctx, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      ctx.fillRect(x, y, 1, 1);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // Midpoint circle algorithm
  _drawCircle(ctx, cx, cy, r, filled) {
    if (filled) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) {
            ctx.fillRect(cx + x, cy + y, 1, 1);
          }
        }
      }
    } else {
      let x = r, y = 0, err = 1 - r;
      while (x >= y) {
        ctx.fillRect(cx + x, cy + y, 1, 1);
        ctx.fillRect(cx + y, cy + x, 1, 1);
        ctx.fillRect(cx - y, cy + x, 1, 1);
        ctx.fillRect(cx - x, cy + y, 1, 1);
        ctx.fillRect(cx - x, cy - y, 1, 1);
        ctx.fillRect(cx - y, cy - x, 1, 1);
        ctx.fillRect(cx + y, cy - x, 1, 1);
        ctx.fillRect(cx + x, cy - y, 1, 1);
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

  _drawEllipse(ctx, cx, cy, rx, ry, filled) {
    if (rx <= 0 || ry <= 0) return;
    if (filled) {
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
            ctx.fillRect(cx + x, cy + y, 1, 1);
          }
        }
      }
    } else {
      const steps = Math.max(rx, ry) * 4;
      const drawn = new Set();
      for (let i = 0; i < steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        const px = Math.round(cx + rx * Math.cos(angle));
        const py = Math.round(cy + ry * Math.sin(angle));
        const key = `${px},${py}`;
        if (!drawn.has(key)) { drawn.add(key); ctx.fillRect(px, py, 1, 1); }
      }
    }
  }

  _floodFill(ctx, startX, startY, fillColor) {
    const canvas = ctx.canvas;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    const idx = (startY * w + startX) * 4;
    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    // Parse fill color to RGBA
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = fillColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const fc = tempCtx.getImageData(0, 0, 1, 1).data;
    const fillR = fc[0], fillG = fc[1], fillB = fc[2], fillA = fc[3];

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    const match = (i) =>
      data[i] === targetR && data[i + 1] === targetG &&
      data[i + 2] === targetB && data[i + 3] === targetA;

    const stack = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const i = (y * w + x) * 4;
      if (x < 0 || x >= w || y < 0 || y >= h || !match(i)) continue;
      data[i] = fillR; data[i + 1] = fillG; data[i + 2] = fillB; data[i + 3] = fillA;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  renderCellRaw(cell) {
    const canvas = createCanvas(cell.size, cell.size);
    const ctx = canvas.getContext('2d');
    this._applyBackground(ctx, cell.size, cell.size);
    for (const shape of cell.shapes.listByZ()) {
      this._drawShape(ctx, shape);
    }
    return ctx.getImageData(0, 0, cell.size, cell.size).data;
  }

  renderCell(cell) {
    const canvas = createCanvas(cell.size, cell.size);
    const ctx = canvas.getContext('2d');
    this._applyBackground(ctx, cell.size, cell.size);
    for (const shape of cell.shapes.listByZ()) {
      this._drawShape(ctx, shape);
    }
    return canvas.toBuffer('image/png');
  }

  renderCells(cells, opts = {}) {
    const cols = opts.cols ?? cells.length;
    const rows = Math.ceil(cells.length / cols);
    const size = cells[0].size;
    const gap = opts.gap ?? 1;
    const w = cols * size + (cols - 1) * gap;
    const h = rows * size + (rows - 1) * gap;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    this._applyBackground(ctx, w, h);

    cells.forEach((cell, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = c * (size + gap);
      const y = r * (size + gap);
      const cellCanvas = createCanvas(size, size);
      const cellCtx = cellCanvas.getContext('2d');
      this._applyBackground(cellCtx, size, size);
      for (const shape of cell.shapes.listByZ()) {
        this._drawShape(cellCtx, shape);
      }
      ctx.drawImage(cellCanvas, x, y);
    });

    return canvas.toBuffer('image/png');
  }

  renderSheet(cellManager) {
    const cells = [];
    for (let r = 0; r < cellManager.rows; r++) {
      for (let c = 0; c < cellManager.cols; c++) {
        cells.push(cellManager.getCell(`${r},${c}`));
      }
    }
    return this.renderCells(cells, { cols: cellManager.cols });
  }
}
