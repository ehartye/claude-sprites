# CLI Composition Improvements — TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).
>
> - **subagent-driven-development** — Best for solo execution. Tasks run sequentially in subagents within the current session.
> - **team-driven-development** — Best for speed. Persistent teammate agents work tasks in parallel with shared state and messaging. Tasks 1-2 can run in parallel, task 3 depends on 2, task 4 is independent, task 5 depends on 4, task 6 is independent.
> - **executing-plans** — Best for review checkpoints. Runs in a separate session with pauses for human review between tasks.

**Goal:** Six improvements to the CLI sprite authoring experience: resize ergonomics, palette color ramps, highlight/shadow commands, terminal preview, terminal animation preview, and batch mode.

**Design doc:** `docs/plans/2026-04-09-cli-composition-design.md`

**Tech Stack:** Node.js ESM, Express, vitest

---

## Task 1: Resize Ergonomics

**Goal:** Allow `sprite resize ball --cell 0,0 --rx 4 --ry 5` instead of requiring `--updates '{"rx":4,"ry":5}'`.

**Files:**
- Modify: `scripts/sprite.js` (line 118-119, the `resize` case)
- Modify: `tests/cli/sprite.test.js`

### Step 1: Write failing tests

Add these tests to the end of the existing `describe('CLI Script', ...)` block in `tests/cli/sprite.test.js`:

```js
// tests/cli/sprite.test.js — append inside existing describe block, after existing tests

  test('resize with individual flags', async () => {
    // First draw a circle to resize
    await cli('draw', 'circle', '--cell', '0,0', '--cx', '8', '--cy', '8', '--r', '3', '--color', '#ff004d', '--name', 'resizeme');
    const { stdout } = await cli('resize', 'resizeme', '--cell', '0,0', '--r', '5');
    expect(stdout).toBeTruthy();

    // Verify the shape was updated
    const { stdout: shapesOut } = await cli('shapes', '--cell', '0,0');
    expect(shapesOut).toContain('resizeme');
  });

  test('resize with --updates JSON fallback still works', async () => {
    const { stdout } = await cli('resize', 'resizeme', '--cell', '0,0', '--updates', '{"r":4}');
    expect(stdout).toBeTruthy();
  });

  test('resize individual flags override --updates JSON', async () => {
    // --r 6 should override the r:4 in --updates
    const { stdout } = await cli('resize', 'resizeme', '--cell', '0,0', '--updates', '{"r":4}', '--r', '6');
    expect(stdout).toBeTruthy();
  });
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/cli/sprite.test.js
```

Expected: The first new test fails because the current `resize` case on line 119 does `JSON.parse(args.updates)` and `args.updates` is undefined when only `--r 5` is passed.

### Step 3: Implement

Replace the `resize` case in `scripts/sprite.js` (lines 118-119):

```js
    // scripts/sprite.js — replace lines 118-119
    case 'resize': {
      // Collect individual shape-param flags into an updates object
      const individualFlags = {};
      for (const key of ['r', 'rx', 'ry', 'w', 'h', 'x1', 'y1', 'x2', 'y2']) {
        if (args[key] !== undefined) individualFlags[key] = num(args[key]);
      }
      if (args.filled !== undefined) individualFlags.filled = bool(args.filled);

      // Parse --updates JSON fallback, then merge individual flags on top (individual wins)
      let base = {};
      if (args.updates) {
        try { base = JSON.parse(args.updates); } catch { base = {}; }
      }
      const updates = { ...base, ...individualFlags };

      result = await api('POST', '/api/shape/resize', { cell: args.cell, shape: sub, updates });
      break;
    }
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/cli/sprite.test.js
```

Expected: All tests pass including the three new resize tests.

### Step 5: Commit

```bash
git add scripts/sprite.js tests/cli/sprite.test.js
git commit -m "feat: resize ergonomics — individual CLI flags for shape params"
```

---

## Task 2: Palette Color Ramps

**Goal:** Add `lighter(colorNameOrHex)` and `darker(colorNameOrHex)` methods to the Palette class, backed by hand-curated ramp tables per preset.

**Files:**
- Modify: `server/engine/palette.js` (add `RAMPS` data + methods on lines 44-99)
- Modify: `tests/engine/palette.test.js` (add ramp tests)

### Step 1: Write failing tests

Append to the existing `describe('Palette', ...)` block in `tests/engine/palette.test.js`:

```js
// tests/engine/palette.test.js — append inside existing describe block

  describe('color ramps', () => {
    it('lighter returns next lighter color by name (pico8)', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → lighter → blue (#29adff)
      expect(p.lighter('dark-blue')).toBe('#29adff');
    });

    it('darker returns next darker color by name (pico8)', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → darker → black (#000000)
      expect(p.darker('dark-blue')).toBe('#000000');
    });

    it('lighter clamps at top (white → white)', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('white')).toBe('#fff1e8');
    });

    it('darker clamps at bottom (black → black)', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.darker('black')).toBe('#000000');
    });

    it('accepts hex input and resolves to palette name first', () => {
      const p = Palette.fromPreset('pico8');
      // #1d2b53 is dark-blue → lighter → blue (#29adff)
      expect(p.lighter('#1d2b53')).toBe('#29adff');
    });

    it('returns null for hex not in palette', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('#123456')).toBeNull();
    });

    it('returns null for name not in palette', () => {
      const p = Palette.fromPreset('pico8');
      expect(p.lighter('chartreuse')).toBeNull();
    });

    it('works with gameboy palette', () => {
      const p = Palette.fromPreset('gameboy');
      // dark → lighter → light (#8bac0f)
      expect(p.lighter('dark')).toBe('#8bac0f');
      // light → darker → dark (#306230)
      expect(p.darker('light')).toBe('#306230');
    });

    it('gameboy clamps at edges', () => {
      const p = Palette.fromPreset('gameboy');
      expect(p.lighter('lightest')).toBe('#9bbc0f');
      expect(p.darker('darkest')).toBe('#0f380f');
    });

    it('multi-step ramp with strength', () => {
      const p = Palette.fromPreset('pico8');
      // dark-blue → lighter(1) → blue, lighter(2) → lavender
      expect(p.lighter('dark-blue', 2)).toBe('#83769c');
    });

    it('strength clamps at edge', () => {
      const p = Palette.fromPreset('pico8');
      // white → lighter(3) still white
      expect(p.lighter('white', 3)).toBe('#fff1e8');
    });

    it('pico8 full ramp coverage — every color has lighter and darker', () => {
      const p = Palette.fromPreset('pico8');
      const names = p.list().map(c => c.name);
      for (const name of names) {
        expect(p.lighter(name)).not.toBeNull();
        expect(p.darker(name)).not.toBeNull();
      }
    });

    it('gameboy full ramp coverage', () => {
      const p = Palette.fromPreset('gameboy');
      const names = p.list().map(c => c.name);
      for (const name of names) {
        expect(p.lighter(name)).not.toBeNull();
        expect(p.darker(name)).not.toBeNull();
      }
    });

    it('palette without ramps returns null gracefully', () => {
      const p = new Palette([{ name: 'custom', color: '#aabbcc' }]);
      expect(p.lighter('custom')).toBeNull();
      expect(p.darker('custom')).toBeNull();
    });
  });
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/engine/palette.test.js
```

