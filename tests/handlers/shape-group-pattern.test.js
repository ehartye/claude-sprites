import { describe, it, expect } from 'vitest';
import express from 'express';
import { groupRoutes } from '../../server/web/api/group-routes.js';
import { Project } from '../../server/engine/project.js';

function mkState() {
  const project = Project.create({ name: 't', cellSize: 16, rows: 1, cols: 2, palette: null });
  for (const ref of ['0,0', '0,1']) {
    const cell = project.cells.getCell(ref);
    cell.draw('point', { x: 0, y: 0 }, '#ffffff', 'seam_h');
    cell.draw('point', { x: 1, y: 1 }, '#ffffff', 'seam_v');
    cell.draw('point', { x: 2, y: 2 }, '#ffffff', 'ball');
  }
  const db = {
    _groups: new Map(), // key: `${sess}|${cell}|${name}` -> shapes[]
    setShapeGroup(sess, cell, name, shapes) {
      db._groups.set(`${sess}|${cell}|${name}`, shapes);
    },
    getShapeGroups(sess, cell) {
      const out = {};
      for (const [k, v] of db._groups) {
        const [s, c, n] = k.split('|');
        if (s === sess && c === cell) out[n] = v;
      }
      return out;
    },
    setCellGroup() {},
    getCellGroups() { return {}; },
  };
  return { project, sessionId: 'sess1', db };
}

async function request(app, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  } finally {
    server.close();
  }
}

describe('shape-group create --all-cells --pattern', () => {
  it('creates a group per cell containing only shapes matching the pattern', async () => {
    const state = mkState();
    const app = express();
    app.use(express.json());
    app.use('/api', groupRoutes(state));

    const body = await request(app, '/api/group/shape/create', {
      name: 'seams', all_cells: true, pattern: '^seam_',
    });
    expect(body.ok).toBe(true);

    for (const ref of ['0,0', '0,1']) {
      const groups = state.db.getShapeGroups('sess1', ref);
      expect(groups.seams).toBeDefined();
      expect(groups.seams.sort()).toEqual(['seam_h', 'seam_v']);
    }
  });

  it('rejects invalid regex pattern', async () => {
    const state = mkState();
    const app = express();
    app.use(express.json());
    app.use('/api', groupRoutes(state));

    const body = await request(app, '/api/group/shape/create', {
      name: 'bad', all_cells: true, pattern: '[invalid(',
    });
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/pattern|regex/i);
  });
});
