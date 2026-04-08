const PRESETS = {
  pico8: [
    { name: 'black', color: '#000000' },
    { name: 'dark-blue', color: '#1d2b53' },
    { name: 'dark-purple', color: '#7e2553' },
    { name: 'dark-green', color: '#008751' },
    { name: 'brown', color: '#ab5236' },
    { name: 'dark-grey', color: '#5f574f' },
    { name: 'light-grey', color: '#c2c3c7' },
    { name: 'white', color: '#fff1e8' },
    { name: 'red', color: '#ff004d' },
    { name: 'orange', color: '#ffa300' },
    { name: 'yellow', color: '#ffec27' },
    { name: 'green', color: '#00e436' },
    { name: 'blue', color: '#29adff' },
    { name: 'lavender', color: '#83769c' },
    { name: 'pink', color: '#ff77a8' },
    { name: 'light-peach', color: '#ffccaa' },
  ],
  gameboy: [
    { name: 'darkest', color: '#0f380f' },
    { name: 'dark', color: '#306230' },
    { name: 'light', color: '#8bac0f' },
    { name: 'lightest', color: '#9bbc0f' },
  ],
  nes: [
    { name: 'black', color: '#000000' },
    { name: 'white', color: '#fcfcfc' },
    { name: 'red', color: '#d82800' },
    { name: 'cyan', color: '#00a8a8' },
    { name: 'purple', color: '#6844fc' },
    { name: 'green', color: '#00a844' },
    { name: 'blue', color: '#0000a8' },
    { name: 'yellow', color: '#f8d878' },
    { name: 'orange', color: '#f87858' },
    { name: 'brown', color: '#ac7c00' },
    { name: 'light-red', color: '#f89898' },
    { name: 'dark-grey', color: '#787878' },
    { name: 'grey', color: '#a8a8a8' },
    { name: 'light-green', color: '#b8f878' },
    { name: 'light-blue', color: '#7878fc' },
    { name: 'light-grey', color: '#d8d8d8' },
  ],
};

export class Palette {
  constructor(colors = []) {
    this._colors = new Map();
    for (const { name, color } of colors) {
      this._colors.set(name, color);
    }
  }

  add(name, color) {
    if (this._colors.has(name)) {
      throw new Error(`Color "${name}" already exists`);
    }
    this._colors.set(name, color);
  }

  update(name, color) {
    this._colors.set(name, color);
  }

  remove(name) {
    this._colors.delete(name);
  }

  getColor(name) {
    return this._colors.get(name) ?? null;
  }

  resolve(colorRef) {
    if (colorRef.startsWith('#')) return colorRef;
    return this.getColor(colorRef) ?? colorRef;
  }

  list() {
    return Array.from(this._colors.entries()).map(([name, color]) => ({ name, color }));
  }

  toJSON() {
    return this.list();
  }

  static fromJSON(json) {
    return new Palette(json);
  }

  static fromPreset(name) {
    const preset = PRESETS[name];
    if (!preset) throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(PRESETS).join(', ')}`);
    return new Palette(preset);
  }

  static listPresets() {
    return Object.keys(PRESETS);
  }
}
