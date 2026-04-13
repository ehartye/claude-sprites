# Sprite Editing CLI Reference

All commands: `node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" <command> [positional] [--flags]`

The server auto-starts on first invocation. Port defaults to 3377 (override with `SPRITE_PORT` env var).

## Session Commands

| Command | Flags | Notes |
|---------|-------|-------|
| `new <name>` | `--size 16 --rows 4 --cols 4 --palette pico8` | Create project. Palettes: `pico8`, `gameboy`, `nes`, `cga` |
| `open <path>` | | Open saved project file |
| `save` | | Persist project to SQLite |
| `export` | | Export PNG + JSON atlas to working directory |
| `status` | | Show current project info |

## Drawing

All draw commands: `draw <type> --cell <coord> --color <hex> [--name <shape_name>]`

| Type | Required Flags | Shape Anchor |
|------|---------------|-------------|
| `point` | `--x --y` | The pixel itself |
| `line` | `--x1 --y1 --x2 --y2` | Bresenham pixel-perfect; start point |
| `rect` | `--x --y --w --h [--filled true]` | Top-left corner |
| `circle` | `--cx --cy --r [--filled true]` | Center |
| `ellipse` | `--cx --cy --rx --ry [--filled true]` | Center |
| `fill` | `--x --y` | Flood-fills contiguous same-color region |
| `highlight` | `--shape <target> [--direction <dir>] [--strength N] [--name <base>] [--count N --span-deg N --radius-factor F]` | Auto-places lighter pixels using palette ramp |
| `shadow` | `--shape <target> [--direction <dir>] [--strength N] [--name <base>] [--count N --span-deg N --radius-factor F]` | Auto-places darker pixels using palette ramp |

### Clipping (masking pixels to another shape)

Any unfilled outline draw (`ellipse`, `circle` with `--filled false`) accepts `--clip-to <shape_name>`. Pixels of the outline that fall **outside** the named mask shape are dropped; the ones inside are persisted as individual named points (`<base>_<i>`).

Use it when you want a stamp, decoration, or construction line that only shows within another shape's silhouette — for example drawing a curved line across the surface of a ball, or a pattern contained within a body.

```
# only the portion of the big ellipse's outline that falls inside `ball` persists
sprite.js draw ellipse --cell 0,0 --cx 8 --cy 32 --rx 20 --ry 16 \
                       --filled false --color "#000000" \
                       --name arc --clip-to ball
```

Supported mask shape types: `circle`, `ellipse`, `rect`. Currently applies only to unfilled ellipse/circle outlines; other source shapes don't yet clip.

Colors: hex string like `"#ff0000"` or palette color name.

### Highlight / Shadow details

Prefer these over hand-placed points for lighting. They:
- Look up the named target shape (rect/circle/ellipse — not point/line).
- Resolve a lighter (`highlight`) or darker (`shadow`) color from the palette's color ramp. Ramp-aware palettes: `pico8`, `db-16`, `db-32`. Target color must exist in a ramp.
- For **circles/ellipses**, sample pixels along a curved arc centered on the direction, placed *inside* the shape — this follows the form like proper sphere shading and avoids "pillow shading" (tracing the outline).
- For **rects**, place pixels along the bbox edge (straight runs are correct for flat-sided shapes).

Directions: `top-left` (default highlight), `top-right`, `bottom-left`, `bottom-right` (default shadow), `top`, `bottom`, `left`, `right`.

Flags:
- `--strength N` — steps N positions along the palette ramp (default 1). Higher values = more contrast.
- `--count N` — override pixel count. Default scales with shape size (`round(r × 0.4)`, min 2).
- `--span-deg N` — arc span in degrees. Default: 30 (highlight), 40 (shadow).
- `--radius-factor F` — fraction of radius from center (0–1). Default: 0.55 (highlight), 0.70 (shadow). Lower = deeper into shape. Higher = closer to silhouette.
- `--name <base>` — override the auto-generated `<target>_hl_<i>` / `<target>_sh_<i>` naming.

