# Sprite Editing CLI Reference

All commands: `node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" <command> [positional] [--flags]`

The server auto-starts on first invocation. Port defaults to 3377 (override with `SPRITE_PORT` env var).

## Session Commands

| Command | Flags | Notes |
|---------|-------|-------|
| `new <name>` | `--size 16 --rows 4 --cols 4 --palette pico8` | Create project. `--size` takes `16` (square) or `16x32` (width x height — tall character cells). Palettes: `pico8`, `gameboy`, `nes`, `cga` |
| `open <path>` | | Open saved project file |
| `save` | | Persist project to SQLite |
| `export` | | Export gapless sheet PNG + **Aseprite JSON atlas** (`<name>.atlas.json`) to the project's asset folder. The atlas carries `meta.frameTags` (one per cell group, as a contiguous appended frame run), per-frame `duration` from each group's fps, and the pivot as a slice — consumable directly by Unity/Godot/Phaser importers |
| `pivot` | `--x N --y N` \| `--anchor center\|top-center\|bottom-center\|bottom-left\|bottom-right` | Set the sprite origin exported in the atlas (characters usually want `bottom-center`) |
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
| `polygon` | `--points "x,y x,y x,y ..." [--filled true]` | Closed polygon: Bresenham outline + scanline fill. First point is the move anchor. Best for angular shapes (swords, arrows, ships, terrain) |
| `polyline` | `--points "x,y x,y ..."` | Open multi-segment stroke (no closing edge, never filled) |
| `highlight` | `--shape <target> [--direction <dir>] [--strength N] [--name <base>] [--count N --span-deg N --radius-factor F]` | Auto-places lighter pixels using palette ramp |
| `shadow` | `--shape <target> [--direction <dir>] [--strength N] [--name <base>] [--count N --span-deg N --radius-factor F]` | Auto-places darker pixels using palette ramp |
| `sphere-shade` | `--shape <target> [--direction <dir>] [--intensity low\|med\|high\|auto] [--name <base>]` | Compound 2–5 tier lighting on a circle/ellipse in one call |
| `arc` | `--cx --cy (--r \| --rx --ry) --from-deg <A> --to-deg <B> --color <c> [--clip-to <mask>] [--name <base>]` | Partial ellipse outline (CW, y-down: 0=east, 90=south) |
| `ring` | `--shape <target> --color <c> [--clip-to <mask>] [--name <base>]` | Single-target 4-neighbor halo (sugar over `border`) |

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
- `--dither true` — adds a checkerboard transition band adjacent to the solid band (toward the mid-zone on circles/ellipses, one step inward on rects), named `<base>_d_<i>`. Classic pixel-art softening between the lit/shaded zone and the base color.

### Sphere shading (compound)

`draw sphere-shade` is the preferred way to light a circle/ellipse. It composes 2–5 highlight/shadow tiers in a single call.

- `--intensity auto` (default) picks tiers by target size: `r<=6` → low (2 tiers), `7–12` → med (3 tiers), `>12` → high (5 tiers). Ellipse uses `max(rx, ry)`.
- `--direction` rotates all tiers consistently (highlight/spec toward, shadow/rim opposite).
- Target must be circle or ellipse; target color must resolve in a palette ramp.
- Emits shapes named `<base>_<tier>_<i>` (default base `<target>_shade`).

### Arc primitive

`draw arc` rasterizes just the outline portion of an ellipse between two angles. Replaces the "draw oversized ellipse + clip-to" workaround for surface curves.

- Angles use CW, y-down convention: 0°=east, 90°=south, 180°=west, 270°=north.
- `--r N` is shorthand for `--rx N --ry N` (circular arc).
- `--clip-to <mask>` still applies as a secondary filter.
- Emits one named point per pixel (`<name>_<i>`).

### Ring

`draw ring` is single-target sugar over `draw border` — a 4-neighbor halo around one target shape.

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
| `flip <name>` | shape name | `--cell --axis horizontal\|vertical [--about self\|cell]` | Mirror one shape. `self` (default) flips in place about its own center; `cell` mirrors its position across the cell |
| `rotate <name>` | shape name | `--cell --deg 90\|180\|270 [--about self\|cell]` | Rotate one shape CW (y-down). `self` (default) spins in place; `cell` orbits the cell center. 90° steps only — exact for pixel art |

