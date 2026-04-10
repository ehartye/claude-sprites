# CLI + SQLite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Replace MCP tools with a CLI script + REST API, add SQLite session persistence, and add shape groups.

**Architecture:** Express server gains `/api` REST routes (thin wrappers over existing handlers). SQLite at `~/.claude-sprites/session.db` persists session state across restarts. `scripts/sprite.js` is a CLI that auto-starts the server if needed and posts commands as HTTP.

**Tech Stack:** Node.js ESM, Express, better-sqlite3, ws, vitest

---

## Task 1: Install better-sqlite3

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

```bash
npm install better-sqlite3
```

**Step 2: Verify it resolves**

```bash
node -e "import('better-sqlite3').then(m => console.log('ok'))"
# Note: better-sqlite3 is CJS; import with createRequire
node -e "const { createRequire } = await import('module'); const r = createRequire(import.meta.url); r('better-sqlite3'); console.log('ok')" --input-type=module
```

Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add better-sqlite3"
```

---

## Task 2: SQLite Session Manager

**Files:**
- Create: `server/db/session.js`
- Create: `tests/db/session.test.js`

**Step 1: Write failing tests**

```js
// tests/db/session.test.js
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionDB } from '../../server/db/session.js';

const require = createRequire(import.meta.url);

let db;
beforeEach(() => {
  db = new SessionDB(join(tmpdir(), `test-${Date.now()}.db`));
});
afterEach(() => db.close());

test('creates a new session', () => {
  const session = db.createSession({
    project_name: 'bounce',
    project_path: '/tmp/myproject',
    destination_folder: '/tmp/myproject/assets/claude-sprites/bounce',
    json_file: null,
    draft_json: '{}',
  });
  expect(session.id).toBeTruthy();
  expect(session.project_name).toBe('bounce');
});

test('loads last session', () => {
  db.createSession({ project_name: 'a', project_path: '/a', destination_folder: '/a/assets', json_file: null, draft_json: '{}' });
  db.createSession({ project_name: 'b', project_path: '/b', destination_folder: '/b/assets', json_file: null, draft_json: '{}' });
  const last = db.getLastSession();
  expect(last.project_name).toBe('b');
});

test('updates draft_json', () => {
  const s = db.createSession({ project_name: 'x', project_path: '/x', destination_folder: '/x/assets', json_file: null, draft_json: '{}' });
  db.updateDraft(s.id, '{"cells":{}}');
  const loaded = db.getLastSession();
  expect(loaded.draft_json).toBe('{"cells":{}}');
});

test('creates and retrieves cell group', () => {
  const s = db.createSession({ project_name: 'x', project_path: '/x', destination_folder: '/x/assets', json_file: null, draft_json: '{}' });
  db.setCellGroup(s.id, 'walk', ['0,0', '0,1', '0,2']);
  const groups = db.getCellGroups(s.id);
  expect(groups).toEqual({ walk: ['0,0', '0,1', '0,2'] });
});

