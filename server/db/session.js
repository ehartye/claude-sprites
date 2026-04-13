import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_PATH = join(homedir(), '.claude-sprites', 'session.db');

export class SessionDB {
  constructor(dbPath = DEFAULT_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    // WAL + synchronous=FULL ensures every commit is fsynced — force-kills
    // can no longer lose the most recent writes. Minor perf cost, acceptable
    // for this workload (draws are low-frequency vs fsync cost).
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER,
        updated_at INTEGER,
        project_name TEXT,
        json_file TEXT,
        project_path TEXT,
        destination_folder TEXT,
        draft_json TEXT
      );
      CREATE TABLE IF NOT EXISTS cell_groups (
        session_id TEXT,
        name TEXT,
        cells TEXT,
        PRIMARY KEY (session_id, name)
      );
      CREATE TABLE IF NOT EXISTS shape_groups (
        session_id TEXT,
        cell TEXT,
        name TEXT,
        shapes TEXT,
        PRIMARY KEY (session_id, cell, name)
      );
    `);
  }

  createSession({ project_name, project_path, destination_folder, json_file, draft_json }) {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, created_at, updated_at, project_name, json_file, project_path, destination_folder, draft_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, now, now, project_name, json_file, project_path, destination_folder, draft_json);
    return this.getSession(id);
  }

  getSession(id) {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  getLastSession() {
    // Tie-break on id (monotonic) so same-millisecond inserts have stable order.
    return this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC, id DESC LIMIT 1').get();
  }

  updateDraft(id, draft_json) {
    this.db.prepare('UPDATE sessions SET draft_json = ?, updated_at = ? WHERE id = ?')
      .run(draft_json, Date.now(), id);
  }

  updateSession(id, fields) {
    const entries = Object.entries(fields);
    const set = entries.map(([k]) => `${k} = ?`).join(', ');
    const vals = entries.map(([, v]) => v);
    this.db.prepare(`UPDATE sessions SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...vals, Date.now(), id);
  }

  setCellGroup(sessionId, name, cells) {
    this.db.prepare(`
      INSERT OR REPLACE INTO cell_groups (session_id, name, cells) VALUES (?, ?, ?)
    `).run(sessionId, name, JSON.stringify(cells));
  }

  deleteCellGroup(sessionId, name) {
    this.db.prepare('DELETE FROM cell_groups WHERE session_id = ? AND name = ?').run(sessionId, name);
  }

  getCellGroups(sessionId) {
    const rows = this.db.prepare('SELECT name, cells FROM cell_groups WHERE session_id = ?').all(sessionId);
    return Object.fromEntries(rows.map(r => [r.name, JSON.parse(r.cells)]));
  }

  setShapeGroup(sessionId, cell, name, shapes) {
    this.db.prepare(`
      INSERT OR REPLACE INTO shape_groups (session_id, cell, name, shapes) VALUES (?, ?, ?, ?)
    `).run(sessionId, cell, name, JSON.stringify(shapes));
  }

  deleteShapeGroup(sessionId, cell, name) {
    this.db.prepare('DELETE FROM shape_groups WHERE session_id = ? AND cell = ? AND name = ?')
      .run(sessionId, cell, name);
  }

  getShapeGroups(sessionId, cell) {
    const rows = this.db.prepare('SELECT name, shapes FROM shape_groups WHERE session_id = ? AND cell = ?')
      .all(sessionId, cell);
    return Object.fromEntries(rows.map(r => [r.name, JSON.parse(r.shapes)]));
  }

  getAllShapeGroups(sessionId) {
    const rows = this.db.prepare('SELECT cell, name, shapes FROM shape_groups WHERE session_id = ?').all(sessionId);
    const result = {};
    for (const r of rows) {
      if (!result[r.cell]) result[r.cell] = {};
      result[r.cell][r.name] = JSON.parse(r.shapes);
    }
    return result;
  }

  close() { this.db.close(); }
}