## Cell Operations

| Command | Flags | Notes |
|---------|-------|-------|
| `copy` | `--from --to` | Deep copy all shapes between cells |
| `clone-cell` | `--from R,C --to "R1,C1 R2,C2 ..."` | Atomic fan-out copy of one cell into many destinations (space-separated list, quoted) |
| `clear` | `--cell` | Remove all shapes from cell |
| `mirror` | `--cell --axis horizontal\|vertical` | Flip every shape across the cell — the standard way to derive walk-left frames from walk-right |
| `rotate-cell` | `--cell --deg 90\|180\|270` | Rotate every shape about the cell center (CW, y-down) — e.g. spin frames from one drawn frame |
| `name` | `--cell --as <name>` | Give cell a readable name |
| `ref set <image.png>` | `--cell [--opacity 0.35]` | Attach a tracing reference image: rendered dimmed **under** shapes in `view` output and the web UI editor, scaled to the cell, never included in exports. Use it to copy a pose or style from an existing image |
| `ref clear` | `--cell` | Remove the reference |
| `view` | `--cell` | Render cell preview (includes the reference underlay if set) |
| `undo` | `--cell` | Undo last operation in cell |
| `redo` | `--cell` | Redo undone operation in cell |

## Tween

`tween <shape> --group <cellgroup>` interpolates a shape across every frame of a cell group in one call — the standard multi-frame motion workflow is: draw frame 1, `clone-cell` fan-out, `group create`, then tween.

| Flag | Meaning |
|------|---------|
| `--to X,Y` | End position (anchor coords). Start defaults to the shape's position in the group's first frame |
| `--from X,Y` | Override the start position |
| `--to-updates '{"r":1}'` | End values for numeric shape params (r, rx/ry, w/h). Start values read from the first frame |
| `--from-updates '{"r":4}'` | Override start param values |
| `--ease linear\|in\|out\|in-out` | Easing curve (default linear). `out` decelerates (landing), `in` accelerates (falling) |

Position and param tweens combine in one call — e.g. a ball that moves down while squashing: `tween ball --group drop --to 8,14 --to-updates '{"ry":2}' --ease in`.

## Cell Groups

Cell groups organize frames into animation sequences (stored in SQLite).

| Command | Positional | Notes |
|---------|-----------|-------|
| `group create <name> <cells...>` | group name + cell coords | Create group with cells. `--fps N` sets playback speed (exported as atlas frame durations; default 8) |
| `group fps <name> <N>` | group name + fps | Set/change a group's fps |
| `group list` | | List all cell groups |
| `group add <name> <cells...>` | group name + cell coords | Add cells to existing group |
| `group remove <name> <cells...>` | group name + cell coords | Remove cells from group |
| `group delete <name>` | group name | Delete group (cells stay intact) |

## Shape Groups

Shape groups let you move or recolor multiple shapes within a cell at once (stored in SQLite).

| Command | Positional | Flags | Notes |
|---------|-----------|-------|-------|
| `shape-group create <name> <shapes...>` | group name + shape names | `--cell` \| `--all-cells --pattern <regex>` | Create shape group (across all cells via regex match) |
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

## Batch Mode

Run a JSON array of operations in one CLI call. Collapses per-frame bash loops into a single deterministic call.

```
sprite.js batch ops.json [--vars-file frames.json | --vars k=v,k=v] [--continue-on-error]
```

- `ops.json` — array of `{ command, args }` objects. String values may contain `{{var}}` placeholders.
- `--vars-file frames.json` — JSON array of per-iteration variable dicts. The whole op list replays once per dict.
- `--vars k=v,k=v` — single-iteration inline shortcut.
- **Type preservation:** a string exactly equal to `"{{foo}}"` becomes the raw value (number stays number). Embedded placeholders (`"0,{{i}}"`) stay strings.
- **Fail-fast by default:** stops on first error with structured stderr (`ERROR at op 4/12: ...`). Use `--continue-on-error` for legacy best-effort behavior.
- No arithmetic, no conditionals, no nested interpolation. Pre-compute numeric values in the vars file.

## Server Control

| Command | Notes |
|---------|-------|
| `restart` | Clean server restart via `POST /api/control/shutdown`. Flushes pending writes, closes DB, respawns. Prefer over `Stop-Process -Force`. |