### Shading technique

For the craft of multi-tier lighting (form shadow, core shadow, rim light, specular peak) and the anti-patterns to avoid, see the `sprite-shading` skill. This reference documents flags only.

### Deformation across frames

There's no dedicated squash/stretch command — use `resize` on a named shape:

```
sprite.js resize ball --cell 0,3 --updates '{"rx":5,"ry":3}'   # squash on impact
sprite.js resize ball --cell 0,1 --updates '{"rx":4,"ry":5}'   # stretch mid-air
```

`resize` also accepts individual flags (`--rx 5 --ry 3`) as a shorthand that's merged into the updates object.

## Shape Management

| Command | Positional | Flags | Notes |
|---------|-----------|-------|-------|
| `shapes` | | `--cell` | List shapes z-ordered (id, name, type, color) |
| `move <name>` | shape name | `--cell --dx --dy` | Relative pixel offset |
| `move-to <name>` | shape name | `--cell --x --y` | Absolute position (anchor-dependent) |
| `resize <name>` | shape name | `--cell --updates '{"w":10}'` | Merge param updates |
| `recolor <name>` | shape name | `--cell --color` | Change color |
| `clone <name>` | shape name | `--from --to [--as new_name]` | Copy shape across cells |
| `delete <name>` | shape name | `--cell` | Permanently remove shape |

## Cell Operations

| Command | Flags | Notes |
|---------|-------|-------|
| `copy` | `--from --to` | Deep copy all shapes between cells |
| `clear` | `--cell` | Remove all shapes from cell |
| `name` | `--cell --as <name>` | Give cell a readable name |
| `view` | `--cell` | Render cell preview |
| `undo` | `--cell` | Undo last operation in cell |
| `redo` | `--cell` | Redo undone operation in cell |

## Cell Groups

Cell groups organize frames into animation sequences (stored in SQLite).

| Command | Positional | Notes |
|---------|-----------|-------|
| `group create <name> <cells...>` | group name + cell coords | Create group with cells |
| `group list` | | List all cell groups |
| `group add <name> <cells...>` | group name + cell coords | Add cells to existing group |
| `group remove <name> <cells...>` | group name + cell coords | Remove cells from group |
| `group delete <name>` | group name | Delete group (cells stay intact) |

## Shape Groups

Shape groups let you move or recolor multiple shapes within a cell at once (stored in SQLite).

| Command | Positional | Flags | Notes |
|---------|-----------|-------|-------|
| `shape-group create <name> <shapes...>` | group name + shape names | `--cell` | Create shape group |
| `shape-group list` | | `--cell` | List shape groups in cell |
| `shape-group add <name> <shapes...>` | group name + shape names | `--cell` | Add shapes to group |
| `shape-group remove <name> <shapes...>` | group name + shape names | `--cell` | Remove shapes from group |
| `shape-group delete <name>` | group name | `--cell` | Delete shape group |
| `move-group <name>` | group name | `--cell --dx --dy [--all-cells true]` | Move all shapes in group |
| `recolor-group <name>` | group name | `--cell --color [--all-cells true]` | Recolor all shapes in group |

Use `--all-cells true` to apply the operation across every cell that contains the named shape group.

## Move Anchor Reference

When using `move-to <name> --x --y`:

| Shape Type | Anchor Point |
|-----------|-------------|
| `point` | The pixel itself |
| `rect` | Top-left corner (`x, y`) |
| `circle` | Center (`cx, cy`) |
| `ellipse` | Center (`cx, cy`) |
| `line` | Start point (`x1, y1`) |

## Resize Updates Reference

The `--updates` flag takes a JSON object with keys matching the shape's parameters:

| Shape Type | Resizable Params |
|-----------|-----------------|
| `rect` | `w`, `h` |
| `circle` | `r` |
| `ellipse` | `rx`, `ry` |
| `line` | `x1`, `y1`, `x2`, `y2` |
