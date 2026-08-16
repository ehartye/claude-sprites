import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCanvas } from 'canvas';
import fs from 'fs';
import os from 'os';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

describe('CLI reference image', () => {
  let serverInfo;
  let state;
  let port;
  let refPath;

  beforeAll(async () => {
    const c = createCanvas(4, 4);
    c.getContext('2d').fillRect(0, 0, 4, 4);
    refPath = join(os.tmpdir(), `sprites-refcli-${Date.now()}.png`);
    fs.writeFileSync(refPath, c.toBuffer('image/png'));

    const sessions = new Map();
    let lastId = 0;
    const mockDb = {
      getLastSession() {
        const all = [...sessions.values()].sort((a, b) => b.updated_at - a.updated_at);
        return all[0] ?? undefined;
      },
      getSession(id) { return sessions.get(id); },
      createSession(fields) {
        const id = `s_${++lastId}`;
        const session = { id, ...fields, created_at: Date.now(), updated_at: Date.now() };
        sessions.set(id, session);
        return session;
      },
      updateDraft(id, json) {
        const s = sessions.get(id);
        if (s) { s.draft_json = json; s.updated_at = Date.now(); }
      },
      getCellGroups() { return {}; },
      setCellGroup() {},
      getShapeGroups() { return {}; },
    };
    state = { project: null, sessionId: null, db: mockDb };
    serverInfo = await startWebServer(state, 0);
    port = serverInfo.port;
  });

  afterAll(async () => {
    serverInfo.wss.close();
    await new Promise(r => serverInfo.httpServer.close(r));
    fs.rmSync(refPath, { force: true });
  });

  async function cli(...args) {
    const { stdout, stderr } = await exec(process.execPath, [SPRITE_JS, ...args], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('ref set attaches a reference image and the image route serves it', async () => {
    await cli('new', 'reftest', '--size', '16', '--rows', '1', '--cols', '1', '--palette', 'pico8');
    const { stdout } = await cli('ref', 'set', refPath, '--cell', '0,0', '--opacity', '0.5');
    expect(stdout).toMatch(/reference/i);

    const r = await fetch(`http://localhost:${port}/api/cell/reference-image?cell=0,0`);
    expect(r.status).toBe(200);
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf[0]).toBe(0x89); // PNG magic
  });

  test('ref clear removes it', async () => {
    await cli('ref', 'clear', '--cell', '0,0');
    const r = await fetch(`http://localhost:${port}/api/cell/reference-image?cell=0,0`);
    expect(r.status).toBe(404);
  });

  test('ref set with a bad path fails', async () => {
    let err;
    try {
      await cli('ref', 'set', join(os.tmpdir(), 'no-such-ref.png'), '--cell', '0,0');
    } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(String(err.stderr || '')).toMatch(/exist|not found/i);
  });
});
