import { test, expect, beforeEach, afterEach } from 'vitest';
import { SessionDB } from '../../server/db/session.js';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs';

let db;
let dbPath;
beforeEach(() => {
  dbPath = join(tmpdir(), `test-sessions-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = new SessionDB(dbPath);
});
afterEach(() => {
  db.close();
  fs.rmSync(dbPath, { force: true });
});

function make(name) {
  return db.createSession({ project_name: name, project_path: '.', destination_folder: '.', json_file: null, draft_json: '{}' });
}

test('listSessions returns newest-first with identifying fields', () => {
  const a = make('alpha');
  const b = make('beta');
  db.updateDraft(a.id, '{"x":1}'); // touch alpha so it becomes most recent
  const list = db.listSessions();
  expect(list[0].project_name).toBe('alpha');
  expect(list[1].project_name).toBe('beta');
  expect(list[0]).toHaveProperty('id');
  expect(list[0]).toHaveProperty('updated_at');
});

test('listSessions honors the limit', () => {
  for (let i = 0; i < 5; i++) make(`p${i}`);
  expect(db.listSessions(3)).toHaveLength(3);
});

test('findSessionByName returns the most recently updated match', () => {
  const first = make('walker');
  make('walker');
  db.updateDraft(first.id, '{"x":1}');
  expect(db.findSessionByName('walker').id).toBe(first.id);
  expect(db.findSessionByName('nope')).toBeUndefined();
});
