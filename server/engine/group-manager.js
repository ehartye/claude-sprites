export class GroupManager {
  constructor() {
    this._groups = new Map();
  }

  create(name, cells = []) {
    if (this._groups.has(name)) throw new Error(`Group "${name}" already exists`);
    this._groups.set(name, [...cells]);
  }

  get(name) {
    const group = this._groups.get(name);
    return group ? [...group] : null;
  }

  addCells(name, cells) {
    const group = this._groups.get(name);
    if (!group) throw new Error(`Group "${name}" not found`);
    for (const cell of cells) {
      if (!group.includes(cell)) group.push(cell);
    }
  }

  removeCells(name, cells) {
    const group = this._groups.get(name);
    if (!group) throw new Error(`Group "${name}" not found`);
    const toRemove = new Set(cells);
    const filtered = group.filter((c) => !toRemove.has(c));
    this._groups.set(name, filtered);
  }

  delete(name) {
    this._groups.delete(name);
  }

  list() {
    const result = {};
    for (const [name, cells] of this._groups) {
      result[name] = [...cells];
    }
    return result;
  }

  groupsForCell(cellRef) {
    const result = [];
    for (const [name, cells] of this._groups) {
      if (cells.includes(cellRef)) result.push(name);
    }
    return result;
  }

  toJSON() {
    const result = {};
    for (const [name, cells] of this._groups) {
      result[name] = [...cells];
    }
    return result;
  }

  static fromJSON(json) {
    const gm = new GroupManager();
    for (const [name, cells] of Object.entries(json)) {
      gm.create(name, cells);
    }
    return gm;
  }
}
