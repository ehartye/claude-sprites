---
name: sprite-new
description: Create a new sprite sheet project
---

Create a new sprite sheet project. Usage: /sprite-new [name] [WxH or N cell size] [rows]x[cols] [palette]

Run:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" new <name> --size <N|WxH> --rows <R> --cols <C> --palette <palette>
```

Defaults: 16x16 cells, 4x4 grid, pico8 palette, name "untitled". Tall characters usually want `--size 16x24` or `--size 16x32`. Ramp-aware palettes (`pico8`, `db-16`, `db-32`) unlock the highlight/shadow/sphere-shade lighting tools.

Afterward, tell the user the live web UI is at `http://localhost:3377` (or `$SPRITE_PORT` if set) and load the `sprite-editing` skill before drawing.
