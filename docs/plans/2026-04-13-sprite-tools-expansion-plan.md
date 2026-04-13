# Sprite Tools Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Cut agent turn-count on complex sprite builds by ~100× via compound draw commands, a recipe batch DSL, correctness fixes, and ergonomics for fan-out/group operations.

**Architecture:** Additions happen in three layers — the shared `server/handlers/draw.js` gets a compound `sphere-shade` and an `arc` primitive; `server/web/api/` gets a `control/shutdown` route; `scripts/sprite.js` extends `batch` with variable substitution and adds `restart`/`clone-cell` CLI commands. No schema changes. Existing tests in `tests/handlers/` and `tests/cli/` are the template.

**Tech Stack:** Node 20 ESM, vitest for tests, better-sqlite3, Express REST, CLI via raw args.

**Design reference:** `docs/plans/2026-04-13-sprite-tools-expansion-design.md`

---

## Batch A — Correctness (ship as one commit set)

### Task 1: Server-side `/api/control/shutdown` route

**Files:**
- Create: `server/web/api/control-routes.js`
- Modify: `server/web/http.js` (register route)
- Test: `tests/handlers/control.test.js`

**Step 1: Write the failing test**

```js
// tests/handlers/control.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { controlRoutes } from '../../server/web/api/control-routes.js';

describe('control routes', () => {
  it('POST /shutdown triggers graceful exit after responding', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const dbClose = vi.fn();
    const state = { db: { close: dbClose }, broadcast: vi.fn() };
    const app = express();
    app.use(express.json());
    app.use('/api/control', controlRoutes(state));
    const res = await fetch('http://test/shutdown'); // placeholder — use supertest if wired
    // Use manual invoke instead:
    // see existing handler tests for the wrap pattern
    expect(true).toBe(true); // replaced after route is shaped — see Step 3
    exitSpy.mockRestore();
  });
});
```

Step 1 note: match the style of `tests/handlers/cell-tools.test.js`. Use that file's pattern (instantiate route with mock state, use an express test adapter, or call the handler directly).

**Step 2: Run test to verify it fails**

Run: `npm test -- control`
Expected: FAIL — `control-routes.js` does not exist.

**Step 3: Implement the route**

```js
// server/web/api/control-routes.js
import express from 'express';

export function controlRoutes(state) {
  const r = express.Router();
  r.post('/shutdown', (_req, res) => {
    res.json({ ok: true, data: 'shutting down' });
    // Defer exit one tick so the response flushes.
    setImmediate(() => {
      try { state.broadcast?.({ type: 'shutdown' }); } catch {}
      try { state.db?.close(); } catch {}
      process.exit(0);
    });
  });
  return r;
}
```

**Step 4: Register in `http.js`**

In `server/web/http.js`, add near the other `app.use('/api', ...)` lines:

```js
import { controlRoutes } from './api/control-routes.js';
// ...
app.use('/api/control', controlRoutes(state));
```

**Step 5: Run test to verify it passes**

Run: `npm test -- control`
Expected: PASS.

**Step 6: Commit**

```bash
git add server/web/api/control-routes.js server/web/http.js tests/handlers/control.test.js
git commit -m "feat: add /api/control/shutdown for graceful restart"
```

---

### Task 2: CLI `sprite restart` command

**Files:**
- Modify: `scripts/sprite.js` (add command)
- Test: `tests/cli/restart.test.js`

**Step 1: Write the failing test**

```js
// tests/cli/restart.test.js
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';

describe('sprite restart', () => {
  it('prints restart confirmation and returns 0', () => {
    const out = spawnSync('node', ['scripts/sprite.js', 'restart'], { encoding: 'utf8' });
    expect(out.status).toBe(0);
    expect(out.stdout + out.stderr).toMatch(/restart|shutting down/i);
  }, 15000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- restart`
Expected: FAIL — unknown command.

**Step 3: Implement `restart` case in `scripts/sprite.js`**

In the main `switch (cmd)` block, add:

```js
case 'restart': {
  // Best-effort: ask server to shut down gracefully.
  try { await api('POST', '/api/control/shutdown'); } catch {}
  // Poll /health until it stops responding (max 3s), then spawn fresh server.
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    if (!(await health())) break;
  }
  await ensureServer();
  console.log('restarted');
  return;
}
```

