import fs from 'fs';
import { Palette } from './palette.js';
import { CellManager } from './cell-manager.js';
import { GroupManager } from './group-manager.js';

export class Project {
  constructor({ name, cellWidth, cellHeight, cells, palette, groups, background }) {
    this.name = name;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.cells = cells;
    this.palette = palette;
    this.groups = groups;
    this.background = background ?? { mode: 'transparent' };
    this.path = null;
  }

  static create({ name, cellSize, cellWidth, cellHeight, rows, cols, palette: presetName }) {
    const w = cellWidth ?? cellSize;
    const h = cellHeight ?? cellSize ?? w;
    const palette = presetName ? Palette.fromPreset(presetName) : new Palette();
    return new Project({
      name,
      cellWidth: w,
      cellHeight: h,
      cells: new CellManager({ w, h }, rows, cols),
      palette,
      groups: new GroupManager(),
    });
  }

  toJSON() {
    return {
      version: 1,
      name: this.name,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      grid: { rows: this.cells.rows, cols: this.cells.cols },
      background: this.background,
      palette: this.palette.toJSON(),
      cells: this.cells.toJSON().cells,
      groups: this.groups.toJSON(),
    };
  }

  save(filePath) {
    const p = filePath ?? this.path;
    if (!p) throw new Error('No file path specified');
    fs.writeFileSync(p, JSON.stringify(this.toJSON(), null, 2));
    this.path = p;
  }

  static fromJSON(data) {
    const w = data.cellWidth ?? data.cellSize;
    const h = data.cellHeight ?? data.cellSize ?? w;
    return new Project({
      name: data.name,
      cellWidth: w,
      cellHeight: h,
      cells: CellManager.fromJSON({ rows: data.grid.rows, cols: data.grid.cols, cells: data.cells }, { w, h }),
      palette: Palette.fromJSON(data.palette),
      groups: GroupManager.fromJSON(data.groups),
      background: data.background,
    });
  }

  static load(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const proj = Project.fromJSON(data);
    proj.path = filePath;
    return proj;
  }

  exportAtlas() {
    const frames = {};
    for (let r = 0; r < this.cells.rows; r++) {
      for (let c = 0; c < this.cells.cols; c++) {
        const cell = this.cells.getCell(`${r},${c}`);
        frames[`${r},${c}`] = {
          x: c * this.cellWidth,
          y: r * this.cellHeight,
          w: this.cellWidth,
          h: this.cellHeight,
          name: cell.name,
        };
      }
    }
    return {
      name: this.name,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      imageWidth: this.cells.cols * this.cellWidth,
      imageHeight: this.cells.rows * this.cellHeight,
      frames,
    };
  }
}
