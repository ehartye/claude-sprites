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
  'db-16': [
    { name: 'black',       color: '#140c1c' },
    { name: 'dark-purple', color: '#442434' },
    { name: 'dark-blue',   color: '#30346d' },
    { name: 'dark-grey',   color: '#4e4a4e' },
    { name: 'brown',       color: '#854c30' },
    { name: 'dark-green',  color: '#346524' },
    { name: 'red',         color: '#d04648' },
    { name: 'grey',        color: '#757161' },
    { name: 'blue',        color: '#597dce' },
    { name: 'orange',      color: '#d27d2c' },
    { name: 'light-grey',  color: '#8595a1' },
    { name: 'green',       color: '#6daa2c' },
    { name: 'peach',       color: '#d2aa99' },
    { name: 'cyan',        color: '#6dc2ca' },
    { name: 'yellow',      color: '#dad45e' },
    { name: 'white',       color: '#deeed6' },
  ],
  'db-32': [
    { name: 'black',            color: '#000000' },
    { name: 'valhalla',         color: '#222034' },
    { name: 'loulou',           color: '#45283c' },
    { name: 'oiled-cedar',      color: '#663931' },
    { name: 'rope',             color: '#8f563b' },
    { name: 'tahiti-gold',      color: '#df7126' },
    { name: 'twine',            color: '#d9a066' },
    { name: 'pancho',           color: '#eec39a' },
    { name: 'golden-fizz',      color: '#fbf236' },
    { name: 'atlantis',         color: '#99e550' },
    { name: 'christi',          color: '#6abe30' },
    { name: 'elf-green',        color: '#37946e' },
    { name: 'dell',             color: '#4b692f' },
    { name: 'verdigris',        color: '#524b24' },
    { name: 'opal',             color: '#323c39' },
    { name: 'deep-koamaru',     color: '#3f3f74' },
    { name: 'venice-blue',      color: '#306082' },
    { name: 'royal-blue',       color: '#5b6ee1' },
    { name: 'cornflower',       color: '#639bff' },
    { name: 'viking',           color: '#5fcde4' },
    { name: 'light-steel-blue', color: '#cbdbfc' },
    { name: 'white',            color: '#ffffff' },
    { name: 'heather',          color: '#9badb7' },
    { name: 'topaz',            color: '#847e87' },
    { name: 'dim-gray',         color: '#696a6a' },
    { name: 'smokey-ash',       color: '#595652' },
    { name: 'clairvoyant',      color: '#76428a' },
    { name: 'red',              color: '#ac3232' },
    { name: 'mandy',            color: '#d95763' },
    { name: 'plum',             color: '#d77bba' },
    { name: 'rainforest',       color: '#8f974a' },
    { name: 'stinger',          color: '#8a6f30' },
  ],
};

