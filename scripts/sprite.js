#!/usr/bin/env node
// scripts/sprite.js — CLI entry point for claude-sprites
import { spawn } from 'child_process';
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

  const cmd = process.argv[2];
  const { args, positional } = parseArgs(process.argv.slice(3));
  const sub = positional[0];
  const name = positional[1];
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
      result = await api('POST', '/api/shape/move-to', { cell: args.cell, shape: sub, x: num(args.x), y: num(args.y) });
      break;
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
    case 'recolor':
      result = await api('POST', '/api/shape/recolor', { cell: args.cell, name: sub, color: args.color });
      break;
    case 'delete':
      result = await api('POST', '/api/shape/delete', { cell: args.cell, name: sub });
      break;
    case 'clone':
      result = await api('POST', '/api/shape/clone', { from_cell: args.from, to_cell: args.to, shape: sub, new_name: args.as });
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
    case 'view': {
      const format = args.png ? 'png' : 'terminal';
      result = await api('POST', '/api/cell/view', { cell: args.cell, format });
      if (result.ok && result.data?.terminal) {
        console.log(result.data.terminal);
        return;
      }
      break;
    }
    case 'undo':
      result = await api('POST', '/api/cell/undo', { cell: args.cell });
      break;
    case 'redo':
      result = await api('POST', '/api/cell/redo', { cell: args.cell });
      break;

    case 'group':
      switch (sub) {
        case 'create': result = await api('POST', '/api/group/cell/create', { name: name, cells: args.cells?.split(' ') ?? positional.slice(2) }); break;
        case 'list':   result = await api('GET', '/api/group/cell/list'); break;
        case 'add':    result = await api('POST', '/api/group/cell/add', { name: name, cells: args.cells?.split(' ') ?? positional.slice(2) }); break;
        case 'remove': result = await api('POST', '/api/group/cell/remove', { name: name, cells: args.cells?.split(' ') ?? positional.slice(2) }); break;
        case 'delete': result = await api('POST', '/api/group/cell/delete', { name: name }); break;
      }
      break;

    case 'shape-group':
      switch (sub) {
        case 'create': result = await api('POST', '/api/group/shape/create', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional.slice(2) }); break;
        case 'list':   result = await api('GET', `/api/group/shape/list?cell=${args.cell}`); break;
        case 'add':    result = await api('POST', '/api/group/shape/add', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional.slice(2) }); break;
        case 'remove': result = await api('POST', '/api/group/shape/remove', { cell: args.cell, name: name, shapes: args.shapes?.split(' ') ?? positional.slice(2) }); break;
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
