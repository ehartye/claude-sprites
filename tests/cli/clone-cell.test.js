import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

describe('CLI clone-cell fan-out', () => {
  let serverInfo;
  let state;
  let port;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = join(os.tmpdir(), `sprites-clonecell-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

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
    };
    state = { project: null, sessionId: null, db: mockDb };
    serverInfo = await startWebServer(state, 0);
    port = serverInfo.port;
  });

  afterAll(async () => {
    serverInfo.wss.close();
    await new Promise(r => serverInfo.httpServer.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function cli(...args) {
    const { stdout, stderr } = await exec(process.execPath, [SPRITE_JS, ...args], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('clones source cell to multiple destinations', async () => {
    await cli('new', 'clonecelltest', '--size', '16', '--rows', '2', '--cols', '3', '--palette', 'pico8');
    await cli('draw', 'circle', '--cell', '0,0', '--cx', '8', '--cy', '8', '--r', '4', '--color', '#ff004d', '--name', 'src_ball');

    await cli('clone-cell', '--from', '0,0', '--to', '0,1 0,2 1,0');

    for (const cell of ['0,1', '0,2', '1,0']) {
      const { stdout } = await cli('shapes', '--cell', cell);
      expect(stdout).toMatch(/circle/);
    }
  });

  test('fails fast if any destination is invalid', async () => {
    // 1,9 is out of range for a 2x3 grid — whole op should abort, 1,1 untouched.
    await cli('draw', 'point', '--cell', '1,1', '--x', '0', '--y', '0', '--color', '#ff004d', '--name', 'marker');
    let err;
    try {
      await cli('clone-cell', '--from', '0,0', '--to', '1,1 1,9');
    } catch (e) { err = e; }
    expect(err).toBeDefined();
    // 1,1 must still contain only the marker point — not the circle from 0,0.
    const { stdout } = await cli('shapes', '--cell', '1,1');
    expect(stdout).not.toMatch(/circle/);
    expect(stdout).toMatch(/point/);
  });
});
