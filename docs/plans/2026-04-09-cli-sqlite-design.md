# CLI + SQLite Redesign

## Overview

Replace the MCP tool approach with a CLI script + REST API pattern. Claude calls `scripts/sprite.js` via Bash. The user interacts via the web browser. No MCP dependency.

## Architecture

The existing Express server gains a `/api` route layer — thin wrappers over the same handlers the WebSocket DISPATCH table already calls. SQLite at `~/.claude-sprites/session.db` persists session state across restarts. The server reloads the last session on startup. Every mutation saves draft JSON to the DB automatically. The CLI checks `/health`, auto-starts the server as a detached background process if needed, then fires commands as HTTP POSTs and prints clean text output.

WebSocket broadcast still fires on every mutation so the browser stays in sync.

## CLI Interface

```bash
# Session
sprite status
sprite new <name> --size 16 --rows 1 --cols 8 --palette pico8
sprite open /path/to/file.sprites
sprite save
sprite export

# Drawing (all accept --cell, --color, --name)
sprite draw point --cell 0,0 --x 8 --y 3
sprite draw line  --cell 0,0 --x1 0 --y1 14 --x2 15 --y2 14
sprite draw rect  --cell 0,0 --x 0 --y 0 --w 16 --h 16
sprite draw circle  --cell 0,0 --cx 8 --cy 3 --r 3
sprite draw ellipse --cell 0,0 --cx 8 --cy 3 --rx 4 --ry 2
sprite draw fill    --cell 0,0 --x 8 --y 8

# Shapes
sprite shapes --cell 0,0
sprite move <name>    --cell 0,0 --dx 0 --dy 5
sprite move-to <name> --cell 0,0 --x 8 --y 11
sprite resize <name>  --cell 0,0 --rx 4 --ry 2
sprite recolor <name> --cell 0,0 --color "#ff004d"
sprite delete <name>  --cell 0,0
sprite clone <name>   --from 0,0 --to 0,1 --as shadow

# Cells
sprite copy --from 0,0 --to 0,1
sprite clear --cell 0,0
sprite name --cell 0,0 --as idle_1
sprite view --cell 0,0
sprite undo --cell 0,0
sprite redo --cell 0,0

# Cell groups (animation frame sets)
sprite group create <name> --cells 0,0 0,1 0,2 0,3
sprite group list
sprite group add <name>    --cells 0,4 0,5
sprite group remove <name> --cells 0,4
sprite group delete <name>

# Shape groups (per-cell; z-index stays per-shape)
sprite shape-group create <name> --shapes torso left_arm --cell 0,0
sprite shape-group list  --cell 0,0
sprite shape-group add   <name> --shapes head --cell 0,0
sprite shape-group remove <name> --shapes head --cell 0,0
sprite shape-group delete <name> --cell 0,0
sprite move-group   <name> --cell 0,0 --dx 2 --dy 0
sprite move-group   <name> --all-cells --dx 2 --dy 0
sprite recolor-group <name> --all-cells --color "#ff004d"
```

## REST API

All endpoints `POST /api/<command>` with JSON body. Response: `{ ok: true, data: ... }` or `{ ok: false, error: "..." }`.

```
GET  /api/session/status
POST /api/session/new        { name, size, rows, cols, palette }
POST /api/session/open       { path }
POST /api/session/save
POST /api/session/export

POST /api/draw               { type, cell, color, name?, ...params }
GET  /api/shapes             ?cell=0,0
POST /api/shape/move         { cell, name, dx, dy }
POST /api/shape/move-to      { cell, name, x, y }
POST /api/shape/resize       { cell, name, updates }
POST /api/shape/recolor      { cell, name, color }
POST /api/shape/delete       { cell, name }
POST /api/shape/clone        { from_cell, to_cell, name, as? }

POST /api/cell/copy          { from, to }
POST /api/cell/clear         { cell }
POST /api/cell/name          { cell, name }
POST /api/cell/view          { cell }
POST /api/cell/undo          { cell }
POST /api/cell/redo          { cell }

POST /api/group/cell/create  { name, cells[] }
GET  /api/group/cell/list
POST /api/group/cell/add     { name, cells[] }
POST /api/group/cell/remove  { name, cells[] }
POST /api/group/cell/delete  { name }

POST /api/group/shape/create  { cell, name, shapes[] }
GET  /api/group/shape/list    ?cell=0,0
POST /api/group/shape/add     { cell, name, shapes[] }
POST /api/group/shape/remove  { cell, name, shapes[] }
POST /api/group/shape/delete  { cell, name }
POST /api/group/shape/move    { name, cell?, all_cells?, dx, dy }
POST /api/group/shape/recolor { name, cell?, all_cells?, color }
```

## SQLite Schema

Location: `~/.claude-sprites/session.db`

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER,
  updated_at INTEGER,
  project_name TEXT,
  json_file TEXT,           -- source .sprites file path (null if unsaved)
  project_path TEXT,        -- working directory
  destination_folder TEXT,  -- e.g. assets/claude-sprites/bounce/
  draft_json TEXT           -- full project state, updated on every mutation
);

CREATE TABLE cell_groups (
  session_id TEXT,
  name TEXT,
  cells TEXT,               -- JSON array of cell refs
  PRIMARY KEY (session_id, name)
);

CREATE TABLE shape_groups (
  session_id TEXT,
  cell TEXT,
  name TEXT,
  shapes TEXT,              -- JSON array of shape names
  PRIMARY KEY (session_id, cell, name)
);
```

## Export Structure

```
assets/
  claude-sprites/
    bounce/
      bounce.png
      bounce.json
```

`save` flushes draft_json to `json_file`. `export` renders PNG and texture atlas JSON to `destination_folder`.

## Auto-Start

CLI checks `GET /health`. On failure, spawns `node server/index.js` as detached background process, polls health every 500ms for up to 10s, then proceeds.

## MCP Removal

- Delete `server/mcp/`
- Remove `"mcpServers"` from `.claude-plugin/plugin.json`
- Clear `.mcp.json`
- Rewrite `skills/sprite-editing/SKILL.md` to teach CLI workflow
- Update `skills/sprite-editing/references/tool-reference.md` to document CLI commands
