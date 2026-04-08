import { Shape } from './shape.js';
import { ShapeRegistry } from './shape-registry.js';

export class Cell {
  constructor(size, opts = {}) {
    this.size = size;
    this.name = opts.name ?? null;
    this.shapes = new ShapeRegistry();
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndo = opts.maxUndo ?? 50;
    this._nextZ = 0;
  }

  _exec(command) {
    command.execute();
    this._undoStack.push(command);
    if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
    this._redoStack.length = 0;
  }

  draw(type, params, color, shapeName = null) {
    const shape = new Shape(type, params, color, {
      name: shapeName,
      zIndex: this._nextZ++,
    });
    this._exec({
      execute: () => this.shapes.add(shape),
      undo: () => this.shapes.remove(shape.id),
    });
    return shape;
  }

  moveShape(ref, dx, dy) {
    const shape = this.shapes.get(ref);
    if (!shape) throw new Error(`Shape "${ref}" not found`);
    const oldParams = { ...shape.params };
    const applyMove = () => {
      if ('x' in shape.params) shape.params.x += dx;
      if ('y' in shape.params) shape.params.y += dy;
      if ('x1' in shape.params) { shape.params.x1 += dx; shape.params.y1 += dy; }
      if ('x2' in shape.params) { shape.params.x2 += dx; shape.params.y2 += dy; }
      if ('cx' in shape.params) { shape.params.cx += dx; shape.params.cy += dy; }
    };
    this._exec({
      execute: applyMove,
      undo: () => { Object.assign(shape.params, oldParams); },
    });
  }

  recolorShape(ref, color) {
    const shape = this.shapes.get(ref);
    if (!shape) throw new Error(`Shape "${ref}" not found`);
    const oldColor = shape.color;
    this._exec({
      execute: () => { shape.color = color; },
      undo: () => { shape.color = oldColor; },
    });
  }

  deleteShape(ref) {
    const shape = this.shapes.get(ref);
    if (!shape) throw new Error(`Shape "${ref}" not found`);
    const snapshot = shape.toJSON();
    this._exec({
      execute: () => this.shapes.remove(shape.id),
      undo: () => this.shapes.add(Shape.fromJSON(snapshot)),
    });
  }

  setZ(ref, z) {
    const shape = this.shapes.get(ref);
    if (!shape) throw new Error(`Shape "${ref}" not found`);
    const oldZ = shape.zIndex;
    this._exec({
      execute: () => { shape.zIndex = z; },
      undo: () => { shape.zIndex = oldZ; },
    });
  }

  clear() {
    const snapshot = this.shapes.toJSON();
    this._exec({
      execute: () => this.shapes.clear(),
      undo: () => {
        for (const data of snapshot) this.shapes.add(Shape.fromJSON(data));
      },
    });
  }

  undo() {
    const command = this._undoStack.pop();
    if (!command) return false;
    command.undo();
    this._redoStack.push(command);
    return true;
  }

  redo() {
    const command = this._redoStack.pop();
    if (!command) return false;
    command.execute();
    this._undoStack.push(command);
    return true;
  }

  toJSON() {
    return {
      name: this.name,
      shapes: this.shapes.toJSON(),
    };
  }

  static fromJSON(json, size) {
    const cell = new Cell(size, { name: json.name });
    const shapes = ShapeRegistry.fromJSON(json.shapes);
    for (const shape of shapes.listByZ()) {
      cell.shapes.add(shape);
      if (shape.zIndex >= cell._nextZ) cell._nextZ = shape.zIndex + 1;
    }
    return cell;
  }
}