Expected: All new ramp tests fail — `p.lighter` is not a function.

### Step 3: Implement

Modify `server/engine/palette.js`. Add `RAMPS` constant after `PRESETS` (after line 44), and add `lighter()` / `darker()` methods to the `Palette` class.

Add after line 44 (after the closing `};` of PRESETS):

```js
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
};
```

Add these methods inside the `Palette` class (after the `resolve()` method, around line 76):

```js
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
```

Modify the `constructor` (line 47-51) to accept and store ramps:

```js
  constructor(colors = [], ramps = null) {
    this._colors = new Map();
    this._ramps = ramps;
    for (const { name, color } of colors) {
      this._colors.set(name, color);
    }
  }
```

Modify `fromPreset` (line 90-93) to pass ramps:

```js
  static fromPreset(name) {
    const preset = PRESETS[name];
    if (!preset) throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(PRESETS).join(', ')}`);
    return new Palette(preset, RAMPS[name] ?? null);
  }
```

Modify `fromJSON` (line 86-88) to preserve ramps for round-trip (ramps are keyed to preset, so check if colors match a preset):

```js
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
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/engine/palette.test.js
```

Expected: All 12 new ramp tests pass alongside the 8 original tests.

### Step 5: Commit

```bash
git add server/engine/palette.js tests/engine/palette.test.js
git commit -m "feat: palette color ramps with lighter/darker methods"
```

---

## Task 3: Highlight/Shadow Commands

**Goal:** New draw subtypes `highlight` and `shadow` that read a shape's color and geometry, then place lit/shaded pixels along a specified edge.

**Files:**
- Modify: `server/handlers/draw.js` (add `highlight` and `shadow` cases)
- Create: `tests/handlers/highlight-shadow.test.js`

### Step 1: Write failing tests

```js
// tests/handlers/highlight-shadow.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';
import { handleListShapes } from '../../server/handlers/shape.js';

describe('Highlight/Shadow draw commands', () => {
  let state;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2, palette: 'pico8' }),
      broadcast: () => {},
    };
    // Draw a circle to use as the target shape
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 8, cy: 8, r: 5, color: '#ff004d', shape_name: 'ball',
    });
  });

  it('draws highlight points with lighter color', () => {
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'ball', direction: 'top-left', shape_name: 'ball_hl',
    });
    expect(result.shapeNames).toBeDefined();
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
    expect(result.shapeNames[0]).toBe('ball_hl_0');

    // Check all highlight shapes exist and have the lighter color
    const shapes = handleListShapes(state, { cell: '0,0' });
    const hlShapes = shapes.filter(s => s.name?.startsWith('ball_hl_'));
    expect(hlShapes.length).toBeGreaterThanOrEqual(2);
    // #ff004d (red) → lighter → #ff77a8 (pink)
    for (const s of hlShapes) {
      expect(s.color).toBe('#ff77a8');
      expect(s.type).toBe('point');
    }
  });

  it('draws shadow points with darker color', () => {
    const result = handleDraw(state, 'shadow', {
      cell: '0,0', shape: 'ball', direction: 'bottom-right', shape_name: 'ball_sh',
    });
    expect(result.shapeNames).toBeDefined();
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
    // #ff004d (red) → darker → #7e2553 (dark-purple)
    const shapes = handleListShapes(state, { cell: '0,0' });
    const shShapes = shapes.filter(s => s.name?.startsWith('ball_sh_'));
    for (const s of shShapes) {
      expect(s.color).toBe('#7e2553');
    }
  });

  it('defaults highlight direction to top-left', () => {
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'ball', shape_name: 'ball_hl',
    });
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
  });

  it('defaults shadow direction to bottom-right', () => {
    const result = handleDraw(state, 'shadow', {
      cell: '0,0', shape: 'ball', shape_name: 'ball_sh',
    });
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
  });

  it('strength 2 double-steps the ramp', () => {
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'ball', direction: 'top-left', shape_name: 'ball_hl2', strength: 2,
    });
    const shapes = handleListShapes(state, { cell: '0,0' });
    const hlShapes = shapes.filter(s => s.name?.startsWith('ball_hl2_'));
    // #ff004d (red) → lighter(2) → light-peach (#ffccaa)
    for (const s of hlShapes) {
      expect(s.color).toBe('#ffccaa');
    }
  });

  it('pixel count scales with radius: r=3 → 2 pixels', () => {
    // Draw a smaller circle
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 4, cy: 4, r: 3, color: '#ff004d', shape_name: 'small',
    });
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'small', direction: 'top-left', shape_name: 'sm_hl',
    });
    expect(result.shapeNames.length).toBe(2);
  });

  it('pixel count scales with radius: r=5 → 3 pixels', () => {
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'ball', direction: 'top-left', shape_name: 'md_hl',
    });
    expect(result.shapeNames.length).toBe(3);
  });

  it('pixel count scales with radius: r=8 → 4 pixels', () => {
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 8, cy: 8, r: 8, color: '#ff004d', shape_name: 'big',
    });
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'big', direction: 'top-left', shape_name: 'big_hl',
    });
    expect(result.shapeNames.length).toBe(4);
  });

  it('works with ellipse shapes', () => {
    handleDraw(state, 'ellipse', {
      cell: '0,0', cx: 8, cy: 8, rx: 6, ry: 4, color: '#29adff', shape_name: 'oval',
    });
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'oval', direction: 'top-left', shape_name: 'oval_hl',
    });
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
  });

  it('works with rect shapes', () => {
    handleDraw(state, 'rect', {
      cell: '0,0', x: 2, y: 2, w: 10, h: 8, color: '#00e436', shape_name: 'box',
    });
    const result = handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'box', direction: 'top-left', shape_name: 'box_hl',
    });
    expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
  });

  it('supports all 8 directions', () => {
    const directions = [
      'top-left', 'top-right', 'bottom-left', 'bottom-right',
      'top', 'bottom', 'left', 'right',
    ];
    for (const dir of directions) {
      const result = handleDraw(state, 'highlight', {
        cell: '0,0', shape: 'ball', direction: dir, shape_name: `hl_${dir}`,
      });
      expect(result.shapeNames.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('throws if shape not found', () => {
    expect(() => handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'nonexistent', shape_name: 'fail',
    })).toThrow('Shape "nonexistent" not found');
  });

  it('throws if color is not in palette ramps', () => {
    // Draw a shape with a raw hex color not in the pico8 palette
    handleDraw(state, 'circle', {
      cell: '0,0', cx: 4, cy: 4, r: 3, color: '#123456', shape_name: 'custom',
    });
    expect(() => handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'custom', shape_name: 'fail',
    })).toThrow('not in palette');
  });

  it('throws if shape is a point (no bounding box)', () => {
    handleDraw(state, 'point', {
      cell: '0,0', x: 5, y: 5, color: '#ff004d', shape_name: 'dot',
    });
    expect(() => handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'dot', shape_name: 'fail',
    })).toThrow('no bounding box');
  });

  it('throws if shape is a line (no bounding box)', () => {
    handleDraw(state, 'line', {
      cell: '0,0', x1: 0, y1: 0, x2: 10, y2: 10, color: '#ff004d', shape_name: 'edge',
    });
    expect(() => handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'edge', shape_name: 'fail',
    })).toThrow('no bounding box');
  });

  it('broadcasts draw events for each created point', () => {
    const messages = [];
    state.broadcast = (msg) => messages.push(msg);
    handleDraw(state, 'highlight', {
      cell: '0,0', shape: 'ball', direction: 'top-left', shape_name: 'ball_hl',
    });
    const drawMessages = messages.filter(m => m.type === 'draw');
    expect(drawMessages.length).toBeGreaterThanOrEqual(2);
  });
});
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/handlers/highlight-shadow.test.js
```

Expected: All tests fail — `handleDraw` throws `Unknown draw type: highlight`.

### Step 3: Implement

Replace the entire `server/handlers/draw.js` file:

```js
// server/handlers/draw.js

