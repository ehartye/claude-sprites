import { test, expect, beforeEach, afterEach } from 'vitest';
import { SessionDB } from '../../server/db/session.js';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs';
import { createRequire } from 'module';

let db;
let dbPath;
beforeEach(() => {
  dbPath = join(tmpdir(), `test-groupfps-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new SessionDB(dbPath);
});
afterEach(() => {
  db.close();
  fs.rmSync(dbPath, { force: true });
});

test('stores and retrieves per-group fps', () => {
  const s = db.createSession({ project_name: 'p', project_path: '.', destination_folder: '.', json_file: null, draft_json: '{}' });
  db.setCellGroup(s.id, 'walk', ['0,0', '0,1']);
  db.setCellGroupFps(s.id, 'walk', 10);
  expect(db.getCellGroupFps(s.id)).toEqual({ walk: 10 });
});

test('groups without fps are absent from the fps map', () => {
  const s = db.createSession({ project_name: 'p', project_path: '.', destination_folder: '.', json_file: null, draft_json: '{}' });
  db.setCellGroup(s.id, 'walk', ['0,0']);
  expect(db.getCellGroupFps(s.id)).toEqual({});
});

test('updating a group cell list preserves its fps', () => {
  const s = db.createSession({ project_name: 'p', project_path: '.', destination_folder: '.', json_file: null, draft_json: '{}' });
  db.setCellGroup(s.id, 'walk', ['0,0']);
  db.setCellGroupFps(s.id, 'walk', 10);
  db.setCellGroup(s.id, 'walk', ['0,0', '0,1']); // e.g. group add
  expect(db.getCellGroupFps(s.id)).toEqual({ walk: 10 });
  expect(db.getCellGroups(s.id)).toEqual({ walk: ['0,0', '0,1'] });
});

test('migrates an existing database missing the fps column', () => {
  db.close();
  // Recreate the pre-migration schema by hand
  fs.rmSync(dbPath, { force: true });
  const Database = createRequire(import.meta.url)('better-sqlite3');
  const raw = new Database(dbPath);
  raw.exec(`CREATE TABLE cell_groups (session_id TEXT, name TEXT, cells TEXT, PRIMARY KEY (session_id, name));`);
  raw.prepare(`INSERT INTO cell_groups (session_id, name, cells) VALUES (?, ?, ?)`).run('s1', 'walk', '["0,0"]');
  raw.close();

  db = new SessionDB(dbPath);
  expect(db.getCellGroups('s1')).toEqual({ walk: ['0,0'] });
  db.setCellGroupFps('s1', 'walk', 12);
  expect(db.getCellGroupFps('s1')).toEqual({ walk: 12 });
});
