import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtemp, mkdir, copyFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import net from 'net';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITE_JS = join(__dirname, '..', '..', 'scripts', 'sprite.js');

async function pickPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

describe('sprite CLI dependency preflight', () => {
  // A plugin installed straight from a marketplace has no node_modules yet —
  // sprite.js itself runs on builtins, but the server it spawns cannot.
  // Simulate that cold install: sprite.js copied into a tree with no deps.
  let root;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sprite-preflight-'));
    await mkdir(join(root, 'scripts'));
    await copyFile(SPRITE_JS, join(root, 'scripts', 'sprite.js'));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('fails fast with an npm install hint instead of a bare server timeout', async () => {
    const port = await pickPort();
    let stderr = '';
    let code = 0;
    try {
      await exec(process.execPath, [join(root, 'scripts', 'sprite.js'), 'status'], {
        env: { ...process.env, SPRITE_PORT: String(port) },
        timeout: 15000,
      });
    } catch (e) {
      stderr = e.stderr ?? '';
      code = e.code ?? 0;
    }
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/npm install/);
    expect(stderr).toMatch(/dependencies/i);
  }, 20000);
});