/**
 * Compute bounding box from shape type + params.
 * Returns { minX, minY, maxX, maxY, sizeMetric } or null for point/line.
 */
function getBoundingBox(shape) {
  const p = shape.params;
  switch (shape.type) {
    case 'circle':
      return { minX: p.cx - p.r, minY: p.cy - p.r, maxX: p.cx + p.r, maxY: p.cy + p.r, sizeMetric: p.r };
    case 'ellipse':
      return { minX: p.cx - p.rx, minY: p.cy - p.ry, maxX: p.cx + p.rx, maxY: p.cy + p.ry, sizeMetric: Math.max(p.rx, p.ry) };
    case 'rect':
      return { minX: p.x, minY: p.y, maxX: p.x + p.w - 1, maxY: p.y + p.h - 1, sizeMetric: Math.max(p.w, p.h) / 2 };
    default:
      return null;
  }
}

/**
 * Determine how many pixels to place based on shape size.
 */
function getPixelCount(sizeMetric) {
  if (sizeMetric <= 4) return 2;
  if (sizeMetric <= 7) return 3;
  return 4;
}

/**
 * Compute pixel positions for highlight/shadow along a direction.
 * Returns array of { x, y } positions.
 */
function computeEdgePixels(bbox, direction, count) {
  const { minX, minY, maxX, maxY } = bbox;
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const pixels = [];

  // Anchor point offset 1px inward from bounding box corner/edge
  let ax, ay, dxStep, dyStep;

  switch (direction) {
    case 'top-left':
      ax = minX + 1; ay = minY + 1; dxStep = 1; dyStep = 1;
      break;
    case 'top-right':
      ax = maxX - 1; ay = minY + 1; dxStep = -1; dyStep = 1;
      break;
    case 'bottom-left':
      ax = minX + 1; ay = maxY - 1; dxStep = 1; dyStep = -1;
      break;
    case 'bottom-right':
      ax = maxX - 1; ay = maxY - 1; dxStep = -1; dyStep = -1;
      break;
    case 'top':
      ax = cx - Math.floor(count / 2); ay = minY + 1; dxStep = 1; dyStep = 0;
      break;
    case 'bottom':
      ax = cx - Math.floor(count / 2); ay = maxY - 1; dxStep = 1; dyStep = 0;
      break;
    case 'left':
      ax = minX + 1; ay = cy - Math.floor(count / 2); dxStep = 0; dyStep = 1;
      break;
    case 'right':
      ax = maxX - 1; ay = cy - Math.floor(count / 2); dxStep = 0; dyStep = 1;
      break;
    default:
      ax = minX + 1; ay = minY + 1; dxStep = 1; dyStep = 1;
  }

  for (let i = 0; i < count; i++) {
    pixels.push({ x: ax + dxStep * i, y: ay + dyStep * i });
  }
  return pixels;
}

/**
 * Handle highlight or shadow draw type.
 * Looks up target shape, resolves lighter/darker color, places point shapes.
 */
function handleHighlightShadow(state, type, params) {
  const cell = state.project.cells.getCell(params.cell);
  const targetShape = cell.shapes.get(params.shape);
  if (!targetShape) throw new Error(`Shape "${params.shape}" not found`);

  // Validate shape type has a bounding box
  if (targetShape.type === 'point' || targetShape.type === 'line') {
    throw new Error(`Shape "${params.shape}" is a ${targetShape.type} — no bounding box`);
  }

  const palette = state.project.palette;
  const strength = params.strength ?? 1;
  const rampFn = type === 'highlight' ? 'lighter' : 'darker';
  const newColor = palette[rampFn](targetShape.color, strength);

  if (!newColor) {
    throw new Error(`Color "${targetShape.color}" not in palette ramps — cannot compute ${type}`);
  }

  const bbox = getBoundingBox(targetShape);
  if (!bbox) throw new Error(`Shape "${params.shape}" is a ${targetShape.type} — no bounding box`);

  const direction = params.direction ?? (type === 'highlight' ? 'top-left' : 'bottom-right');
  const count = getPixelCount(bbox.sizeMetric);
  const pixels = computeEdgePixels(bbox, direction, count);

  const baseName = params.shape_name ?? `${params.shape}_${type === 'highlight' ? 'hl' : 'sh'}`;
  const shapeNames = [];

  for (let i = 0; i < pixels.length; i++) {
    const name = `${baseName}_${i}`;
    const shape = cell.draw('point', { x: pixels[i].x, y: pixels[i].y }, newColor, name);
    state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
    shapeNames.push(name);
  }

  return { shapeNames };
}

