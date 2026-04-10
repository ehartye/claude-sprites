let nextId = 1;

export class Shape {
  constructor(type, params, color, opts = {}) {
    this.id = `s${nextId++}`;
    this.type = type;
    this.params = { ...params };
    this.color = color;
    this.name = opts.name ?? null;
    this.zIndex = opts.zIndex ?? 0;
    this.visible = opts.visible ?? true;
  }

  clone() {
    return new Shape(this.type, { ...this.params }, this.color, {
      name: this.name,
      zIndex: this.zIndex,
      visible: this.visible,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      params: { ...this.params },
      color: this.color,
      zIndex: this.zIndex,
      visible: this.visible,
    };
  }

  static fromJSON(json) {
    const shape = new Shape(json.type, json.params, json.color, {
      name: json.name,
      zIndex: json.zIndex,
      visible: json.visible,
    });
    shape.id = json.id;
    return shape;
  }
}
