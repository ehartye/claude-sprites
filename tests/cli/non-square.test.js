import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

describe('CLI non-square cells', () => {
  let serverInfo;
  let state;
  let port;

  beforeAll(async () => {
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
  });

  async function cli(...args) {
    const { stdout, stderr } = await exec(process.execPath, [SPRITE_JS, ...args], {
      env: { ...process.env, SPRITE_PORT: String(port) },
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('new accepts WxH size and the full stack honors both axes', async () => {
    const { stdout } = await cli('new', 'tallguy', '--size', '8x16', '--rows', '1', '--cols', '2', '--palette', 'pico8');
    expect(stdout).toMatch(/8x16px/);

    await cli('draw', 'point', '--cell', '0,0', '--x', '0', '--y', '15', '--color', '#ff004d', '--name', 'foot');
    await cli('mirror', '--cell', '0,0', '--axis', 'vertical');
    const r = await fetch(`http://localhost:${port}/api/shapes?cell=0,0`);
    const json = await r.json();
    expect(json.data.find(s => s.name === 'foot').params.y).toBe(0);
  });
});