/**
 * Shared draw handler — called by REST API and WebSocket dispatch.
 */
export function handleDraw(state, type, params) {
  if (!state.project) throw new Error('No project open');

  if (type === 'highlight' || type === 'shadow') {
    return handleHighlightShadow(state, type, params);
  }

  const cell = state.project.cells.getCell(params.cell);

  let drawParams;
  switch (type) {
    case 'point':
      drawParams = { x: params.x, y: params.y };
      break;
    case 'line':
      drawParams = { x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2 };
      break;
    case 'rect':
      drawParams = { x: params.x, y: params.y, w: params.w, h: params.h, filled: params.filled ?? true };
      break;
    case 'circle':
      drawParams = { cx: params.cx, cy: params.cy, r: params.r, filled: params.filled ?? true };
      break;
    case 'ellipse':
      drawParams = { cx: params.cx, cy: params.cy, rx: params.rx, ry: params.ry, filled: params.filled ?? true };
      break;
    case 'fill':
      drawParams = { x: params.x, y: params.y };
      break;
    default:
      throw new Error(`Unknown draw type: ${type}`);
  }

  const shape = cell.draw(type, drawParams, params.color, params.shape_name ?? null);
  state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
  return { shapeId: shape.id, shapeName: shape.name };
}
```

Also update the CLI `draw` case in `scripts/sprite.js` to pass `shape`, `direction`, and `strength` params (line 89-99). Replace the `draw` case:

```js
    case 'draw':
      result = await api('POST', '/api/draw', {
        type: sub, cell: args.cell, color: args.color, shape_name: args.name,
        x: num(args.x), y: num(args.y),
        x1: num(args.x1), y1: num(args.y1), x2: num(args.x2), y2: num(args.y2),
        cx: num(args.cx), cy: num(args.cy),
        r: num(args.r), rx: num(args.rx), ry: num(args.ry),
        w: num(args.w), h: num(args.h),
        filled: args.filled !== undefined ? bool(args.filled) : undefined,
        // highlight/shadow params
        shape: args.shape, direction: args.direction,
        strength: num(args.strength),
      });
      break;
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/handlers/highlight-shadow.test.js
```

Expected: All 16 tests pass.

### Step 5: Run full test suite to check for regressions

```bash
npx vitest run
```

Expected: All existing tests still pass (the `handleDraw` signature and behavior are unchanged for existing draw types).

### Step 6: Commit

```bash
git add server/handlers/draw.js scripts/sprite.js tests/handlers/highlight-shadow.test.js
git commit -m "feat: highlight/shadow draw commands using palette ramps"
```

---

## Task 4: Terminal Preview

**Goal:** New `server/engine/terminal-renderer.js` that renders ANSI-colored block art. Modify view handler to support `format: "terminal"`. CLI defaults to terminal, `--png` for old behavior.

**Files:**
- Create: `server/engine/terminal-renderer.js`
- Create: `tests/engine/terminal-renderer.test.js`
- Modify: `server/handlers/view.js` (line 14-21, `handleViewCell`)
- Modify: `server/web/api/cell-routes.js` (line 28-31, view route)
- Modify: `scripts/sprite.js` (line 141, `view` case)

### Step 1: Write failing tests

```js
// tests/engine/terminal-renderer.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalRenderer } from '../../server/engine/terminal-renderer.js';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

describe('TerminalRenderer', () => {
  let state;

  beforeEach(() => {
    state = {
      project: Project.create({ name: 'test', cellSize: 16, rows: 2, cols: 2, palette: 'pico8' }),
      broadcast: () => {},
    };
  });

  it('renders an empty cell with transparent markers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    expect(typeof output).toBe('string');
    // Should contain dim grey dot markers for transparent pixels
    expect(output).toContain('·');
  });

  it('renders a cell with a colored shape as ANSI blocks', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 2, h: 2, color: '#ff004d' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // ANSI 24-bit color escape: \x1b[38;2;255;0;77m
    expect(output).toContain('\x1b[38;2;255;0;77m');
    // Should contain block characters
    expect(output).toContain('██');
  });

  it('includes hex column headers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Header should contain hex digits 0-F for 16px cell
    expect(output).toContain(' 0');
    expect(output).toContain(' F');
  });

  it('includes hex row headers', () => {
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    const lines = output.split('\n');
    // Row 0 should start with '0 ' (after header line)
    const rowLines = lines.filter(l => /^[0-9A-F] /.test(l.trimStart()));
    expect(rowLines.length).toBe(16);
  });

  it('includes a color legend with shape names', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#ff004d', shape_name: 'hero' });
    handleDraw(state, 'circle', { cell: '0,0', cx: 10, cy: 10, r: 2, color: '#29adff', shape_name: 'gem' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Legend should contain color hex and shape name
    expect(output).toContain('#ff004d');
    expect(output).toContain('hero');
    expect(output).toContain('#29adff');
    expect(output).toContain('gem');
  });

  it('legend groups multiple shapes with same color', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 2, h: 2, color: '#ff004d', shape_name: 'a' });
    handleDraw(state, 'rect', { cell: '0,0', x: 4, y: 4, w: 2, h: 2, color: '#ff004d', shape_name: 'b' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Both names should appear on the same legend line
    const legendLines = output.split('\n').filter(l => l.includes('#ff004d'));
    expect(legendLines.length).toBe(1);
    expect(legendLines[0]).toContain('a');
    expect(legendLines[0]).toContain('b');
  });

  it('resets ANSI after each colored block', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 1, h: 1, color: '#ff004d' });
    const cell = state.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(state.project.palette);
    const output = renderer.renderCell(cell);
    // Reset sequence after block
    expect(output).toContain('\x1b[0m');
  });

  it('handles 32px cell size with sparse headers', () => {
    const bigState = {
      project: Project.create({ name: 'big', cellSize: 32, rows: 1, cols: 1, palette: 'pico8' }),
      broadcast: () => {},
    };
    const cell = bigState.project.cells.getCell('0,0');
    const renderer = new TerminalRenderer(bigState.project.palette);
    const output = renderer.renderCell(cell);
    // Should have 32 row lines
    const rowLines = output.split('\n').filter(l => /^[0-9A-F]{1,2} /.test(l.trimStart()));
    expect(rowLines.length).toBe(32);
  });
});
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/engine/terminal-renderer.test.js
```

Expected: All fail — module `server/engine/terminal-renderer.js` does not exist.

### Step 3: Implement the terminal renderer

```js
// server/engine/terminal-renderer.js
import { CanvasRenderer } from './canvas-renderer.js';

