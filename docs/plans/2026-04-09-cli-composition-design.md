# CLI Composition Improvements Design

## Overview

Six features that improve the sprite authoring experience from the CLI — fixing multi-frame animation ergonomics, adding terminal-native preview, palette-aware shading, and batch execution.

## Build Order

Each layer enables the next:

1. Resize ergonomics (CLI-only change)
2. Palette color ramps (engine data layer)
3. Highlight/shadow draw commands (consumes ramps)
4. Terminal preview (new renderer)
5. Terminal animation preview (consumes terminal renderer)
6. Batch mode (independent, highest complexity)

---

## 1. Resize Ergonomics

**Before:** `sprite resize ball --cell 0,0 --updates '{"rx":4,"ry":5}'`

**After:** `sprite resize ball --cell 0,0 --rx 4 --ry 5`

CLI collects unknown `--flags` into the updates object automatically. `--updates` JSON still works as fallback. If both provided, individual flags win (merge over JSON).

Supported flags per shape type:
- circle: `--r`, `--filled`
- ellipse: `--rx`, `--ry`, `--filled`
- rect: `--w`, `--h`, `--filled`
- line: `--x1`, `--y1`, `--x2`, `--y2`

CLI-only change — REST API and handler unchanged.

---

## 2. Palette Color Ramps

Each palette gains a `ramps` property mapping color name → `{ lighter, darker }` neighbors. Hand-curated per palette.

### pico8 Ramps

| Color | Lighter | Darker |
|-------|---------|--------|
| black | dark-grey | black |
| dark-blue | blue | black |
| dark-purple | pink | dark-blue |
| dark-green | green | black |
| brown | orange | dark-grey |
| dark-grey | light-grey | black |
| light-grey | white | dark-grey |
| white | white | light-grey |
| red | pink | dark-purple |
| orange | yellow | brown |
| yellow | white | orange |
| green | yellow | dark-green |
| blue | lavender | dark-blue |
| lavender | light-grey | dark-purple |
| pink | light-peach | red |
| light-peach | white | pink |

### gameboy Ramps

| Color | Lighter | Darker |
|-------|---------|--------|
| darkest | dark | darkest |
| dark | light | darkest |
| light | lightest | dark |
| lightest | lightest | light |

Edge behavior: clamps to self (white→lighter = white, black→darker = black).

**API:** `Palette.lighter(colorNameOrHex)` → hex string, `Palette.darker(colorNameOrHex)` → hex string. Raw hex with no palette match returns null.

Stored in palette.js alongside existing preset definitions. No DB changes, no REST endpoints.

---

## 3. Highlight/Shadow Commands

Two new draw subtypes that read a shape's color and geometry, then add lit/shaded pixels.

```
sprite draw highlight --cell 0,0 --shape ball --direction top-left --name ball_hl
sprite draw shadow --cell 0,0 --shape ball --direction bottom-right --name ball_sh
```

### Algorithm

1. Look up target shape by `--shape` name
2. Get its color → `Palette.lighter()` (highlight) or `Palette.darker()` (shadow)
3. Compute shape's bounding box from params
4. Place pixels along the specified edge, offset 1px inward from bounding box corner

### Pixel Count

- 3-4px radius: 2 pixels
- 5-7px radius: 3 pixels
- 8px+: 4 pixels

Creates individual named point shapes: `ball_hl_0`, `ball_hl_1`, etc.

### Directions

`top-left`, `top-right`, `bottom-left`, `bottom-right`, `top`, `bottom`, `left`, `right`. Default: `top-left` for highlight, `bottom-right` for shadow.

### Strength Flag

`--strength 2` double-steps up the ramp (`lighter(lighter(color))`). Default 1.

### Errors

- Shape not found → error
- Color not in palette → error with message
- Shape is point or line (no bounding box) → error

REST endpoint: `POST /api/draw` with `type: "highlight"` or `"shadow"`.

---

## 4. Terminal Preview

`sprite view --cell 0,0` renders ANSI-colored block art in terminal by default.

Old PNG behavior: `sprite view --cell 0,0 --png`

### Output Format (16x16)

```
  0 1 2 3 4 5 6 7 8 9 A B C D E F
0 · · · · · · · · · · · · · · · ·
1 · · · · · · · · · · · · · · · ·
...
12 · · ██████████████████████████·
13 · · ██████████████████████████·
14 · · · · ████████████████████· ·
15 · · · · · · · · · · · · · · · ·

  ██ #ff004d ball
  ██ #1d2b53 shadow
  ██ #ff77a8 shine
```

Each pixel: `\x1b[38;2;R;G;Bm██\x1b[0m` (ANSI 24-bit color). Transparent: `· ` in dim grey. Headers: hex digits.

Legend: one line per unique color, showing colored swatch, hex value, and shape names.

### Implementation

New `server/engine/terminal-renderer.js` takes cell shapes + palette, returns ANSI string. REST endpoint `POST /api/cell/view` gains `format` param: `"terminal"` (default) or `"png"`. CLI reads `--png` flag.

### 32px Scalability

At 32px, grid is ~68 columns wide — fits most terminals. Column headers switch to showing every 4th tick. Optional `--scale 0.5` flag for half-resolution summary.

---

## 5. Terminal Animation Preview

```
sprite view-anim <group-name> [--fps 8] [--loops 3]
```

Cycles frames using terminal renderer with clear-and-redraw (`\x1b[H` home, `\x1b[2J` clear).

**Defaults:** 8 FPS, 3 loops then stop. `--loops 0` for infinite (Ctrl+C to stop).

**Frame counter** below legend: `Frame 3/8 — bounce @ 8fps`

**CLI-only feature** — no REST endpoint. Script prefetches all cell shapes via `GET /api/shapes?cell=X` before playback, then renders locally with `setTimeout`.

---

## 6. Batch Mode

```
sprite batch commands.json
sprite batch --stdin < commands.json
```

JSON array of command objects executed sequentially:

```json
[
  {"command": "draw", "type": "ellipse", "cell": "0,0", "cx": 8, "cy": 14, "rx": 6, "ry": 2, "color": "#1d2b53", "name": "shadow", "filled": true},
  {"command": "copy", "from": "0,0", "to": "0,1"},
  {"command": "move-to", "shape": "ball", "cell": "0,1", "x": 8, "y": 4},
  {"command": "draw", "type": "highlight", "cell": "0,0", "shape": "ball", "direction": "top-left", "name": "ball_hl"},
  {"command": "group", "sub": "create", "name": "bounce", "cells": ["0,0", "0,1"]}
]
```

`command` field maps to existing CLI subcommand names. Batch runner maps each to the correct REST endpoint internally.

### Output

```
[1/5] draw ellipse → shadow (0,0)
[2/5] copy 0,0 → 0,1
[3/5] move-to ball (0,1)
[4/5] draw highlight → ball_hl (0,0)
[5/5] group create bounce
Done: 5/5 succeeded
```

### Error Handling

On failure: print error and stop. `--continue-on-error` flag keeps going, reports count at end.

### stdin

`--stdin` reads from stdin instead of file — useful for piping or heredoc.

No new REST endpoint — purely CLI-side, reuses existing `api()` helper.
