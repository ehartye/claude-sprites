import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { CanvasRenderer } from '../engine/canvas-renderer.js';

function getRenderer(state) {
  return new CanvasRenderer(state.project.palette, { background: state.project.background });
}

function tmpPath(tmpDir, name) {
  fs.mkdirSync(tmpDir, { recursive: true });
  return path.join(tmpDir, `${name}-${Date.now()}.png`);
}

export function handleViewCell(state, params, tmpDir) {
  if (!state.project) throw new Error('No project open');
  const cell = state.project.cells.getCell(params.cell);
  const renderer = getRenderer(state);
  const buf = renderer.renderCell(cell);
  const p = tmpPath(tmpDir, `cell-${params.cell.replace(',', '-')}`);
  fs.writeFileSync(p, buf);
  return { path: p };
}

export function handleViewCells(state, params, tmpDir) {
  if (!state.project) throw new Error('No project open');
  const cells = params.cells.map((ref) => state.project.cells.getCell(ref));
  const renderer = getRenderer(state);
  const buf = renderer.renderCells(cells);
  const p = tmpPath(tmpDir, 'cells');
  fs.writeFileSync(p, buf);
  return { path: p };
}

export function handleViewSheet(state, params, tmpDir) {
  if (!state.project) throw new Error('No project open');
  const renderer = getRenderer(state);
  const buf = renderer.renderSheet(state.project.cells);
  const p = tmpPath(tmpDir, 'sheet');
  fs.writeFileSync(p, buf);
  return { path: p };
}

export function handleExportPng(state, params) {
  if (!state.project) throw new Error('No project open');
  const renderer = getRenderer(state);
  let buf;
  if (params.target === 'sheet') {
    buf = renderer.renderSheet(state.project.cells);
  } else if (params.target.includes(',')) {
    const cell = state.project.cells.getCell(params.target);
    buf = renderer.renderCell(cell);
  } else {
    const cellRefs = state.project.groups.get(params.target);
    if (!cellRefs) throw new Error(`Unknown target: ${params.target}`);
    const cells = cellRefs.map((ref) => state.project.cells.getCell(ref));
    buf = renderer.renderCells(cells);
  }
  fs.writeFileSync(params.path, buf);
  return { path: params.path };
}

export function handleExportJson(state, params) {
  if (!state.project) throw new Error('No project open');
  const atlas = state.project.exportAtlas();
  fs.writeFileSync(params.path, JSON.stringify(atlas, null, 2));
  return { path: params.path };
}

export function registerViewTools(server, state) {
  const tmpDir = path.join(process.cwd(), '.tmp');

  server.tool('sprite_view_cell', 'Render a cell as PNG for viewing', {
    cell: z.string().describe('Cell ref (e.g. "0,0" or name)'),
  }, (params) => {
    const result = handleViewCell(state, params, tmpDir);
    return {
      content: [{
        type: 'image',
        data: fs.readFileSync(result.path).toString('base64'),
        mimeType: 'image/png',
      }],
    };
  });

  server.tool('sprite_view_cells', 'Render multiple cells side by side as PNG', {
    cells: z.array(z.string()).describe('Array of cell refs'),
  }, (params) => {
    const result = handleViewCells(state, params, tmpDir);
    return {
      content: [{
        type: 'image',
        data: fs.readFileSync(result.path).toString('base64'),
        mimeType: 'image/png',
      }],
    };
  });

  server.tool('sprite_view_sheet', 'Render the full sprite sheet as PNG', {}, () => {
    const result = handleViewSheet(state, {}, tmpDir);
    return {
      content: [{
        type: 'image',
        data: fs.readFileSync(result.path).toString('base64'),
        mimeType: 'image/png',
      }],
    };
  });

  server.tool('sprite_export_png', 'Export cell, group, or sheet to a PNG file', {
    target: z.string().describe('"sheet", cell ref, or group name'),
    path: z.string().describe('Output file path'),
  }, (params) => {
    handleExportPng(state, params);
    return { content: [{ type: 'text', text: `Exported to ${params.path}` }] };
  });

  server.tool('sprite_export_json', 'Export texture atlas metadata as JSON', {
    path: z.string().describe('Output file path'),
  }, (params) => {
    handleExportJson(state, params);
    return { content: [{ type: 'text', text: `Atlas exported to ${params.path}` }] };
  });
}