const RESET = '\x1b[0m';
const DIM_GREY = '\x1b[38;2;80;80;80m';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function colorBlock(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m██${RESET}`;
}

function transparentBlock() {
  return `${DIM_GREY}· ${RESET}`;
}

function hexDigit(n) {
  return n.toString(16).toUpperCase();
}

export class TerminalRenderer {
  constructor(palette) {
    this.palette = palette;
    this._canvasRenderer = new CanvasRenderer(palette);
  }

  /**
   * Render a cell to an ANSI string with colored blocks, headers, and legend.
   */
  renderCell(cell) {
    const size = cell.size;
    const imgData = this._canvasRenderer.renderCellRaw(cell);
    const shapes = cell.shapes.listByZ();

    const lines = [];

    // Column header
    const headerParts = ['  '];
    if (size <= 16) {
      for (let c = 0; c < size; c++) {
        headerParts.push(` ${hexDigit(c)}`);
      }
    } else {
      // Sparse headers for 32px+: show every 4th tick
      for (let c = 0; c < size; c++) {
        if (c % 4 === 0) {
          const label = hexDigit(c);
          headerParts.push(label.length === 1 ? ` ${label}` : label);
        } else {
          headerParts.push('  ');
        }
      }
    }
    lines.push(headerParts.join(''));

    // Pixel rows
    for (let y = 0; y < size; y++) {
      const rowLabel = size <= 16 ? hexDigit(y) : hexDigit(y).padStart(2, ' ');
      const parts = [rowLabel + ' '];
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const a = imgData[idx + 3];
        if (a === 0) {
          parts.push(transparentBlock());
        } else {
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          parts.push(colorBlock(hex));
        }
      }
      lines.push(parts.join(''));
    }

    // Legend: group shapes by resolved color
    if (shapes.length > 0) {
      lines.push('');
      const colorGroups = new Map();
      for (const shape of shapes) {
        const resolvedColor = this.palette.resolve(shape.color);
        const label = shape.name ?? shape.id;
        if (!colorGroups.has(resolvedColor)) {
          colorGroups.set(resolvedColor, []);
        }
        colorGroups.get(resolvedColor).push(label);
      }
      for (const [hex, names] of colorGroups) {
        lines.push(`  ${colorBlock(hex)} ${hex} ${names.join(', ')}`);
      }
    }

    return lines.join('\n');
  }
}
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/engine/terminal-renderer.test.js
```

Expected: All 8 tests pass.

### Step 5: Write handler/route tests for format param

Append to `tests/handlers/view-tools.test.js`:

```js
// tests/handlers/view-tools.test.js — append inside existing describe block

  it('renders terminal format when format=terminal', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#ff0000' });
    const result = handleViewCell(state, { cell: '0,0', format: 'terminal' }, tmpDir);
    expect(typeof result.terminal).toBe('string');
    expect(result.terminal).toContain('██');
    expect(result.terminal).toContain('·');
  });

  it('renders png format when format=png', () => {
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#ff0000' });
    const result = handleViewCell(state, { cell: '0,0', format: 'png' }, tmpDir);
    expect(result.path).toBeDefined();
    expect(fs.existsSync(result.path)).toBe(true);
  });
```

### Step 6: Run to confirm failure, then implement

```bash
npx vitest run tests/handlers/view-tools.test.js
```

Modify `server/handlers/view.js` — update `handleViewCell` to accept a `format` parameter:

```js
// server/handlers/view.js — replace handleViewCell function (lines 14-21)
import { TerminalRenderer } from '../engine/terminal-renderer.js';

export function handleViewCell(state, params, tmpDir) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);

  if (params.format === 'terminal') {
    const termRenderer = new TerminalRenderer(state.project.palette);
    return { terminal: termRenderer.renderCell(cell) };
  }

  const renderer = getRenderer(state);
  const buf = renderer.renderCell(cell);
  const p = tmpPath(tmpDir, `cell-${params.cell.replace(',', '-')}`);
  fs.writeFileSync(p, buf);
  return { path: p };
}
```

Note: The import for `TerminalRenderer` goes at the top of the file alongside existing imports.

Update `server/web/api/cell-routes.js` — the view route (line 28-31) to pass format:

```js
  // server/web/api/cell-routes.js — replace the view route (line 28-31)
  r.post('/cell/view',   (req, res) => {
    try {
      const result = handleViewCell(state, req.body, state.tmpDir);
      res.json({ ok: true, data: result });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
```

Note: `state.tmpDir` — the MCP tools already set tmpDir on state. The REST route just needs to pass it through.

Update `scripts/sprite.js` — the `view` case (line 141):

```js
    // scripts/sprite.js — replace the view case (line 141)
    case 'view': {
      const format = args.png ? 'png' : 'terminal';
      result = await api('POST', '/api/cell/view', { cell: args.cell, format });
      if (result.ok && result.data?.terminal) {
        console.log(result.data.terminal);
        return;
      }
      break;
    }
```

### Step 7: Run tests to confirm pass

```bash
npx vitest run tests/handlers/view-tools.test.js
npx vitest run tests/engine/terminal-renderer.test.js
```

Expected: All pass.

### Step 8: Commit

```bash
git add server/engine/terminal-renderer.js tests/engine/terminal-renderer.test.js server/handlers/view.js server/web/api/cell-routes.js scripts/sprite.js tests/handlers/view-tools.test.js
git commit -m "feat: terminal preview renderer with ANSI colored blocks and legend"
```

---

## Task 5: Terminal Animation Preview

**Goal:** New `view-anim` CLI command that cycles animation frames in the terminal using the terminal renderer.

**Files:**
- Modify: `scripts/sprite.js` (add `view-anim` case after `view`)
- Create: `tests/cli/view-anim.test.js`

### Step 1: Write failing tests

```js
// tests/cli/view-anim.test.js
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

describe('CLI view-anim', () => {
  let serverInfo;
  let state;
  let port;

  beforeAll(async () => {
    const sessions = new Map();
    let lastId = 0;
    const mockDb = {
      getLastSession() {
        const all = [...sessions.values()].sort((a, b) => b.updated_at - a.updated_at);
        return all[0] ?? undefined;
      },
      getSession(id) { return sessions.get(id); },
      createSession(fields) {
        const id = `s_${++lastId}`;
        const session = { id, ...fields, created_at: Date.now(), updated_at: Date.now() };
        sessions.set(id, session);
        return session;
      },
      updateDraft(id, json) {
        const s = sessions.get(id);
        if (s) { s.draft_json = json; s.updated_at = Date.now(); }
      },
      getCellGroups() { return {}; },
      setCellGroup() {},
    };
    state = { project: null, sessionId: null, db: mockDb };
    serverInfo = await startWebServer(state, 0);
    port = serverInfo.port;
  });

  afterAll(async () => {
    serverInfo.wss.close();
    await new Promise(r => serverInfo.httpServer.close(r));
  });

  async function cli(...args) {
    const { stdout, stderr } = await exec(process.execPath, [SPRITE_JS, ...args], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('setup project and group for animation tests', async () => {
    await cli('new', 'animtest', '--size', '16', '--rows', '2', '--cols', '4', '--palette', 'pico8');
    await cli('draw', 'circle', '--cell', '0,0', '--cx', '8', '--cy', '8', '--r', '4', '--color', '#ff004d', '--name', 'ball');
    await cli('draw', 'circle', '--cell', '0,1', '--cx', '8', '--cy', '4', '--r', '4', '--color', '#ff004d', '--name', 'ball');
    await cli('group', 'create', 'bounce', '0,0', '0,1');
    const { stdout } = await cli('group', 'list');
    expect(stdout).toContain('bounce');
  });

  test('view-anim runs 1 loop and exits', async () => {
    const { stdout } = await cli('view-anim', 'bounce', '--loops', '1', '--fps', '30');
    // Should contain frame counter
    expect(stdout).toContain('Frame');
    // Should contain ANSI content or block characters
    expect(stdout.length).toBeGreaterThan(50);
  });

  test('view-anim shows frame count', async () => {
    const { stdout } = await cli('view-anim', 'bounce', '--loops', '1', '--fps', '30');
    // Frame 1/2 and Frame 2/2
    expect(stdout).toContain('Frame 1/2');
    expect(stdout).toContain('Frame 2/2');
  });

  test('view-anim shows group name in footer', async () => {
    const { stdout } = await cli('view-anim', 'bounce', '--loops', '1', '--fps', '30');
    expect(stdout).toContain('bounce');
  });

  test('view-anim fails for nonexistent group', async () => {
    try {
      await cli('view-anim', 'nonexistent', '--loops', '1');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e.stderr).toBeTruthy();
    }
  });
});
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/cli/view-anim.test.js
```

Expected: Fails — `view-anim` is not a recognized command, exits with "Unknown command".

### Step 3: Implement

Add to `scripts/sprite.js`, add the `TerminalRenderer` import at the top and a new case before `default`. We need a dynamic import since the CLI runs as a standalone script.

Add the `view-anim` case in `scripts/sprite.js` after the `view` case (around line 148):

```js
    case 'view-anim': {
      const groupName = sub;
      // Get group cells
      const groupResult = await api('GET', '/api/group/cell/list');
      if (!groupResult.ok) { console.error(groupResult.error); process.exit(1); }
      const cellRefs = groupResult.data[groupName];
      if (!cellRefs || cellRefs.length === 0) {
        console.error(`Group "${groupName}" not found or empty`);
        process.exit(1);
      }

      // Prefetch all cell terminal views
      const frames = [];
      for (const cellRef of cellRefs) {
        const viewResult = await api('POST', '/api/cell/view', { cell: cellRef, format: 'terminal' });
        if (!viewResult.ok) { console.error(viewResult.error); process.exit(1); }
        frames.push(viewResult.data.terminal);
      }

      const fps = num(args.fps) ?? 8;
      const loops = num(args.loops) ?? 3;
      const totalFrames = frames.length;
      const delay = Math.round(1000 / fps);

      const playLoop = async (loopCount) => {
        let loopsPlayed = 0;
        while (loops === 0 || loopsPlayed < loopCount) {
          for (let i = 0; i < totalFrames; i++) {
            // Clear screen and home cursor (but only after first frame)
            if (loopsPlayed > 0 || i > 0) {
              process.stdout.write('\x1b[H\x1b[2J');
            }
            process.stdout.write(frames[i]);
            process.stdout.write(`\nFrame ${i + 1}/${totalFrames} — ${groupName} @ ${fps}fps\n`);
            await new Promise(r => setTimeout(r, delay));
          }
          loopsPlayed++;
        }
      };

      await playLoop(loops);
      return;
    }
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/cli/view-anim.test.js
```

Expected: All 5 tests pass.

### Step 5: Commit

```bash
git add scripts/sprite.js tests/cli/view-anim.test.js
git commit -m "feat: terminal animation preview with view-anim CLI command"
```

---

## Task 6: Batch Mode

**Goal:** New `batch` CLI command that reads a JSON array of command objects and executes them sequentially via the existing REST API.

**Files:**
- Modify: `scripts/sprite.js` (add `batch` case)
- Create: `tests/cli/batch.test.js`

### Step 1: Write failing tests

```js
// tests/cli/batch.test.js
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

describe('CLI batch mode', () => {
  let serverInfo;
  let state;
  let port;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = join(os.tmpdir(), `sprites-batch-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const sessions = new Map();
    let lastId = 0;
    const mockDb = {
      getLastSession() {
        const all = [...sessions.values()].sort((a, b) => b.updated_at - a.updated_at);
        return all[0] ?? undefined;
      },
      getSession(id) { return sessions.get(id); },
      createSession(fields) {
        const id = `s_${++lastId}`;
        const session = { id, ...fields, created_at: Date.now(), updated_at: Date.now() };
        sessions.set(id, session);
        return session;
      },
      updateDraft(id, json) {
        const s = sessions.get(id);
        if (s) { s.draft_json = json; s.updated_at = Date.now(); }
      },
      getCellGroups() { return {}; },
      setCellGroup() {},
    };
    state = { project: null, sessionId: null, db: mockDb };
    serverInfo = await startWebServer(state, 0);
    port = serverInfo.port;
  });

  afterAll(async () => {
    serverInfo.wss.close();
    await new Promise(r => serverInfo.httpServer.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function cli(...args) {
    const { stdout, stderr } = await exec(process.execPath, [SPRITE_JS, ...args], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('batch executes commands from JSON file', async () => {
    // First create a project
    await cli('new', 'batchtest', '--size', '16', '--rows', '2', '--cols', '4', '--palette', 'pico8');

    const commands = [
      { command: 'draw', type: 'circle', cell: '0,0', cx: 8, cy: 8, r: 4, color: '#ff004d', name: 'ball' },
      { command: 'draw', type: 'rect', cell: '0,0', x: 0, y: 12, w: 16, h: 4, color: '#008751', name: 'ground' },
    ];

    const batchFile = join(tmpDir, 'commands.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile);
    expect(stdout).toContain('[1/2]');
    expect(stdout).toContain('[2/2]');
    expect(stdout).toContain('Done: 2/2 succeeded');
  });

  test('batch reports progress for each command', async () => {
    const commands = [
      { command: 'draw', type: 'point', cell: '0,0', x: 0, y: 0, color: '#ff004d', name: 'p1' },
      { command: 'draw', type: 'point', cell: '0,0', x: 1, y: 1, color: '#29adff', name: 'p2' },
      { command: 'draw', type: 'point', cell: '0,0', x: 2, y: 2, color: '#00e436', name: 'p3' },
    ];

    const batchFile = join(tmpDir, 'progress.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile);
    expect(stdout).toContain('[1/3]');
    expect(stdout).toContain('[2/3]');
    expect(stdout).toContain('[3/3]');
    expect(stdout).toContain('Done: 3/3 succeeded');
  });

  test('batch stops on error by default', async () => {
    const commands = [
      { command: 'draw', type: 'point', cell: '0,0', x: 3, y: 3, color: '#ff004d', name: 'ok1' },
      { command: 'draw', type: 'hexagon', cell: '0,0', color: '#ff004d' },
      { command: 'draw', type: 'point', cell: '0,0', x: 4, y: 4, color: '#ff004d', name: 'never' },
    ];

    const batchFile = join(tmpDir, 'error.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    try {
      await cli('batch', batchFile);
      expect.unreachable('Should have thrown');
    } catch (e) {
      // Should show progress up to the failure
      expect(e.stdout).toContain('[1/3]');
      expect(e.stdout).toContain('[2/3]');
      // Should NOT have reached command 3
      expect(e.stdout).not.toContain('[3/3]');
      expect(e.stderr || e.stdout).toContain('Error');
    }
  });

  test('batch --continue-on-error keeps going after failure', async () => {
    const commands = [
      { command: 'draw', type: 'point', cell: '0,0', x: 5, y: 5, color: '#ff004d', name: 'ok_a' },
      { command: 'draw', type: 'hexagon', cell: '0,0', color: '#ff004d' },
      { command: 'draw', type: 'point', cell: '0,0', x: 6, y: 6, color: '#ff004d', name: 'ok_b' },
    ];

    const batchFile = join(tmpDir, 'continue.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile, '--continue-on-error', 'true');
    expect(stdout).toContain('[1/3]');
    expect(stdout).toContain('[2/3]');
    expect(stdout).toContain('[3/3]');
    expect(stdout).toContain('2/3 succeeded');
    expect(stdout).toContain('1 failed');
  });

  test('batch supports copy command', async () => {
    const commands = [
      { command: 'copy', from: '0,0', to: '0,1' },
    ];
    const batchFile = join(tmpDir, 'copy.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile);
    expect(stdout).toContain('[1/1]');
    expect(stdout).toContain('Done: 1/1 succeeded');
  });

  test('batch supports group create command', async () => {
    const commands = [
      { command: 'group', sub: 'create', name: 'walk', cells: ['0,0', '0,1'] },
    ];
    const batchFile = join(tmpDir, 'group.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile);
    expect(stdout).toContain('Done: 1/1 succeeded');
  });

  test('batch supports move-to command', async () => {
    const commands = [
      { command: 'move-to', shape: 'ball', cell: '0,0', x: 4, y: 4 },
    ];
    const batchFile = join(tmpDir, 'moveto.json');
    fs.writeFileSync(batchFile, JSON.stringify(commands));

    const { stdout } = await cli('batch', batchFile);
    expect(stdout).toContain('Done: 1/1 succeeded');
  });

  test('batch reads from stdin with --stdin flag', async () => {
    const commands = [
      { command: 'draw', type: 'point', cell: '0,0', x: 7, y: 7, color: '#ff004d', name: 'stdin_pt' },
    ];

    const { stdout } = await exec(process.execPath, [SPRITE_JS, 'batch', '--stdin', 'true'], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
      input: JSON.stringify(commands),
    });
    expect(stdout.trim()).toContain('Done: 1/1 succeeded');
  });
});
```

### Step 2: Run tests to confirm failure

```bash
npx vitest run tests/cli/batch.test.js
```

Expected: All fail — `batch` is an unknown command.

### Step 3: Implement

Add the `batch` case and supporting function to `scripts/sprite.js`. Add the `fs` and `readline` imports at the top:

```js
// scripts/sprite.js — add to imports at top (after existing imports)
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
```

Add the batch command mapping function and the `batch` case before `default`:

```js
    // scripts/sprite.js — add before the default case

    case 'batch': {
      const continueOnError = bool(args['continue-on-error']);
      let commands;

      if (args.stdin) {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        commands = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      } else {
        // Read from file (first positional arg)
        const filePath = sub;
        if (!filePath) { console.error('Usage: sprite batch <file.json> or sprite batch --stdin'); process.exit(1); }
        commands = JSON.parse(readFileSync(filePath, 'utf-8'));
      }

      if (!Array.isArray(commands)) { console.error('Batch input must be a JSON array'); process.exit(1); }

      const total = commands.length;
      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        const cmd = commands[i];
        const label = describeBatchCommand(cmd);
        process.stdout.write(`[${i + 1}/${total}] ${label}`);

        try {
          const { method, path, body } = mapCommandToApi(cmd);
          const res = await api(method, path, body);
          if (!res.ok) throw new Error(res.error);
          console.log(` -> ok`);
          succeeded++;
        } catch (e) {
          console.log(` -> ERROR: ${e.message}`);
          failed++;
          if (!continueOnError) {
            console.error(`Error at command ${i + 1}/${total}: ${e.message}`);
            process.exit(1);
          }
        }
      }

      if (failed > 0) {
        console.log(`Done: ${succeeded}/${total} succeeded, ${failed} failed`);
      } else {
        console.log(`Done: ${succeeded}/${total} succeeded`);
      }
      return;
    }
```

Add the helper functions before the `run()` function:

```js
// scripts/sprite.js — add before run() function

function mapCommandToApi(cmd) {
  const { command, ...params } = cmd;
  switch (command) {
    case 'draw':
      return { method: 'POST', path: '/api/draw', body: {
        type: params.type, cell: params.cell, color: params.color, shape_name: params.name,
        x: params.x, y: params.y,
        x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2,
        cx: params.cx, cy: params.cy,
        r: params.r, rx: params.rx, ry: params.ry,
        w: params.w, h: params.h,
        filled: params.filled,
        shape: params.shape, direction: params.direction, strength: params.strength,
      }};
    case 'move':
      return { method: 'POST', path: '/api/shape/move', body: {
        cell: params.cell, name: params.shape, dx: params.dx, dy: params.dy,
      }};
    case 'move-to':
      return { method: 'POST', path: '/api/shape/move-to', body: {
        cell: params.cell, shape: params.shape, x: params.x, y: params.y,
      }};
    case 'resize':
      return { method: 'POST', path: '/api/shape/resize', body: {
        cell: params.cell, shape: params.shape, updates: params.updates ?? params,
      }};
    case 'recolor':
      return { method: 'POST', path: '/api/shape/recolor', body: {
        cell: params.cell, name: params.shape, color: params.color,
      }};
    case 'delete':
      return { method: 'POST', path: '/api/shape/delete', body: {
        cell: params.cell, name: params.shape,
      }};
    case 'clone':
      return { method: 'POST', path: '/api/shape/clone', body: {
        from_cell: params.from, to_cell: params.to, shape: params.shape, new_name: params.as,
      }};
    case 'copy':
      return { method: 'POST', path: '/api/cell/copy', body: {
        from: params.from, to: params.to,
      }};
    case 'clear':
      return { method: 'POST', path: '/api/cell/clear', body: { cell: params.cell } };
    case 'group': {
      const sub = params.sub;
      const name = params.name;
      switch (sub) {
        case 'create': return { method: 'POST', path: '/api/group/cell/create', body: { name, cells: params.cells } };
        case 'add':    return { method: 'POST', path: '/api/group/cell/add', body: { name, cells: params.cells } };
        case 'remove': return { method: 'POST', path: '/api/group/cell/remove', body: { name, cells: params.cells } };
        case 'delete': return { method: 'POST', path: '/api/group/cell/delete', body: { name } };
        case 'list':   return { method: 'GET', path: '/api/group/cell/list', body: undefined };
        default: throw new Error(`Unknown group sub-command: ${sub}`);
      }
    }
    default:
      throw new Error(`Unknown batch command: ${command}`);
  }
}

function describeBatchCommand(cmd) {
  switch (cmd.command) {
    case 'draw': return `draw ${cmd.type}${cmd.name ? ` -> ${cmd.name}` : ''} (${cmd.cell})`;
    case 'move': return `move ${cmd.shape} (${cmd.cell})`;
    case 'move-to': return `move-to ${cmd.shape} (${cmd.cell})`;
    case 'resize': return `resize ${cmd.shape} (${cmd.cell})`;
    case 'recolor': return `recolor ${cmd.shape} (${cmd.cell})`;
    case 'delete': return `delete ${cmd.shape} (${cmd.cell})`;
    case 'clone': return `clone ${cmd.shape} ${cmd.from} -> ${cmd.to}`;
    case 'copy': return `copy ${cmd.from} -> ${cmd.to}`;
    case 'clear': return `clear (${cmd.cell})`;
    case 'group': return `group ${cmd.sub} ${cmd.name}`;
    default: return `${cmd.command}`;
  }
}
```

### Step 4: Run tests to confirm pass

```bash
npx vitest run tests/cli/batch.test.js
```

Expected: All 8 tests pass.

### Step 5: Run full test suite

```bash
npx vitest run
```

Expected: All tests pass across all test files.

### Step 6: Commit

```bash
git add scripts/sprite.js tests/cli/batch.test.js
git commit -m "feat: batch mode for sequential command execution from JSON"
```

---

## Summary

| Task | Files Modified | Files Created | Test File | Tests |
|------|---------------|---------------|-----------|-------|
| 1. Resize Ergonomics | `scripts/sprite.js` | — | `tests/cli/sprite.test.js` | 3 |
| 2. Palette Color Ramps | `server/engine/palette.js` | — | `tests/engine/palette.test.js` | 14 |
| 3. Highlight/Shadow | `server/handlers/draw.js`, `scripts/sprite.js` | `tests/handlers/highlight-shadow.test.js` | `tests/handlers/highlight-shadow.test.js` | 16 |
| 4. Terminal Preview | `server/handlers/view.js`, `server/web/api/cell-routes.js`, `scripts/sprite.js` | `server/engine/terminal-renderer.js`, `tests/engine/terminal-renderer.test.js` | `tests/engine/terminal-renderer.test.js`, `tests/handlers/view-tools.test.js` | 10 |
| 5. Terminal Animation | `scripts/sprite.js` | `tests/cli/view-anim.test.js` | `tests/cli/view-anim.test.js` | 5 |
| 6. Batch Mode | `scripts/sprite.js` | `tests/cli/batch.test.js` | `tests/cli/batch.test.js` | 8 |

**Parallelism opportunities:**
- Tasks 1 and 2 are independent — can run in parallel.
- Task 3 depends on Task 2 (palette ramps).
- Task 4 is independent of Tasks 1-3.
- Task 5 depends on Task 4 (terminal renderer).
- Task 6 is independent of all other tasks (but benefits from Task 3 being done if testing highlight/shadow in batch).

**Total: 56 new tests across 6 commits.**
