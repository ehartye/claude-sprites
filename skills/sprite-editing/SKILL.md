---
name: sprite-editing
description: This skill should be used when the user asks to draw, create, edit, or animate pixel art sprites, or asks Claude to use sprite sheet tools. Covers project setup, drawing primitives, shape management, animation workflows, and export.
---

# Sprite Sheet Editing

CLI tools for pixel art creation in a cell-based sprite sheet. The web UI at `http://localhost:3377` shows real-time updates — tell the user they can open it alongside you.

All commands use:
```
node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" <command> [args] [--flags]
```

The server auto-starts on first command — no manual setup needed.

## Project Setup

```
sprite.js new myproject --size 16 --rows 4 --cols 4 --palette pico8
```

- Default: 16x16 cells, 4x4 grid, pico8 palette
- Built-in palettes: `pico8`, `gameboy`, `nes`, `cga`
- Name cells immediately: `sprite.js name --cell 0,0 --as idle_1`
- Check project state: `sprite.js status`

## Core Drawing Workflow

**Name every shape as you draw** — use the `--name` flag. Names enable later lookup by `move`, `recolor`, etc.

Draw order: background/large shapes first (lower z), details on top. Shapes outside the cell boundary render dimmed in the UI and are masked at export.

```
sprite.js draw rect    --cell 0,0 --x 0 --y 0 --w 5 --h 5 --color "#ff0000" --name bg
sprite.js draw circle  --cell 0,0 --cx 8 --cy 8 --r 5 --color "#00ff00" --name body
sprite.js draw ellipse --cell 0,0 --cx 8 --cy 8 --rx 6 --ry 3 --color "#0000ff" --name shadow
sprite.js draw line    --cell 0,0 --x1 0 --y1 0 --x2 15 --y2 15 --color "#ff0000" --name limb
sprite.js draw point   --cell 0,0 --x 5 --y 3 --color "#ffffff" --name highlight
sprite.js draw fill    --cell 0,0 --x 0 --y 0 --color "#0000ff" --name flood
```

Use `sprite.js view --cell 0,0` or check the web UI frequently to verify your work.

## Animation Workflow

The efficient pattern for multi-frame animation:

1. **Draw one frame completely** — get the composition right
2. **Copy to remaining frames** — `sprite.js copy --from 0,0 --to 0,1`
3. **Adjust per frame** — use `move-to` for absolute positioning or `move` for relative offsets
4. **Group for playback** — `sprite.js group create walk 0,0 0,1 0,2 0,3`

For position-only changes across frames, `sprite.js clone` copies a single shape from one cell to another — useful when only one element moves.

Prefer `move-to` over relative offsets when you know the target coordinate — it's idempotent and easier to reason about.

## Shape Editing

```
sprite.js shapes   --cell 0,0                          # inspect shapes (z-ordered)
sprite.js move-to  ball --cell 0,0 --x 8 --y 4         # absolute position
sprite.js move     ball --cell 0,0 --dx 2 --dy -1       # relative offset
sprite.js resize   ball --cell 0,0 --updates '{"r":5}'  # change dimensions
sprite.js recolor  ball --cell 0,0 --color "#00ff00"    # swap color
sprite.js clone    ball --from 0,0 --to 0,1 --as ball2  # copy across cells
sprite.js delete   ball --cell 0,0                      # remove shape
sprite.js undo     --cell 0,0                           # step back
sprite.js redo     --cell 0,0                           # step forward
```

## Cell Operations

```
sprite.js copy     --from 0,0 --to 0,1         # deep copy all shapes
sprite.js clear    --cell 0,0                   # remove all shapes
sprite.js name     --cell 0,0 --as idle_1       # name a cell
sprite.js view     --cell 0,0                   # render cell preview
```

## Groups

Cell groups organize frames into animation sequences. Shape groups let you move/recolor multiple shapes at once.

```
sprite.js group create walk 0,0 0,1 0,2 0,3    # create cell group
sprite.js group list                            # list all cell groups
sprite.js group add walk 0,4 0,5                # add cells to group
sprite.js group remove walk 0,4                 # remove cells from group
sprite.js group delete walk                     # delete cell group

sprite.js shape-group create --cell 0,0 face eye_l eye_r mouth   # create shape group
sprite.js shape-group list --cell 0,0                             # list shape groups
sprite.js move-group face --cell 0,0 --dx 2 --dy 0               # move all shapes in group
sprite.js recolor-group face --cell 0,0 --color "#ff0000"         # recolor all shapes
```

## Export

```
sprite.js export   # export PNG + JSON atlas to working directory
sprite.js save     # persist project to SQLite
```

## Additional Resources

- **`references/tool-reference.md`** — complete flag reference for all CLI commands, anchor points per shape type, group details
