#!/usr/bin/env node
// scripts/sprite.js — CLI entry point for claude-sprites
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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
  (process.exitCode = 1);
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

function parseVarsFlag(s) {
  // Split on commas that precede "<ident>=", so values like "0,0" are preserved.
  const out = {};
  const str = String(s);
  const parts = [];
  const re = /,(?=\w+=)/g;
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    parts.push(str.slice(last, m.index));
    last = m.index + 1;
  }
  parts.push(str.slice(last));
  for (const kv of parts) {
    if (!kv) continue;
    const eq = kv.indexOf('=');
    if (eq < 0) continue;
    const k = kv.slice(0, eq).trim();
    const v = kv.slice(eq + 1);
    if (!k) continue;
    const n = Number(v);
    out[k] = (v !== '' && !Number.isNaN(n)) ? n : v;
  }
  return out;
}

function substituteVars(value, vars) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const whole = value.match(/^\{\{(\w+)\}\}$/);
    if (whole) {
      if (!(whole[1] in vars)) throw new Error(`variable "${whole[1]}" not defined`);
      return vars[whole[1]];
    }
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`variable "${k}" not defined`);
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
    case 'rename':
      return { method: 'POST', path: '/api/shape/name', body: {
        cell: params.cell, shape_id: params.shape_id, name: params.name,
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
    case 'name':
      return { method: 'POST', path: '/api/cell/name', body: { cell: params.cell, name: params.as } };
    case 'undo':
      return { method: 'POST', path: '/api/cell/undo', body: { cell: params.cell } };
    case 'redo':
      return { method: 'POST', path: '/api/cell/redo', body: { cell: params.cell } };
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
    case 'rename': return `rename ${cmd.shape_id} -> ${cmd.name} (${cmd.cell})`;
    case 'name': return `name ${cmd.cell} -> ${cmd.as}`;
    case 'undo': return `undo (${cmd.cell})`;
    case 'redo': return `redo (${cmd.cell})`;
    case 'group': return `group ${cmd.sub} ${cmd.name}`;
    default: return `${cmd.command}`;
  }
}

const HELP_TEXT = `sprite — CLI for claude-sprites (server at ${BASE_URL})

SESSION
  new <name> [--size N --rows N --cols N --palette pico8|gameboy|nes|cga|db-16|db-32]
  open <path>            open saved project file
  save                   persist project to SQLite
  export                 export PNG + JSON atlas to cwd
  status                 show active project info

DRAWING  (draw <type> --cell R,C --color <hex|name> [--name <shape_name>])
  draw point     --x --y
  draw line      --x1 --y1 --x2 --y2
  draw rect      --x --y --w --h [--filled true]
  draw circle    --cx --cy --r [--filled true]
  draw ellipse   --cx --cy --rx --ry [--filled true]
  draw fill      --x --y                                       flood-fill
  draw highlight --shape <target> [--direction top-left|top|top-right|left|right|bottom-left|bottom|bottom-right] [--strength N] [--name <base>]
  draw shadow    --shape <target> [--direction ...] [--strength N] [--name <base>]
    highlight/shadow auto-compute lighter/darker color from palette ramps
    and place pixels along the target shape's bounding box edge.
    Requires target color to be in palette ramps (pico8, db-16, db-32).

SHAPES
  shapes      --cell                                list shapes z-ordered
  move    <name> --cell --dx --dy                   relative offset
  move-to <name> --cell --x --y                     absolute (anchor-dependent)
  resize  <name> --cell --updates '{"rx":5,"ry":3}' or --rx --ry --r --w --h
  recolor <name> --cell --color
  clone   <name> --from R,C --to R,C [--as new]
  delete  <name> --cell

CELLS
  copy  --from R,C --to R,C        clear --cell         name --cell --as <name>
  view  --cell                     view-anim <group>    undo/redo --cell

GROUPS (cells)
  group create <name> R,C R,C ...     group add/remove <name> R,C ...
  group delete <name>                 group list

SHAPE GROUPS (within a cell)
  shape-group create <name> <shapes...> --cell
  shape-group add/remove/delete <name> [--cell]      shape-group list --cell
  move-group    <name> --cell --dx --dy [--all-cells true]
  recolor-group <name> --cell --color [--all-cells true]

BATCH
  batch <path.json>           execute an array of commands; fails fast on first error
                              (stderr: "ERROR at op N/M: <label> — <message>", exit 1)
                              add --continue-on-error true to run all ops and summarize
                              --vars k=v,k2=v2  substitute {{k}} placeholders in ops
                                                (numeric when value parses as a number)

Full reference: skills/sprite-editing/references/tool-reference.md
`;