test('creates and retrieves shape group', () => {
  const s = db.createSession({ project_name: 'x', project_path: '/x', destination_folder: '/x/assets', json_file: null, draft_json: '{}' });
  db.setShapeGroup(s.id, '0,0', 'body', ['torso', 'left_arm']);
  const groups = db.getShapeGroups(s.id, '0,0');
  expect(groups).toEqual({ body: ['torso', 'left_arm'] });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/db/session.test.js
```

Expected: FAIL — `SessionDB` not found.

**Step 3: Implement `server/db/session.js`**

```js
import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_PATH = join(homedir(), '.claude-sprites', 'session.db');

export class SessionDB {
  constructor(dbPath = DEFAULT_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER,
        updated_at INTEGER,
        project_name TEXT,
        json_file TEXT,
        project_path TEXT,
        destination_folder TEXT,
        draft_json TEXT
      );
      CREATE TABLE IF NOT EXISTS cell_groups (
        session_id TEXT,
        name TEXT,
        cells TEXT,
        PRIMARY KEY (session_id, name)
      );
      CREATE TABLE IF NOT EXISTS shape_groups (
        session_id TEXT,
        cell TEXT,
        name TEXT,
        shapes TEXT,
        PRIMARY KEY (session_id, cell, name)
      );
    `);
  }

  createSession({ project_name, project_path, destination_folder, json_file, draft_json }) {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, created_at, updated_at, project_name, json_file, project_path, destination_folder, draft_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, now, now, project_name, json_file, project_path, destination_folder, draft_json);
    return this.getSession(id);
  }

  getSession(id) {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  getLastSession() {
    return this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 1').get();
  }

  updateDraft(id, draft_json) {
    this.db.prepare('UPDATE sessions SET draft_json = ?, updated_at = ? WHERE id = ?')
      .run(draft_json, Date.now(), id);
  }

  updateSession(id, fields) {
    const entries = Object.entries(fields);
    const set = entries.map(([k]) => `${k} = ?`).join(', ');
    const vals = entries.map(([, v]) => v);
    this.db.prepare(`UPDATE sessions SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...vals, Date.now(), id);
  }

  setCellGroup(sessionId, name, cells) {
    this.db.prepare(`
      INSERT OR REPLACE INTO cell_groups (session_id, name, cells) VALUES (?, ?, ?)
    `).run(sessionId, name, JSON.stringify(cells));
  }

  deleteCellGroup(sessionId, name) {
    this.db.prepare('DELETE FROM cell_groups WHERE session_id = ? AND name = ?').run(sessionId, name);
  }

  getCellGroups(sessionId) {
    const rows = this.db.prepare('SELECT name, cells FROM cell_groups WHERE session_id = ?').all(sessionId);
    return Object.fromEntries(rows.map(r => [r.name, JSON.parse(r.cells)]));
  }

  setShapeGroup(sessionId, cell, name, shapes) {
    this.db.prepare(`
      INSERT OR REPLACE INTO shape_groups (session_id, cell, name, shapes) VALUES (?, ?, ?, ?)
    `).run(sessionId, cell, name, JSON.stringify(shapes));
  }

  deleteShapeGroup(sessionId, cell, name) {
    this.db.prepare('DELETE FROM shape_groups WHERE session_id = ? AND cell = ? AND name = ?')
      .run(sessionId, cell, name);
  }

  getShapeGroups(sessionId, cell) {
    const rows = this.db.prepare('SELECT name, shapes FROM shape_groups WHERE session_id = ? AND cell = ?')
      .all(sessionId, cell);
    return Object.fromEntries(rows.map(r => [r.name, JSON.parse(r.shapes)]));
  }

  getAllShapeGroups(sessionId) {
    const rows = this.db.prepare('SELECT cell, name, shapes FROM shape_groups WHERE session_id = ?').all(sessionId);
    const result = {};
    for (const r of rows) {
      if (!result[r.cell]) result[r.cell] = {};
      result[r.cell][r.name] = JSON.parse(r.shapes);
    }
    return result;
  }

  close() { this.db.close(); }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/db/session.test.js
```

Expected: all pass.

**Step 5: Commit**

```bash
git add server/db/session.js tests/db/session.test.js
git commit -m "feat: SQLite session manager with cell/shape groups"
```

---

## Task 3: Wire DB into Server State

**Files:**
- Modify: `server/index.js`
- Modify: `server/web/http.js` — add `db` to state, add `/health` endpoint

**Step 1: Update `server/index.js`**

Replace the MCP imports and startup with DB init and session restore. Remove all `import ... from './mcp/...'` lines and the `createMcpServer`/`startMcpServer` calls.

```js
import { startWebServer } from './web/http.js';
import { SessionDB } from './db/session.js';
import { Project } from './engine/project.js';

const db = new SessionDB();

const state = {
  project: null,
  sessionId: null,
  db,
};

// Restore last session
const lastSession = db.getLastSession();
if (lastSession?.draft_json) {
  try {
    state.project = Project.fromJSON(JSON.parse(lastSession.draft_json));
    state.sessionId = lastSession.id;
  } catch (e) {
    console.error('Failed to restore last session:', e.message);
  }
}

const WEB_PORT = parseInt(process.env.SPRITE_PORT ?? '3377', 10);
startWebServer(state, WEB_PORT).then((info) => {
  console.error(`Sprite editor: http://localhost:${info.port}`);
}).catch((err) => {
  console.error(`Web server failed: ${err.message}`);
  process.exit(1);
});
```

**Step 2: Add `/health` to `server/web/http.js`**

Add before the WebSocket setup:

```js
app.get('/health', (_req, res) => res.json({ ok: true }));
```

**Step 3: Start server and verify health**

```bash
node server/index.js &
sleep 2
curl http://localhost:3377/health
```

Expected: `{"ok":true}`

**Step 4: Commit**

```bash
git add server/index.js server/web/http.js
git commit -m "feat: wire SessionDB into server state, restore on startup"
```

---

## Task 4: REST API — Session Routes

**Files:**
- Create: `server/web/api/session-routes.js`
- Modify: `server/web/http.js` — mount api router

**Step 1: Create `server/web/api/session-routes.js`**

```js
import { Router } from 'express';
import { Project } from '../../engine/project.js';
import { CellManager } from '../../engine/cell-manager.js';
import { Palette } from '../../engine/palette.js';
import { CanvasRenderer } from '../../engine/canvas-renderer.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function sessionRoutes(state) {
  const r = Router();

  r.get('/status', (_req, res) => {
    const session = state.db.getLastSession();
    if (!session) return res.json({ ok: true, data: { active: false } });
    res.json({ ok: true, data: {
      active: true,
      project_name: session.project_name,
      project_path: session.project_path,
      destination_folder: session.destination_folder,
      json_file: session.json_file,
      session_id: session.id,
    }});
  });

  r.post('/new', (req, res) => {
    try {
      const { name, size = 16, rows = 4, cols = 4, palette = 'pico8' } = req.body;
      if (!name) return res.json({ ok: false, error: 'name required' });
      const project_path = process.cwd();
      const destination_folder = join(project_path, 'assets', 'claude-sprites', name);
      const project = new Project(name, size, rows, cols);
      project.loadPalette(palette);
      state.project = project;
      const draft_json = JSON.stringify(project.toJSON());
      const session = state.db.createSession({ project_name: name, project_path, destination_folder, json_file: null, draft_json });
      state.sessionId = session.id;
      state.broadcast?.({ type: 'project', data: project.toJSON() });
      res.json({ ok: true, data: `Created "${name}" (${size}px ${rows}x${cols})` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/open', (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) return res.json({ ok: false, error: 'path required' });
      const raw = JSON.parse(readFileSync(filePath, 'utf8'));
      const project = Project.fromJSON(raw);
      state.project = project;
      const name = project.name;
      const project_path = process.cwd();
      const destination_folder = join(project_path, 'assets', 'claude-sprites', name);
      const draft_json = JSON.stringify(project.toJSON());
      const session = state.db.createSession({ project_name: name, project_path, destination_folder, json_file: filePath, draft_json });
      state.sessionId = session.id;
      state.broadcast?.({ type: 'project', data: project.toJSON() });
      res.json({ ok: true, data: `Opened "${name}" from ${filePath}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/save', (req, res) => {
    try {
      if (!state.project) return res.json({ ok: false, error: 'No active project' });
      const session = state.db.getSession(state.sessionId);
      if (!session?.json_file) return res.json({ ok: false, error: 'No file path — use save-as' });
      writeFileSync(session.json_file, JSON.stringify(state.project.toJSON(), null, 2));
      res.json({ ok: true, data: `Saved to ${session.json_file}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/export', (req, res) => {
    try {
      if (!state.project) return res.json({ ok: false, error: 'No active project' });
      const session = state.db.getSession(state.sessionId);
      const dest = session.destination_folder;
      const { mkdirSync, writeFileSync } = require('fs'); // use createRequire pattern if needed
      // Render PNG
      const renderer = new CanvasRenderer(state.project.palette, { background: state.project.background });
      const png = renderer.renderSheet(state.project.cells);
      mkdirSync(dest, { recursive: true });
      const pngPath = join(dest, `${session.project_name}.png`);
      const jsonPath = join(dest, `${session.project_name}.json`);
      writeFileSync(pngPath, png);
      writeFileSync(jsonPath, JSON.stringify(state.project.toJSON(), null, 2));
      res.json({ ok: true, data: `Exported to ${dest}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  return r;
}
```

**Step 2: Mount in `server/web/http.js`**

Add after `app.use(express.static(...))`:

```js
import express from 'express';
// ... existing imports ...
import { sessionRoutes } from './api/session-routes.js';
import { drawRoutes } from './api/draw-routes.js';
import { shapeRoutes } from './api/shape-routes.js';
import { cellRoutes } from './api/cell-routes.js';
import { groupRoutes } from './api/group-routes.js';

// In startWebServer:
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/session', sessionRoutes(state));
app.use('/api', drawRoutes(state));
app.use('/api', shapeRoutes(state));
app.use('/api', cellRoutes(state));
app.use('/api', groupRoutes(state));
```

**Step 3: Test manually**

```bash
curl -s -X POST http://localhost:3377/api/session/new \
  -H "Content-Type: application/json" \
  -d '{"name":"test","size":16,"rows":2,"cols":4}'
```

Expected: `{"ok":true,"data":"Created \"test\" (16px 2x4)"}`

**Step 4: Commit**

```bash
git add server/web/api/session-routes.js server/web/http.js
git commit -m "feat: REST session routes (new/open/save/export/status)"
```

---

## Task 5: REST API — Draw + Shape Routes

**Files:**
- Create: `server/web/api/draw-routes.js`
- Create: `server/web/api/shape-routes.js`

These are thin adapters over the existing handler functions. After each mutation, call `state.db.updateDraft(state.sessionId, JSON.stringify(state.project.toJSON()))`.

Add a helper to `server/web/http.js` (or a shared util):

```js
export function saveDraft(state) {
  if (state.sessionId && state.project) {
    state.db.updateDraft(state.sessionId, JSON.stringify(state.project.toJSON()));
  }
}
```

**`server/web/api/draw-routes.js`:**

```js
import { Router } from 'express';
import { handleDraw } from '../../mcp/drawing-tools.js'; // reuse handler
// NOTE: After MCP removal in Task 9, move handleDraw to server/handlers/draw.js

export function drawRoutes(state) {
  const r = Router();
  r.post('/draw', (req, res) => {
    try {
      const { type, ...params } = req.body;
      const result = handleDraw(state, type, params);
      saveDraft(state);
      res.json({ ok: true, data: result });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  r.get('/shapes', (req, res) => {
    try {
      const cell = state.project.cells.getCell(req.query.cell);
      const shapes = cell.shapes.listByZ().map(s => s.toJSON());
      res.json({ ok: true, data: shapes });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  return r;
}
```

**`server/web/api/shape-routes.js`:**

```js
import { Router } from 'express';
import { handleMoveShape, handleMoveShapeTo, handleResizeShape,
         handleRecolorShape, handleDeleteShape, handleCloneShape,
         handleSetZ, handleShapeZDirection } from '../../mcp/shape-tools.js';

export function shapeRoutes(state) {
  const r = Router();
  const wrap = (handler) => (req, res) => {
    try {
      const result = handler(state, req.body);
      saveDraft(state);
      res.json({ ok: true, data: result ?? 'ok' });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  };
  r.post('/shape/move',    wrap(handleMoveShape));
  r.post('/shape/move-to', wrap(handleMoveShapeTo));
  r.post('/shape/resize',  wrap(handleResizeShape));
  r.post('/shape/recolor', wrap(handleRecolorShape));
  r.post('/shape/delete',  wrap(handleDeleteShape));
  r.post('/shape/clone',   wrap(handleCloneShape));
  r.post('/shape/set-z',   wrap(handleSetZ));
  r.post('/shape/z-dir',   wrap(handleShapeZDirection));
  return r;
}
```

**Step 1: Write integration test**

```js
// tests/web/api.test.js
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Start a test server on a random port, POST to it, check responses
// See tests/web/http.test.js for the existing server test pattern
```

Follow the pattern in `tests/web/http.test.js` to spin up a test server.

**Step 2: Run tests**

```bash
npx vitest run tests/web/api.test.js
```

**Step 3: Commit**

```bash
git add server/web/api/draw-routes.js server/web/api/shape-routes.js
git commit -m "feat: REST draw and shape routes"
```

---

## Task 6: REST API — Cell + Group Routes

**Files:**
- Create: `server/web/api/cell-routes.js`
- Create: `server/web/api/group-routes.js`

**`server/web/api/cell-routes.js`** — thin wrappers over existing cell handlers:

```js
import { Router } from 'express';
import { handleShiftCell, handleMirrorCell, handleCopyCell,
         handleClearCell, handleNameCell, handleListCells } from '../../mcp/cell-tools.js';
import { handleUndo, handleRedo } from '../../mcp/history-tools.js';
import { handleViewCell } from '../../mcp/view-tools.js';

export function cellRoutes(state) {
  const r = Router();
  const wrap = (handler) => (req, res) => {
    try {
      const result = handler(state, req.body);
      saveDraft(state);
      res.json({ ok: true, data: result ?? 'ok' });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  };
  r.post('/cell/copy',   wrap(handleCopyCell));
  r.post('/cell/clear',  wrap(handleClearCell));
  r.post('/cell/name',   wrap(handleNameCell));
  r.post('/cell/shift',  wrap(handleShiftCell));
  r.post('/cell/mirror', wrap(handleMirrorCell));
  r.post('/cell/undo',   wrap(handleUndo));
  r.post('/cell/redo',   wrap(handleRedo));
  r.get('/cells',        (req, res) => {
    try { res.json({ ok: true, data: handleListCells(state, {}) }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  r.post('/cell/view',   (req, res) => {
    try { res.json({ ok: true, data: handleViewCell(state, req.body) }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  return r;
}
```

**`server/web/api/group-routes.js`** — cell groups (animation sets) + shape groups (new):

```js
import { Router } from 'express';

export function groupRoutes(state) {
  const r = Router();

  // --- Cell groups (animation frame sets) ---
  r.post('/group/cell/create', (req, res) => {
    try {
      const { name, cells } = req.body;
      state.db.setCellGroup(state.sessionId, name, cells);
      res.json({ ok: true, data: `Created cell group "${name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.get('/group/cell/list', (_req, res) => {
    try {
      res.json({ ok: true, data: state.db.getCellGroups(state.sessionId) });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/cell/add', (req, res) => {
    try {
      const { name, cells: newCells } = req.body;
      const groups = state.db.getCellGroups(state.sessionId);
      const existing = groups[name] ?? [];
      state.db.setCellGroup(state.sessionId, name, [...new Set([...existing, ...newCells])]);
      res.json({ ok: true, data: `Added to group "${name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/cell/remove', (req, res) => {
    try {
      const { name, cells: remove } = req.body;
      const groups = state.db.getCellGroups(state.sessionId);
      const updated = (groups[name] ?? []).filter(c => !remove.includes(c));
      state.db.setCellGroup(state.sessionId, name, updated);
      res.json({ ok: true, data: `Removed from group "${name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/cell/delete', (req, res) => {
    try {
      state.db.deleteCellGroup(state.sessionId, req.body.name);
      res.json({ ok: true, data: `Deleted group "${req.body.name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // --- Shape groups (per-cell, move as unit) ---
  r.post('/group/shape/create', (req, res) => {
    try {
      const { cell, name, shapes } = req.body;
      state.db.setShapeGroup(state.sessionId, cell, name, shapes);
      res.json({ ok: true, data: `Created shape group "${name}" in ${cell}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.get('/group/shape/list', (req, res) => {
    try {
      res.json({ ok: true, data: state.db.getShapeGroups(state.sessionId, req.query.cell) });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/shape/add', (req, res) => {
    try {
      const { cell, name, shapes: newShapes } = req.body;
      const groups = state.db.getShapeGroups(state.sessionId, cell);
      const existing = groups[name] ?? [];
      state.db.setShapeGroup(state.sessionId, cell, name, [...new Set([...existing, ...newShapes])]);
      res.json({ ok: true, data: `Added shapes to group "${name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/shape/remove', (req, res) => {
    try {
      const { cell, name, shapes: remove } = req.body;
      const groups = state.db.getShapeGroups(state.sessionId, cell);
      const updated = (groups[name] ?? []).filter(s => !remove.includes(s));
      state.db.setShapeGroup(state.sessionId, cell, name, updated);
      res.json({ ok: true, data: `Removed shapes from group "${name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/shape/delete', (req, res) => {
    try {
      state.db.deleteShapeGroup(state.sessionId, req.body.cell, req.body.name);
      res.json({ ok: true, data: `Deleted shape group "${req.body.name}"` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/shape/move', (req, res) => {
    try {
      const { name, cell, all_cells, dx, dy } = req.body;
      const cellsToUpdate = all_cells
        ? Object.keys(state.db.getAllShapeGroups(state.sessionId)).filter(c => {
            const groups = state.db.getShapeGroups(state.sessionId, c);
            return name in groups;
          })
        : [cell];
      for (const c of cellsToUpdate) {
        const groups = state.db.getShapeGroups(state.sessionId, c);
        const shapes = groups[name] ?? [];
        const cellObj = state.project.cells.getCell(c);
        for (const shapeName of shapes) {
          cellObj.moveShape(shapeName, dx, dy);
        }
        state.broadcast?.({ type: 'shape_moved', cell: c });
      }
      saveDraft(state);
      res.json({ ok: true, data: `Moved group "${name}" by (${dx},${dy})` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/group/shape/recolor', (req, res) => {
    try {
      const { name, cell, all_cells, color } = req.body;
      const cellsToUpdate = all_cells
        ? Object.keys(state.db.getAllShapeGroups(state.sessionId)).filter(c => {
            return name in state.db.getShapeGroups(state.sessionId, c);
          })
        : [cell];
      for (const c of cellsToUpdate) {
        const groups = state.db.getShapeGroups(state.sessionId, c);
        const shapes = groups[name] ?? [];
        const cellObj = state.project.cells.getCell(c);
        for (const shapeName of shapes) {
          cellObj.recolorShape(shapeName, color);
        }
        state.broadcast?.({ type: 'shape_recolored', cell: c });
      }
      saveDraft(state);
      res.json({ ok: true, data: `Recolored group "${name}" to ${color}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  return r;
}
```

**Step 1: Run existing tests to make sure nothing broke**

```bash
npx vitest run
```

**Step 2: Commit**

```bash
git add server/web/api/cell-routes.js server/web/api/group-routes.js
git commit -m "feat: REST cell and group routes"
```

---

## Task 7: CLI Script

**Files:**
- Create: `scripts/sprite.js`

The script auto-starts the server, then maps subcommands to HTTP requests.

```js
#!/usr/bin/env node
// scripts/sprite.js
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = `http://localhost:${process.env.SPRITE_PORT ?? 3377}`;

async function health() {
  try {
    const r = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(500) });
    return r.ok;
  } catch { return false; }
}

async function ensureServer() {
  if (await health()) return;
  const serverPath = join(__dirname, '..', 'server', 'index.js');
  const child = spawn(process.execPath, [serverPath], {
    detached: true, stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await health()) return;
  }
  console.error('Server failed to start');
  process.exit(1);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE_URL}${path}`, opts);
  return r.json();
}

function parseArgs(argv) {
  const args = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] ?? true;
      i += 2;
    } else {
      positional.push(argv[i]);
      i++;
    }
  }
  return { args, positional };
}

function num(v) { return v !== undefined ? Number(v) : undefined; }
function bool(v) { return v === 'true' || v === true; }

async function run() {
  await ensureServer();

  const [cmd, sub, name] = process.argv.slice(2);
  const { args, positional } = parseArgs(process.argv.slice(4));
  let result;

  switch (cmd) {
    case 'status':
      result = await api('GET', '/api/session/status');
      break;
    case 'new':
      result = await api('POST', '/api/session/new', {
        name: sub, size: num(args.size), rows: num(args.rows),
        cols: num(args.cols), palette: args.palette,
      });
      break;
    case 'open':
      result = await api('POST', '/api/session/open', { path: sub });
      break;
    case 'save':
      result = await api('POST', '/api/session/save', {});
      break;
    case 'export':
      result = await api('POST', '/api/session/export', {});
      break;

    case 'draw':
      result = await api('POST', '/api/draw', {
        type: sub, cell: args.cell, color: args.color, name: args.name,
        x: num(args.x), y: num(args.y),
        x1: num(args.x1), y1: num(args.y1), x2: num(args.x2), y2: num(args.y2),
        cx: num(args.cx), cy: num(args.cy),
        r: num(args.r), rx: num(args.rx), ry: num(args.ry),
        w: num(args.w), h: num(args.h),
        filled: args.filled !== undefined ? bool(args.filled) : undefined,
      });
      break;

    case 'shapes':
      result = await api('GET', `/api/shapes?cell=${args.cell}`);
      if (result.ok) {
        const lines = result.data.map(s =>
          `  ${s.name ?? s.id}: ${s.type} z=${s.zIndex} color=${s.color}`
        );
        console.log(lines.join('\n'));
        return;
      }
      break;

    case 'move':
      result = await api('POST', '/api/shape/move', { cell: args.cell, name: sub, dx: num(args.dx), dy: num(args.dy) });
      break;
    case 'move-to':
      result = await api('POST', '/api/shape/move-to', { cell: args.cell, name: sub, x: num(args.x), y: num(args.y) });
      break;
    case 'resize':
      result = await api('POST', '/api/shape/resize', { cell: args.cell, name: sub, updates: JSON.parse(args.updates) });
      break;
    case 'recolor':
      result = await api('POST', '/api/shape/recolor', { cell: args.cell, name: sub, color: args.color });
      break;
    case 'delete':
      result = await api('POST', '/api/shape/delete', { cell: args.cell, name: sub });
      break;
    case 'clone':
      result = await api('POST', '/api/shape/clone', { from_cell: args.from, to_cell: args.to, name: sub, as: args.as });
      break;

    case 'copy':
      result = await api('POST', '/api/cell/copy', { from: args.from, to: args.to });
      break;
    case 'clear':
      result = await api('POST', '/api/cell/clear', { cell: args.cell });
      break;
    case 'name':
      result = await api('POST', '/api/cell/name', { cell: args.cell, name: args.as });
      break;
    case 'view':
      result = await api('POST', '/api/cell/view', { cell: args.cell });
      break;
    case 'undo':
      result = await api('POST', '/api/cell/undo', { cell: args.cell });
      break;
    case 'redo':
      result = await api('POST', '/api/cell/redo', { cell: args.cell });
      break;

    case 'group':
      switch (sub) {
        case 'create': result = await api('POST', '/api/group/cell/create', { name: positional[0] ?? name, cells: args.cells?.split(' ') ?? positional }); break;
        case 'list':   result = await api('GET', '/api/group/cell/list'); break;
        case 'add':    result = await api('POST', '/api/group/cell/add', { name: positional[0] ?? name, cells: args.cells?.split(' ') ?? positional }); break;
        case 'remove': result = await api('POST', '/api/group/cell/remove', { name: positional[0] ?? name, cells: args.cells?.split(' ') ?? positional }); break;
        case 'delete': result = await api('POST', '/api/group/cell/delete', { name: positional[0] ?? name }); break;
      }
      break;

    case 'shape-group':
      switch (sub) {
        case 'create': result = await api('POST', '/api/group/shape/create', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional }); break;
        case 'list':   result = await api('GET', `/api/group/shape/list?cell=${args.cell}`); break;
        case 'add':    result = await api('POST', '/api/group/shape/add', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional }); break;
        case 'remove': result = await api('POST', '/api/group/shape/remove', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional }); break;
        case 'delete': result = await api('POST', '/api/group/shape/delete', { cell: args.cell, name: name }); break;
      }
      break;

    case 'move-group':
      result = await api('POST', '/api/group/shape/move', {
        name: sub, cell: args.cell, all_cells: bool(args['all-cells']),
        dx: num(args.dx), dy: num(args.dy),
      });
      break;

    case 'recolor-group':
      result = await api('POST', '/api/group/shape/recolor', {
        name: sub, cell: args.cell, all_cells: bool(args['all-cells']), color: args.color,
      });
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }

  if (result) {
    if (result.ok) console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
    else { console.error(result.error); process.exit(1); }
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
```

**Step 1: Make script executable and test it**

```bash
node scripts/sprite.js status
node scripts/sprite.js new bounce --size 16 --rows 1 --cols 8 --palette pico8
node scripts/sprite.js draw circle --cell 0,0 --cx 8 --cy 3 --r 3 --color "#ff004d" --name ball
node scripts/sprite.js shapes --cell 0,0
```

Expected: clean text output, no errors.

**Step 2: Test auto-start (kill server first)**

```bash
pkill -f "server/index.js" || true
node scripts/sprite.js status
```

Expected: server auto-starts, status returns.

**Step 3: Commit**

```bash
git add scripts/sprite.js
git commit -m "feat: sprite CLI script with auto-start"
```

---

## Task 8: Remove MCP

**Files:**
- Delete: `server/mcp/` (entire directory)
- Modify: `server/index.js` — already done in Task 3; verify no MCP imports remain
- Modify: `.claude-plugin/plugin.json` — remove `mcpServers` field
- Modify: `.mcp.json` — replace with empty config
- Modify: `server/web/api/draw-routes.js` — move handler inline (no longer import from mcp/)
- Modify: `server/web/api/shape-routes.js` — same
- Modify: `server/web/api/cell-routes.js` — same
- Modify: `package.json` — remove `@modelcontextprotocol/sdk` dependency

**Step 1: Move handlers out of mcp/ into server/handlers/**

Create `server/handlers/draw.js`, `server/handlers/shape.js`, `server/handlers/cell.js`, `server/handlers/history.js`, `server/handlers/view.js` by copying the handler functions (not the `register*` MCP registration functions).

Update all imports in `server/web/api/*.js` and `server/web/http.js` to point to `server/handlers/`.

**Step 2: Delete MCP directory**

```bash
rm -rf server/mcp/
```

**Step 3: Update plugin.json**

```json
{
  "name": "claude-sprites",
  "version": "0.4.0",
  "description": "Collaborative pixel art sprite sheet editor",
  "author": { "name": "Eric Hart" },
  "license": "MIT"
}
```

**Step 4: Clear .mcp.json**

```json
{}
```

**Step 5: Remove MCP SDK**

```bash
npm uninstall @modelcontextprotocol/sdk
```

**Step 6: Run tests**

```bash
npx vitest run
```

All tests should still pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove MCP, consolidate handlers under server/handlers/"
```

---

## Task 9: Rewrite Skill

**Files:**
- Modify: `skills/sprite-editing/SKILL.md`
- Modify: `skills/sprite-editing/references/tool-reference.md`

**Step 1: Rewrite `SKILL.md`**

Teach Claude:
- How to call `node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" <command>`
- Server auto-starts — no manual setup needed
- Animation workflow: draw one frame → copy → move/resize per frame
- Shape groups for multi-part structures
- Cell groups for animation sets

Keep under 2,000 words. Point to `references/tool-reference.md` for full command reference.

**Step 2: Rewrite `references/tool-reference.md`**

Document every CLI command with full flags. Replace the old MCP tool table.

**Step 3: Commit**

```bash
git add skills/
git commit -m "docs: rewrite sprite-editing skill for CLI workflow"
```

---

## Task 10: Bump Version + Smoke Test

**Step 1: Update version in `package.json` to `0.4.0`**

**Step 2: End-to-end smoke test**

```bash
# Kill any running server
pkill -f "server/index.js" || true

# Full workflow
node scripts/sprite.js new bounce --size 16 --rows 1 --cols 8 --palette pico8
node scripts/sprite.js draw circle --cell 0,0 --cx 8 --cy 3 --r 3 --color "#ff004d" --name ball
node scripts/sprite.js draw point  --cell 0,0 --x 7 --y 2 --color "#fff1e8" --name highlight
node scripts/sprite.js draw line   --cell 0,0 --x1 0 --y1 14 --x2 15 --y2 14 --color "#5f574f" --name ground
node scripts/sprite.js copy --from 0,0 --to 0,1
node scripts/sprite.js move ball --cell 0,1 --dx 0 --dy 2
node scripts/sprite.js shapes --cell 0,1
node scripts/sprite.js group create bounce --cells 0,0 0,1 0,2 0,3 0,4 0,5 0,6 0,7
node scripts/sprite.js status
node scripts/sprite.js export
```

**Step 3: Verify web UI still updates in real-time** — open browser to localhost:3377 and confirm shapes appear as CLI draws them.

**Step 4: Final commit**

```bash
git add package.json
git commit -m "chore: bump to 0.4.0, complete MCP→CLI migration"
```
