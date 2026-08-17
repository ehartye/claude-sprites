import { describe, test, expect, afterEach, beforeEach } from 'vitest';
import { startWebServer } from '../../server/web/http.js';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// 1x1 transparent png
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

describe('Casting API Routes', () => {
  const servers = [];
  let baseUrl;
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'casting-'));
    await writeFile(join(dir, 'c1.png'), PNG);
    await writeFile(join(dir, 'c2.png'), PNG);
    const state = { project: null, sessionId: null, db: {} };
    const info = await startWebServer(state, 0);
    servers.push(info);
    baseUrl = `http://localhost:${info.port}`;
  });

  afterEach(async () => {
    for (const { httpServer, wss } of servers.splice(0)) {
      wss.close();
      await new Promise((r) => httpServer.close(r));
    }
    await rm(dir, { recursive: true, force: true });
  });

  const makeSession = async (extra = {}) => {
    const res = await fetch(`${baseUrl}/api/casting`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'vet walk',
        slots: [{ id: 'S1', label: 'down idle' }, { id: 'S2', label: 'down step' }],
        candidates: [{ id: 'B1', path: join(dir, 'c1.png') }, { id: 'B2', path: join(dir, 'c2.png') }],
        predictions: { S1: 'B1', S2: 'B2' },
        ...extra,
      }),
    });
    return res;
  };

  test('creates a session and serves it back with predictions', async () => {
    const res = await makeSession();
    expect(res.status).toBe(200);
    const { data: { id, url } } = await res.json();
    expect(id).toMatch(/^cast_/);
    expect(url).toContain('/casting.html?id=');
    const { data: got } = await (await fetch(`${baseUrl}/api/casting/${id}`)).json();
    expect(got.title).toBe('vet walk');
    expect(got.predictions.S1).toBe('B1');
    expect(got.slots).toHaveLength(2);
  });

  test('serves candidate images from their file paths', async () => {
    const { data: { id } } = await (await makeSession()).json();
    const img = await fetch(`${baseUrl}/api/casting/${id}/candidate/B1.png`);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toContain('image/png');
    expect((await img.arrayBuffer()).byteLength).toBe(PNG.length);
  });

  test('verdict is 404 until decided, then returns agreement with variance', async () => {
    const out = join(dir, 'verdict.json');
    const { data: { id } } = await (await makeSession({ out })).json();
    expect((await fetch(`${baseUrl}/api/casting/${id}/verdict`)).status).toBe(404);
    const res = await fetch(`${baseUrl}/api/casting/${id}/verdict`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: { S1: 'B1', S2: 'gap' } }),
    });
    expect(res.status).toBe(200);
    const { data: v } = await res.json();
    expect(v.agreement.total).toBe(2);
    expect(v.agreement.matches).toBe(1);
    expect(v.agreement.disagreements).toEqual([{ slot: 'S2', predicted: 'B2', selected: 'gap' }]);
    // out file records predictions AND selections for detector refinement
    const file = JSON.parse(await readFile(out, 'utf8'));
    expect(file.predictions.S2).toBe('B2');
    expect(file.selections.S2).toBe('gap');
    // poll endpoint now returns it
    const { data: polled } = await (await fetch(`${baseUrl}/api/casting/${id}/verdict`)).json();
    expect(polled.selections.S1).toBe('B1');
  });

  test('unknown session and missing candidate are 404', async () => {
    expect((await fetch(`${baseUrl}/api/casting/cast_nope`)).status).toBe(404);
    const { data: { id } } = await (await makeSession()).json();
    expect((await fetch(`${baseUrl}/api/casting/${id}/candidate/ZZ.png`)).status).toBe(404);
  });
  test('optional previews definition round-trips for the animation preview', async () => {
    const res = await makeSession({
      previews: [{ label: 'walk down', slots: ['S2', 'S1'], fps: 8 }],
    });
    const { data: { id } } = await res.json();
    const { data: got } = await (await fetch(`${baseUrl}/api/casting/${id}`)).json();
    expect(got.previews).toEqual([{ label: 'walk down', slots: ['S2', 'S1'], fps: 8 }]);
  });

  test('previews default to empty when not supplied', async () => {
    const { data: { id } } = await (await makeSession()).json();
    const { data: got } = await (await fetch(`${baseUrl}/api/casting/${id}`)).json();
    expect(got.previews).toEqual([]);
  });
});