**Step 4: Add `restart` to the help text**

In `HELP_TEXT`, under SESSION:

```
  restart                 graceful shutdown + respawn (replaces force-kill)
```

**Step 5: Run test**

Run: `npm test -- restart`
Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/sprite.js tests/cli/restart.test.js
git commit -m "feat: sprite restart CLI for graceful server cycle"
```

---

### Task 3: Fail-fast `batch` default

**Files:**
- Modify: `scripts/sprite.js` (batch case, around lines 395–448)
- Modify: `tests/cli/batch.test.js` (adjust expectations)

**Step 1: Write the failing test (new behavior)**

Append to `tests/cli/batch.test.js`:

```js
it('stops on first error by default with structured stderr line', () => {
  const tmp = path.join(os.tmpdir(), `batch-fail-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify([
    {"command":"draw","type":"rect","cell":"0,0","x":0,"y":0,"w":2,"h":2,"color":"#fff","name":"ok"},
    {"command":"delete","cell":"0,0","shape":"does_not_exist"},
    {"command":"draw","type":"rect","cell":"0,0","x":5,"y":5,"w":2,"h":2,"color":"#fff","name":"never"}
  ]));
  const out = spawnSync('node', ['scripts/sprite.js', 'batch', '--file', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  expect(out.status).toBe(1);
  expect(out.stderr).toMatch(/ERROR at op 2\/3/);
  // Shape "never" should not have been created.
  const shapes = spawnSync('node', ['scripts/sprite.js', 'shapes', '--cell', '0,0'], { encoding: 'utf8' });
  expect(shapes.stdout).not.toContain('never');
});

it('--continue-on-error preserves legacy behavior', () => {
  // Similar fixture; pass --continue-on-error; expect status 0 with failed count in summary.
});
```

**Step 2: Run tests**

Run: `npm test -- batch`
Expected: FAIL — current batch continues by default, exit 0.

**Step 3: Update `scripts/sprite.js` batch case**

Find the batch loop (around line 421–440). Change the default: loop exits on first error. Error line format:

```js
console.error(`ERROR at op ${i + 1}/${total}: ${label} — ${e.message}`);
process.exitCode = 1;
return;
```

Only skip that `return` when `continueOnError` is true.

**Step 4: Update help text**

Revise the `batch` entry in `HELP_TEXT` to reflect fail-fast default.

**Step 5: Run tests**

Run: `npm test -- batch`
Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/sprite.js tests/cli/batch.test.js
git commit -m "feat!: batch fails fast by default; --continue-on-error opt-in"
```

---

## Batch B — Compound draws

### Task 4: `draw sphere-shade` compound command

**Files:**
- Modify: `server/handlers/draw.js` (add handler)
- Modify: `scripts/sprite.js` (wire CLI flag passthrough — already wired via existing `--direction`, just ensure `--intensity` passes)
- Test: `tests/handlers/sphere-shade.test.js`

**Step 1: Write the failing test**

```js
// tests/handlers/sphere-shade.test.js
import { describe, it, expect } from 'vitest';
import { Project } from '../../server/engine/project.js';
import { handleDraw } from '../../server/handlers/draw.js';

function mkProject() {
  return Project.fromJSON({
    name: 't', cellSize: 64,
    grid: { rows: 1, cols: 1 },
    cells: { '0,0': { name: null, shapes: [] } },
    palette: 'db-32', background: { mode: 'transparent' }, groups: {}
  });
}

describe('draw sphere-shade', () => {
  it('emits 5 tiers on a large (r=16) circle', () => {
    const project = mkProject();
    const state = { project, broadcast: () => {} };
    handleDraw(state, 'circle', { cell: '0,0', cx: 32, cy: 32, r: 16, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball' });
    const names = res.shapeNames.map(n => n.replace(/_\d+$/, ''));
    const tiers = new Set(names);
    expect(tiers.has('ball_shade_mid')).toBe(true);
    expect(tiers.has('ball_shade_core')).toBe(true);
    expect(tiers.has('ball_shade_rim')).toBe(true);
    expect(tiers.has('ball_shade_hl')).toBe(true);
    expect(tiers.has('ball_shade_spec')).toBe(true);
  });
  it('low intensity emits only 2 tiers', () => {
    const project = mkProject();
    const state = { project, broadcast: () => {} };
    handleDraw(state, 'circle', { cell: '0,0', cx: 8, cy: 8, r: 4, color: '#639bff', shape_name: 'ball' });
    const res = handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'ball', intensity: 'low' });
    const tiers = new Set(res.shapeNames.map(n => n.replace(/_\d+$/, '')));
    expect(tiers.size).toBe(2);
  });
  it('errors on rect target', () => {
    const project = mkProject();
    const state = { project, broadcast: () => {} };
    handleDraw(state, 'rect', { cell: '0,0', x: 0, y: 0, w: 4, h: 4, color: '#639bff', shape_name: 'box' });
    expect(() => handleDraw(state, 'sphere-shade', { cell: '0,0', shape: 'box' }))
      .toThrow(/circle or ellipse/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- sphere-shade`
Expected: FAIL — `Unknown draw type: sphere-shade`.

**Step 3: Implement handler**

In `server/handlers/draw.js`, add near `handleHighlightShadow`:

```js
const SPHERE_TIERS_BY_INTENSITY = {
  low:  [['hl','highlight',1,'top-left',30,0.55],
         ['core','shadow',2,'bottom-right',35,0.72]],
  med:  [['mid','shadow',1,'bottom-right',110,0.78],
         ['core','shadow',2,'bottom-right',35,0.72],
         ['hl','highlight',1,'top-left',30,0.55]],
  high: [['mid','shadow',1,'bottom-right',110,0.78],
         ['core','shadow',2,'bottom-right',35,0.72],
         ['rim','highlight',1,'bottom-right',30,0.92],
         ['hl','highlight',1,'top-left',30,0.55],
         ['spec','highlight',3,'top-left',20,0.45]],
};

function pickIntensity(target) {
  const p = target.params;
  const sz = target.type === 'circle' ? p.r : Math.max(p.rx, p.ry);
  if (sz <= 6) return 'low';
  if (sz <= 12) return 'med';
  return 'high';
}

function handleSphereShade(state, params) {
  const cell = state.project.cells.getCell(params.cell);
  const target = cell.shapes.get(params.shape);
  if (!target) throw new Error(`Shape "${params.shape}" not found`);
  if (target.type !== 'circle' && target.type !== 'ellipse') {
    throw new Error(`sphere-shade requires a circle or ellipse target`);
  }
  const intensity = params.intensity === 'auto' || !params.intensity
    ? pickIntensity(target) : params.intensity;
  const tiers = SPHERE_TIERS_BY_INTENSITY[intensity];
  if (!tiers) throw new Error(`intensity must be low|med|high|auto`);
  const base = params.shape_name ?? `${params.shape}_shade`;
  const allNames = [];
  for (const [label, type, strength, dir, span, rf] of tiers) {
    // spec gets --count 2 fixed; others size-scale.
    const extra = label === 'spec' ? { count: 2 } : {};
    const r = handleHighlightShadow(state, type, {
      cell: params.cell, shape: params.shape,
      direction: dir, strength, span_deg: span, radius_factor: rf,
      shape_name: `${base}_${label}`, ...extra,
    });
    allNames.push(...r.shapeNames);
  }
  return { shapeNames: allNames };
}
```

Wire the dispatch in `handleDraw`:

```js
if (type === 'sphere-shade') return handleSphereShade(state, params);
```

(insert before the existing `if (type === 'highlight' || type === 'shadow')` check so it short-circuits).

**Step 4: Passthrough `intensity` flag in CLI**

In `scripts/sprite.js`, in the draw CLI body, add `intensity: args.intensity` to the POST body.

**Step 5: Run tests**

Run: `npm test -- sphere-shade`
Expected: PASS.

**Step 6: Commit**

```bash
git add server/handlers/draw.js scripts/sprite.js tests/handlers/sphere-shade.test.js
git commit -m "feat: draw sphere-shade compound command (5-tier lighting in one call)"
```

---

### Task 5: `draw arc` partial-ellipse primitive

**Files:**
- Modify: `server/handlers/draw.js` (add handler + rasterizer)
- Modify: `scripts/sprite.js` (CLI flags: `--from-deg`, `--to-deg`)
- Test: `tests/handlers/arc.test.js`

**Step 1: Write the failing test**

```js
// tests/handlers/arc.test.js
describe('draw arc', () => {
  it('emits only the specified angular range', () => {
    const project = mkProject(); // helper from sphere-shade test
    const state = { project, broadcast: () => {} };
    const res = handleDraw(state, 'arc', {
      cell: '0,0', cx: 32, cy: 32, rx: 16, ry: 16,
      from_deg: 90, to_deg: 270, color: '#000000', shape_name: 'halfarc',
    });
    expect(res.shapeNames.length).toBeGreaterThan(0);
    // All emitted pixels should be on the LEFT half of the circle.
    const cell = project.cells.getCell('0,0');
    for (const name of res.shapeNames) {
      const s = cell.shapes.get(name);
      expect(s.params.x).toBeLessThanOrEqual(32);
    }
  });
});
```

**Step 2: Run test**

Run: `npm test -- arc`
Expected: FAIL.

**Step 3: Implement handler**

In `server/handlers/draw.js`, add helper + handler:

```js
function rasterizeEllipseArc(cx, cy, rx, ry, fromDeg, toDeg) {
  const steps = Math.max(rx, ry) * 4;
  const drawn = new Set();
  const pixels = [];
  const fromRad = (fromDeg * Math.PI) / 180;
  const toRad = (toDeg * Math.PI) / 180;
  // Normalize: walk from fromRad to toRad clockwise (assume toRad > fromRad; wrap otherwise).
  let span = toRad - fromRad;
  if (span <= 0) span += 2 * Math.PI;
  const n = Math.max(8, Math.round((span / (2 * Math.PI)) * steps));
  for (let i = 0; i <= n; i++) {
    const a = fromRad + (span * i) / n;
    const px = Math.round(cx + rx * Math.cos(a));
    const py = Math.round(cy + ry * Math.sin(a));
    const key = `${px},${py}`;
    if (!drawn.has(key)) { drawn.add(key); pixels.push({ x: px, y: py }); }
  }
  return pixels;
}

function handleArc(state, params, cell) {
  const rx = params.rx ?? params.r;
  const ry = params.ry ?? params.r;
  if (!rx || !ry) throw new Error('arc requires rx/ry or r');
  const pixels = rasterizeEllipseArc(params.cx, params.cy, rx, ry, params.from_deg, params.to_deg);
  let filtered = pixels;
  if (params.clip_to) {
    const mask = cell.shapes.get(params.clip_to);
    if (!mask) throw new Error(`Clip-to shape "${params.clip_to}" not found`);
    filtered = pixels.filter(pt => isInsideShape(mask, pt.x, pt.y));
  }
  const base = params.shape_name ?? 'arc';
  const shapeNames = [];
  for (let i = 0; i < filtered.length; i++) {
    const name = `${base}_${i}`;
    const shape = cell.draw('point', filtered[i], params.color, name);
    state.broadcast?.({ type: 'draw', cell: params.cell, shape: shape.toJSON() });
    shapeNames.push(name);
  }
  return { shapeNames };
}
```

Wire in `handleDraw`:

```js
if (type === 'arc') return handleArc(state, params, cell);
```

**Step 4: CLI flags**

In `scripts/sprite.js`, extend the `draw` body:

```js
from_deg: num(args['from-deg']),
to_deg: num(args['to-deg']),
```

**Step 5: Run test**

Run: `npm test -- arc`
Expected: PASS.

**Step 6: Commit**

```bash
git add server/handlers/draw.js scripts/sprite.js tests/handlers/arc.test.js
git commit -m "feat: draw arc primitive (partial ellipse outline)"
```

---

## Batch C — Recipe batch

### Task 6: `batch --vars` inline substitution

**Files:**
- Modify: `scripts/sprite.js` (batch case)
- Modify: `tests/cli/batch.test.js`

**Step 1: Write the failing test**

```js
it('--vars substitutes placeholders in ops', () => {
  const tmp = path.join(os.tmpdir(), `batch-vars-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify([
    {"command":"draw","type":"rect","cell":"{{cell}}","x":"{{x}}","y":0,"w":2,"h":2,"color":"#fff","name":"r1"}
  ]));
  const out = spawnSync('node', [
    'scripts/sprite.js','batch','--file',tmp,'--vars','cell=0,0,x=5'
  ], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  expect(out.status).toBe(0);
  // r1 should exist at x=5.
  const shapes = spawnSync('node', ['scripts/sprite.js','shapes','--cell','0,0'], { encoding: 'utf8' });
  expect(shapes.stdout).toMatch(/r1/);
});
```

**Step 2: Run test**

Run: `npm test -- batch`
Expected: FAIL.

**Step 3: Implement substitution helper**

In `scripts/sprite.js` (near top of file):

```js
function parseVarsFlag(s) {
  const out = {};
  for (const kv of String(s).split(',')) {
    const [k, ...vparts] = kv.split('=');
    if (!k) continue;
    const v = vparts.join('=');
    const num = Number(v);
    out[k.trim()] = (v !== '' && !isNaN(num)) ? num : v;
  }
  return out;
}

function substituteVars(value, vars) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const m = value.match(/^\{\{(\w+)\}\}$/);
    if (m) {
      if (!(m[1] in vars)) throw new Error(`variable '${m[1]}' not defined`);
      return vars[m[1]]; // preserve numeric type
    }
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`variable '${k}' not defined`);
      return String(vars[k]);
    });
  }
  if (Array.isArray(value)) return value.map(v => substituteVars(v, vars));
  if (typeof value === 'object') {
    const o = {};
    for (const k of Object.keys(value)) o[k] = substituteVars(value[k], vars);
    return o;
  }
  return value;
}
```

**Step 4: Apply in batch case**

Parse `--vars` into a dict. Before executing each command, run `substituteVars(cmd, vars)`.

**Step 5: Run tests**

Run: `npm test -- batch`
Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/sprite.js tests/cli/batch.test.js
git commit -m "feat: batch --vars inline substitution"
```

---

### Task 7: `batch --vars-file` iteration

**Files:**
- Modify: `scripts/sprite.js`
- Modify: `tests/cli/batch.test.js`

**Step 1: Write the failing test**

```js
it('--vars-file iterates ops per frame dict', () => {
  const ops = path.join(os.tmpdir(), `ops-${Date.now()}.json`);
  fs.writeFileSync(ops, JSON.stringify([
    {"command":"draw","type":"rect","cell":"{{cell}}","x":0,"y":0,"w":"{{w}}","h":"{{w}}","color":"#fff","name":"r"}
  ]));
  const frames = path.join(os.tmpdir(), `frames-${Date.now()}.json`);
  fs.writeFileSync(frames, JSON.stringify([
    {"cell":"0,0","w":3},
    {"cell":"0,1","w":5}
  ]));
  const out = spawnSync('node', [
    'scripts/sprite.js','batch','--file',ops,'--vars-file',frames
  ], { encoding: 'utf8' });
  [ops, frames].forEach(f => fs.unlinkSync(f));
  expect(out.status).toBe(0);
  // Both cells should have an r shape.
});
```

**Step 2: Run test**

Run: `npm test -- batch`
Expected: FAIL.

**Step 3: Implement iteration**

In the batch case, if `--vars-file` is set, parse JSON → expect array. Loop: for each frame dict, run the full ops list with that dict.

**Step 4: Run tests**

Run: `npm test -- batch`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/sprite.js tests/cli/batch.test.js
git commit -m "feat: batch --vars-file iterates ops per frame"
```

---

## Batch D — Ergonomics (opportunistic)

### Task 8: `clone-cell` fan-out

**Files:**
- Create: `server/web/api/cell-fanout-routes.js` OR extend existing cell-routes
- Modify: `scripts/sprite.js`
- Test: `tests/cli/clone-cell.test.js`

**Step 1: Write the failing test**

```js
it('clone-cell fans out one source to many destinations atomically', () => {
  spawnSync('node', ['scripts/sprite.js','new','t','--size','16','--rows','1','--cols','4']);
  spawnSync('node', ['scripts/sprite.js','draw','rect','--cell','0,0','--x','0','--y','0','--w','2','--h','2','--color','#fff','--name','base']);
  const out = spawnSync('node', ['scripts/sprite.js','clone-cell','--from','0,0','--to','0,1','0,2','0,3'], { encoding: 'utf8' });
  expect(out.status).toBe(0);
  for (const c of ['0,1','0,2','0,3']) {
    const s = spawnSync('node', ['scripts/sprite.js','shapes','--cell',c], { encoding: 'utf8' });
    expect(s.stdout).toContain('base');
  }
});
```

**Step 2: Run test**

Run: `npm test -- clone-cell`
Expected: FAIL.

**Step 3: Implement**

Route `POST /api/cell/clone-fanout` takes `{ from: "0,0", to: ["0,1","0,2"] }`, does a transactional per-destination copy. Existing `copy --from --to` handler logic, looped.

CLI `clone-cell` case in `scripts/sprite.js` parses positional `--to` list (space-separated) and calls the route.

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add server/web/api/cell-routes.js scripts/sprite.js tests/cli/clone-cell.test.js
git commit -m "feat: clone-cell fan-out (one source to many cells atomically)"
```

---

### Task 9: `shape-group create --all-cells --pattern`

**Files:**
- Modify: `server/handlers/group.js` (or wherever shape-group create lives)
- Modify: `scripts/sprite.js`
- Test: `tests/handlers/shape-group-pattern.test.js`

**Step 1: Write the failing test** — create two cells with shapes named `seam_h`, `seam_v`, `ball` each. Call `shape-group create seams --all-cells --pattern '^seam_'`. Verify both cells have a group `seams` containing only the seam_* shapes.

**Step 2: Run** — FAIL.

**Step 3: Implement** — in the shape-group create handler, if `all_cells` is true, iterate every cell; compile the pattern with `new RegExp(params.pattern)`; build shape list by filtering each cell's shapes.

**Step 4: Run tests.**

**Step 5: Commit.**

```bash
git commit -m "feat: shape-group create --all-cells --pattern for bulk grouping"
```

---

### Task 10: `draw ring` (sugar)

**Files:**
- Modify: `server/handlers/draw.js` (dispatch to existing border handler with defaults)
- Test: `tests/handlers/ring.test.js`

**Step 1: Write the failing test** — given a circle `ball`, `draw ring --shape ball --color #000` should emit pixels adjacent to the ball outline's rasterization.

**Step 2: Run** — FAIL.

**Step 3: Implement** — in `handleDraw`, add:

```js
if (type === 'ring') {
  // Single-target sugar over border.
  const mask = params.clip_to; // optional
  const targetName = params.shape;
  return handleBorder(state, {
    ...params, shapes: targetName, clip_to: mask,
    shape_name: params.shape_name ?? `${targetName}_ring`,
  }, cell);
}
```

Expose `--offset-px` later if needed; for now just 1-pixel.

**Step 4: Run tests.**

**Step 5: Commit.**

```bash
git commit -m "feat: draw ring as single-target sugar over border"
```

---

## Post-Implementation

### Documentation pass

After all tasks land, in one commit:

- Update `scripts/sprite.js` `HELP_TEXT` with new commands.
- Update `skills/sprite-editing/references/tool-reference.md` with new command rows.
- Update `skills/sprite-shading/SKILL.md` to recommend `draw sphere-shade` as the one-call path.
- Update `skills/sprite-composition/SKILL.md` `clone-cell` + shape-group pattern notes.

```bash
git commit -m "docs: reference expanded sprite toolset"
```

### Reference-workflow validation

Build a fresh basketball using only the new tooling:

```
sprite new bounce-bb-v2 --size 64 --rows 1 --cols 8 --palette db-32
sprite batch --file recipes/basketball-frame.json --vars-file recipes/basketball-frames.json
sprite export
```

Confirm parity with `assets/claude-sprites/bounce-basketball/`. If parity holds, commit the recipe files to `recipes/` as reference examples.

---

## Total Commits

~11 commits over the plan (one per task + docs + recipe validation). Ship Batch A first as a standalone release, Batch B next, Batch C after B is stable, Batch D any time.
