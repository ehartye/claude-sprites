import { Cell } from './cell.js';
import { rotateParams } from './transform.js';

export class CellManager {
  constructor(cellSize, rows, cols) {
    if (rows > 10 || cols > 10) throw new Error('Grid max is 10x10');
    if (rows < 1 || cols < 1) throw new Error('Grid must be at least 1x1');
    this.cellSize = cellSize;
    this.rows = rows;
    this.cols = cols;
    this._grid = [];
    for (let r = 0; r < rows; r++) {
      this._grid[r] = [];
      for (let c = 0; c < cols; c++) {
        this._grid[r][c] = new Cell(cellSize);
      }
    }
  }

  _parseCoord(ref) {
    const match = ref.match(/^(\d+),(\d+)$/);
    if (match) {
      const r = parseInt(match[1], 10);
      const c = parseInt(match[2], 10);
      return { r, c };
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this._grid[r][c].name === ref) return { r, c };
      }
    }
    throw new Error(`Cell "${ref}" not found`);
  }

  getCell(ref) {
    const { r, c } = this._parseCoord(ref);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new Error(`Cell ${r},${c} out of bounds (grid is ${this.rows}x${this.cols})`);
    }
    return this._grid[r][c];
  }

  copyCell(fromRef, toRef) {
    const src = this.getCell(fromRef);
    const { r, c } = this._parseCoord(toRef);
    const dest = new Cell(this.cellSize);
    for (const shape of src.shapes.listByZ()) {
      const clone = shape.clone();
      dest.shapes.add(clone);
    }
    this._grid[r][c] = dest;
  }

  shiftCell(ref, dx, dy) {
    const cell = this.getCell(ref);
    for (const shape of cell.shapes.listByZ()) {
      const p = shape.params;
      if ('x' in p) { p.x += dx; p.y += dy; }
      if ('x1' in p) { p.x1 += dx; p.y1 += dy; }
      if ('x2' in p) { p.x2 += dx; p.y2 += dy; }
      if ('cx' in p) { p.cx += dx; p.cy += dy; }
    }
  }

  mirrorCell(ref, axis) {
    const cell = this.getCell(ref);
    const max = this.cellSize - 1;
    for (const shape of cell.shapes.listByZ()) {
      const p = shape.params;
      if (axis === 'horizontal') {
        if ('x1' in p) { p.x1 = max - p.x1; p.x2 = max - p.x2; }
        else if ('cx' in p) { p.cx = max - p.cx; }
        else if ('x' in p && 'w' in p) { p.x = max - p.x - p.w + 1; }
        else if ('x' in p) { p.x = max - p.x; }
      } else {
        if ('y1' in p) { p.y1 = max - p.y1; p.y2 = max - p.y2; }
        else if ('cy' in p) { p.cy = max - p.cy; }
        else if ('y' in p && 'h' in p) { p.y = max - p.y - p.h + 1; }
        else if ('y' in p) { p.y = max - p.y; }
      }
    }
  }

  rotateCell(ref, deg) {
    const cell = this.getCell(ref);
    const m = (this.cellSize - 1) / 2;
    for (const shape of cell.shapes.listByZ()) {
      rotateParams(shape.params, deg, m, m);
    }
  }

  listCells() {
    const result = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this._grid[r][c];
        result.push({
          coord: `${r},${c}`,
          name: cell.name,
          shapeCount: cell.shapes.listByZ().length,
        });
      }
    }
    return result;
  }

  toJSON() {
    const cells = {};
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this._grid[r][c];
        if (cell.shapes.listByZ().length > 0 || cell.name) {
          cells[`${r},${c}`] = cell.toJSON();
        }
      }
    }
    return { rows: this.rows, cols: this.cols, cells };
  }

  static fromJSON(json, cellSize) {
    const cm = new CellManager(cellSize, json.rows, json.cols);
    for (const [coord, cellData] of Object.entries(json.cells)) {
      const { r, c } = cm._parseCoord(coord);
      cm._grid[r][c] = Cell.fromJSON(cellData, cellSize);
    }
    return cm;
  }
}
