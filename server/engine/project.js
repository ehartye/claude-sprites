import fs from 'fs';
import { Palette } from './palette.js';
import { CellManager } from './cell-manager.js';
import { GroupManager } from './group-manager.js';

export class Project {
  constructor({ name, cellSize, cells, palette, groups, background }) {
    this.name = name;
    this.cellSize = cellSize;
    this.cells = cells;
    this.palette = palette;
    this.groups = groups;
    this.background = background ?? { mode: 'transparent' };
    this.path = null;
  }

  static create({ name, cellSize, rows, cols, palette: presetName }) {
    const palette = presetName ? Palette.fromPreset(presetName) : new Palette();
    return new Project({
      name,
      cellSize,
      cells: new CellManager(cellSize, rows, cols),
      palette,
      groups: new GroupManager(),
    });
  }

  toJSON() {
    return {
      version: 1,
      name: this.name,
      cellSize: this.cellSize,
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

  static load(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const proj = new Project({
      name: data.name,
      cellSize: data.cellSize,
      cells: CellManager.fromJSON({ rows: data.grid.rows, cols: data.grid.cols, cells: data.cells }, data.cellSize),
      palette: Palette.fromJSON(data.palette),
      groups: GroupManager.fromJSON(data.groups),
      background: data.background,
    });
    proj.path = filePath;
    return proj;
  }

  exportAtlas() {
    const frames = {};
    for (let r = 0; r < this.cells.rows; r++) {
      for (let c = 0; c < this.cells.cols; c++) {
        const cell = this.cells.getCell(`${r},${c}`);
        frames[`${r},${c}`] = {
          x: c * this.cellSize,
          y: r * this.cellSize,
          w: this.cellSize,
          h: this.cellSize,
          name: cell.name,
        };
      }
    }
    return {
      name: this.name,
      cellSize: this.cellSize,
      imageWidth: this.cells.cols * this.cellSize,
      imageHeight: this.cells.rows * this.cellSize,
      frames,
    };
  }
}
