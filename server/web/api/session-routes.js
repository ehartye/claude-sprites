import { Router } from 'express';
import { Project } from '../../engine/project.js';
import { CanvasRenderer } from '../../engine/canvas-renderer.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export function sessionRoutes(state) {
  const r = Router();

  r.get('/status', (_req, res) => {
    const session = state.db.getLastSession();
    if (!session) return res.json({ ok: true, data: { active: false } });
    res.json({ ok: true, data: {
      active: true,
      project_name: session.project_name,
      project_path: session.project_path,
      destination_folder: session.destination_folder,
      json_file: session.json_file,
      session_id: session.id,
    }});
  });

  r.post('/new', (req, res) => {
    try {
      const { name, size = 16, rows = 4, cols = 4, palette = 'pico8' } = req.body;
      if (!name) return res.json({ ok: false, error: 'name required' });
      const project_path = process.cwd();
      const destination_folder = join(project_path, 'assets', 'claude-sprites', name);
      const project = Project.create({ name, cellSize: size, rows, cols, palette });
      state.project = project;
      const draft_json = JSON.stringify(project.toJSON());
      const session = state.db.createSession({ project_name: name, project_path, destination_folder, json_file: null, draft_json });
      state.sessionId = session.id;
      state.broadcast?.({ type: 'project', data: project.toJSON() });
      res.json({ ok: true, data: `Created "${name}" (${size}px ${rows}x${cols})` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/open', (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) return res.json({ ok: false, error: 'path required' });
      const project = Project.load(filePath);
      state.project = project;
      const name = project.name;
      const project_path = process.cwd();
      const destination_folder = join(project_path, 'assets', 'claude-sprites', name);
      const draft_json = JSON.stringify(project.toJSON());
      const session = state.db.createSession({ project_name: name, project_path, destination_folder, json_file: filePath, draft_json });
      state.sessionId = session.id;
      state.broadcast?.({ type: 'project', data: project.toJSON() });
      res.json({ ok: true, data: `Opened "${name}" from ${filePath}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/save', (req, res) => {
    try {
      if (!state.project) return res.json({ ok: false, error: 'No active project' });
      const session = state.db.getSession(state.sessionId);
      let target = session?.json_file;
      if (!target) {
        mkdirSync(session.destination_folder, { recursive: true });
        target = join(session.destination_folder, `${session.project_name}.json`);
        state.db.updateSession(state.sessionId, { json_file: target });
      }
      writeFileSync(target, JSON.stringify(state.project.toJSON(), null, 2));
      res.json({ ok: true, data: `Saved to ${target}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  r.post('/export', (req, res) => {
    try {
      if (!state.project) return res.json({ ok: false, error: 'No active project' });
      const session = state.db.getSession(state.sessionId);
      const dest = session.destination_folder;
      const renderer = new CanvasRenderer(state.project.palette, { background: state.project.background });
      const png = renderer.renderSheet(state.project.cells);
      mkdirSync(dest, { recursive: true });
      const pngPath = join(dest, `${session.project_name}.png`);
      const jsonPath = join(dest, `${session.project_name}.json`);
      writeFileSync(pngPath, png);
      writeFileSync(jsonPath, JSON.stringify(state.project.toJSON(), null, 2));
      res.json({ ok: true, data: `Exported to ${dest}` });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  return r;
}