async function run() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(HELP_TEXT);
    return;
  }

  await ensureServer();

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
        count: num(args.count),
        span_deg: num(args['span-deg']),
        radius_factor: num(args['radius-factor']),
        intensity: args.intensity,
        clip_to: args['clip-to'],
        shape_prefix: args['shape-prefix'],
        shapes: args.shapes,
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

    case 'rename':
      result = await api('POST', '/api/shape/name', { cell: args.cell, shape_id: sub, name: args.as });
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

    case 'view-anim': {
      const groupName = sub;
      const groupResult = await api('GET', '/api/group/cell/list');
      if (!groupResult.ok) { console.error(groupResult.error); process.exitCode = 1; return; }
      const cellRefs = groupResult.data[groupName];
      if (!cellRefs || cellRefs.length === 0) {
        console.error(`Group "${groupName}" not found or empty`);
        process.exitCode = 1;
        return;
      }

      const frames = [];
      for (const cellRef of cellRefs) {
        const viewResult = await api('POST', '/api/cell/view', { cell: cellRef, format: 'terminal' });
        if (!viewResult.ok) { console.error(viewResult.error); process.exitCode = 1; return; }
        frames.push(viewResult.data.terminal);
      }

      const fps = num(args.fps) ?? 8;
      const loops = num(args.loops) ?? 3;
      const totalFrames = frames.length;
      const delay = Math.round(1000 / fps);

      let loopsPlayed = 0;
      while (loops === 0 || loopsPlayed < loops) {
        for (let i = 0; i < totalFrames; i++) {
          if (loopsPlayed > 0 || i > 0) {
            process.stdout.write('\x1b[H\x1b[2J');
          }
          process.stdout.write(frames[i]);
          process.stdout.write(`\nFrame ${i + 1}/${totalFrames} — ${groupName} @ ${fps}fps\n`);
          await new Promise(r => setTimeout(r, delay));
        }
        loopsPlayed++;
      }
      return;
    }

    case 'batch': {
      const continueOnError = bool(args['continue-on-error']);
      const inlineVars = args.vars ? parseVarsFlag(args.vars) : null;
      let frames = null;
      if (args['vars-file']) {
        const framesJson = JSON.parse(readFileSync(args['vars-file'], 'utf-8'));
        if (!Array.isArray(framesJson)) {
          console.error('--vars-file must contain a JSON array of variable dicts');
          process.exitCode = 1;
          return;
        }
        frames = framesJson;
      }
      let commands;

      if (args.stdin) {
        const data = await new Promise((resolve, reject) => {
          const chunks = [];
          process.stdin.on('data', chunk => chunks.push(chunk));
          process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          process.stdin.on('error', reject);
        });
        commands = JSON.parse(data);
      } else {
        const filePath = sub;
        if (!filePath) { console.error('Usage: sprite batch <file.json> or sprite batch --stdin'); process.exitCode = 1; return; }
        commands = JSON.parse(readFileSync(filePath, 'utf-8'));
      }

      if (!Array.isArray(commands)) { console.error('Batch input must be a JSON array'); process.exitCode = 1; return; }

      const runs = frames ?? [inlineVars];
      const total = commands.length * runs.length;
      let succeeded = 0;
      let failed = 0;
      let opIndex = 0;

      outer:
      for (const frameVars of runs) {
        for (let i = 0; i < commands.length; i++) {
          opIndex++;
          let cmd = commands[i];
          if (frameVars) {
            try { cmd = substituteVars(cmd, frameVars); }
            catch (e) {
              const label = describeBatchCommand(commands[i]);
              process.stdout.write(`[${opIndex}/${total}] ${label}`);
              console.log(` -> ERROR: ${e.message}`);
              failed++;
              if (!continueOnError) {
                console.error(`ERROR at op ${opIndex}/${total}: ${label} \u2014 ${e.message}`);
                process.exitCode = 1;
                return;
              }
              continue;
            }
          }
          const label = describeBatchCommand(cmd);
          process.stdout.write(`[${opIndex}/${total}] ${label}`);

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
              console.error(`ERROR at op ${opIndex}/${total}: ${label} \u2014 ${e.message}`);
              process.exitCode = 1;
              return;
            }
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

    default:
      console.error(`Unknown command: ${cmd}`);
      (process.exitCode = 1);
  }

  if (result) {
    if (result.ok) console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
    else { console.error(result.error); (process.exitCode = 1); }
  }
}

run().catch(e => { console.error(e.message); (process.exitCode = 1); });