const RAMPS = {
  pico8: {
    'black':       { lighter: 'dark-grey',   darker: 'black' },
    'dark-blue':   { lighter: 'blue',        darker: 'black' },
    'dark-purple': { lighter: 'pink',        darker: 'dark-blue' },
    'dark-green':  { lighter: 'green',       darker: 'black' },
    'brown':       { lighter: 'orange',      darker: 'dark-grey' },
    'dark-grey':   { lighter: 'light-grey',  darker: 'black' },
    'light-grey':  { lighter: 'white',       darker: 'dark-grey' },
    'white':       { lighter: 'white',       darker: 'light-grey' },
    'red':         { lighter: 'pink',        darker: 'dark-purple' },
    'orange':      { lighter: 'yellow',      darker: 'brown' },
    'yellow':      { lighter: 'white',       darker: 'orange' },
    'green':       { lighter: 'yellow',      darker: 'dark-green' },
    'blue':        { lighter: 'lavender',    darker: 'dark-blue' },
    'lavender':    { lighter: 'light-grey',  darker: 'dark-purple' },
    'pink':        { lighter: 'light-peach', darker: 'red' },
    'light-peach': { lighter: 'white',       darker: 'pink' },
  },
  gameboy: {
    'darkest':  { lighter: 'dark',     darker: 'darkest' },
    'dark':     { lighter: 'light',    darker: 'darkest' },
    'light':    { lighter: 'lightest', darker: 'dark' },
    'lightest': { lighter: 'lightest', darker: 'light' },
  },
  'db-16': {
    'black':       { lighter: 'dark-purple', darker: 'black' },
    'dark-purple': { lighter: 'brown',       darker: 'black' },
    'dark-blue':   { lighter: 'blue',        darker: 'black' },
    'dark-grey':   { lighter: 'grey',        darker: 'black' },
    'brown':       { lighter: 'orange',      darker: 'dark-purple' },
    'dark-green':  { lighter: 'green',       darker: 'black' },
    'red':         { lighter: 'peach',       darker: 'dark-purple' },
    'grey':        { lighter: 'light-grey',  darker: 'dark-grey' },
    'blue':        { lighter: 'cyan',        darker: 'dark-blue' },
    'orange':      { lighter: 'yellow',      darker: 'brown' },
    'light-grey':  { lighter: 'white',       darker: 'grey' },
    'green':       { lighter: 'yellow',      darker: 'dark-green' },
    'peach':       { lighter: 'white',       darker: 'red' },
    'cyan':        { lighter: 'light-grey',  darker: 'blue' },
    'yellow':      { lighter: 'white',       darker: 'orange' },
    'white':       { lighter: 'white',       darker: 'light-grey' },
  },
  'db-32': {
    'black':            { lighter: 'valhalla',         darker: 'black' },
    'valhalla':         { lighter: 'smokey-ash',       darker: 'black' },
    'loulou':           { lighter: 'clairvoyant',      darker: 'valhalla' },
    'oiled-cedar':      { lighter: 'rope',             darker: 'loulou' },
    'rope':             { lighter: 'tahiti-gold',      darker: 'oiled-cedar' },
    'tahiti-gold':      { lighter: 'twine',            darker: 'rope' },
    'twine':            { lighter: 'pancho',           darker: 'tahiti-gold' },
    'pancho':           { lighter: 'white',            darker: 'twine' },
    'golden-fizz':      { lighter: 'white',            darker: 'pancho' },
    'atlantis':         { lighter: 'golden-fizz',      darker: 'christi' },
    'christi':          { lighter: 'atlantis',         darker: 'dell' },
    'elf-green':        { lighter: 'viking',           darker: 'dell' },
    'dell':             { lighter: 'christi',          darker: 'opal' },
    'verdigris':        { lighter: 'stinger',          darker: 'valhalla' },
    'opal':             { lighter: 'smokey-ash',       darker: 'valhalla' },
    'deep-koamaru':     { lighter: 'royal-blue',       darker: 'valhalla' },
    'venice-blue':      { lighter: 'royal-blue',       darker: 'deep-koamaru' },
    'royal-blue':       { lighter: 'cornflower',       darker: 'deep-koamaru' },
    'cornflower':       { lighter: 'viking',           darker: 'royal-blue' },
    'viking':           { lighter: 'light-steel-blue', darker: 'cornflower' },
    'light-steel-blue': { lighter: 'white',            darker: 'viking' },
    'white':            { lighter: 'white',            darker: 'light-steel-blue' },
    'heather':          { lighter: 'light-steel-blue', darker: 'topaz' },
    'topaz':            { lighter: 'heather',          darker: 'dim-gray' },
    'dim-gray':         { lighter: 'topaz',            darker: 'smokey-ash' },
    'smokey-ash':       { lighter: 'dim-gray',         darker: 'valhalla' },
    'clairvoyant':      { lighter: 'plum',             darker: 'loulou' },
    'red':              { lighter: 'mandy',            darker: 'loulou' },
    'mandy':            { lighter: 'plum',             darker: 'red' },
    'plum':             { lighter: 'pancho',           darker: 'clairvoyant' },
    'rainforest':       { lighter: 'atlantis',         darker: 'dell' },
    'stinger':          { lighter: 'twine',            darker: 'verdigris' },
  },
};

export class Palette {
  constructor(colors = [], ramps = null) {
    this._colors = new Map();
    this._ramps = ramps;
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

  _resolveToName(colorRef) {
    if (!colorRef.startsWith('#')) return this._colors.has(colorRef) ? colorRef : null;
    // Hex input — reverse-lookup to find the palette name
    for (const [name, hex] of this._colors) {
      if (hex.toLowerCase() === colorRef.toLowerCase()) return name;
    }
    return null;
  }

  lighter(colorRef, strength = 1) {
    if (!this._ramps) return null;
    let name = this._resolveToName(colorRef);
    if (!name) return null;
    for (let i = 0; i < strength; i++) {
      const entry = this._ramps[name];
      if (!entry) return null;
      name = entry.lighter;
    }
    return this._colors.get(name) ?? null;
  }

  darker(colorRef, strength = 1) {
    if (!this._ramps) return null;
    let name = this._resolveToName(colorRef);
    if (!name) return null;
    for (let i = 0; i < strength; i++) {
      const entry = this._ramps[name];
      if (!entry) return null;
      name = entry.darker;
    }
    return this._colors.get(name) ?? null;
  }

  list() {
    return Array.from(this._colors.entries()).map(([name, color]) => ({ name, color }));
  }

  toJSON() {
    return this.list();
  }

  static fromJSON(json) {
    // Try to detect a known preset to restore ramps
    const presetNames = Object.keys(PRESETS);
    for (const presetName of presetNames) {
      const preset = PRESETS[presetName];
      if (preset.length === json.length && preset.every((c, i) => c.name === json[i]?.name)) {
        return new Palette(json, RAMPS[presetName] ?? null);
      }
    }
    return new Palette(json);
  }

  static fromPreset(name) {
    const preset = PRESETS[name];
    if (!preset) throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(PRESETS).join(', ')}`);
    return new Palette(preset, RAMPS[name] ?? null);
  }

  static listPresets() {
    return Object.keys(PRESETS);
  }
}
