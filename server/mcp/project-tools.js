import { z } from 'zod';
import { Project } from '../engine/project.js';
import { Palette } from '../engine/palette.js';

export function handleNewProject(state, params) {
  state.project = Project.create({
    name: params.name,
    cellSize: params.cell_size,
    rows: params.grid_rows,
    cols: params.grid_cols,
    palette: params.palette,
  });
  state.broadcast?.({ type: 'project', data: state.project.toJSON() });
  return { name: params.name };
}

export function handleOpenProject(state, params) {
  state.project = Project.load(params.path);
  state.broadcast?.({ type: 'project', data: state.project.toJSON() });
  return { name: state.project.name };
}

export function handleSaveProject(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.save(params.path);
  return { path: state.project.path };
}

export function handleSetPalette(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.palette = new Palette(params.colors);
  state.broadcast?.({ type: 'palette', data: state.project.palette.toJSON() });
  return { count: params.colors.length };
}

export function handleLoadPalette(state, params) {
  if (!state.project) throw new Error('No project open');
  state.project.palette = Palette.fromPreset(params.preset);
  state.broadcast?.({ type: 'palette', data: state.project.palette.toJSON() });
  return { preset: params.preset, count: state.project.palette.list().length };
}

export function registerProjectTools(server, state) {
  server.tool('sprite_new_project', 'Create a new sprite sheet project', {
    name: z.string().describe('Project name'),
    cell_size: z.number().describe('Pixel size per cell (16 or 32)'),
    grid_rows: z.number().describe('Number of rows (1-10)'),
    grid_cols: z.number().describe('Number of columns (1-10)'),
    palette: z.string().optional().describe('Optional preset: pico8, gameboy, nes'),
  }, (params) => {
    const result = handleNewProject(state, params);
    return { content: [{ type: 'text', text: `Created project "${result.name}" (${params.cell_size}px, ${params.grid_rows}x${params.grid_cols})` }] };
  });

  server.tool('sprite_open_project', 'Load a .sprites project file', {
    path: z.string().describe('Path to .sprites file'),
  }, (params) => {
    const result = handleOpenProject(state, params);
    return { content: [{ type: 'text', text: `Opened "${result.name}"` }] };
  });

  server.tool('sprite_save_project', 'Save the current project', {
    path: z.string().optional().describe('File path (optional if previously saved)'),
  }, (params) => {
    const result = handleSaveProject(state, params);
    return { content: [{ type: 'text', text: `Saved to ${result.path}` }] };
  });

  server.tool('sprite_set_palette', 'Set project palette colors', {
    colors: z.array(z.object({ name: z.string(), color: z.string() })).describe('Array of {name, color} objects'),
  }, (params) => {
    const result = handleSetPalette(state, params);
    return { content: [{ type: 'text', text: `Palette set with ${result.count} colors` }] };
  });

  server.tool('sprite_load_palette', 'Load a built-in palette preset', {
    preset: z.string().describe('Preset name: pico8, gameboy, nes'),
  }, (params) => {
    const result = handleLoadPalette(state, params);
    return { content: [{ type: 'text', text: `Loaded ${result.preset} palette (${result.count} colors)` }] };
  });
}
