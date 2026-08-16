// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CellNavigator } from '../../server/web/public/js/cell-nav.js';

describe('CellNavigator (browser)', () => {
  let nav;
  let onSelect;

  beforeEach(() => {
    document.body.innerHTML = '<div id="cell-strip"></div>';
    nav = new CellNavigator();
    onSelect = vi.fn();
    nav.init({ onSelect });
    nav.setPalette({});
  });

  it('renders one thumbnail per grid cell with the cell aspect ratio', () => {
    nav.setGrid(1, 2, 16, 32);
    nav.setCells({});
    nav.render();
    const canvases = document.querySelectorAll('.cell-thumb-canvas');
    expect(canvases).toHaveLength(2);
    expect(canvases[0].width).toBe(48);
    expect(canvases[0].height).toBe(96); // 48 * (32/16)
  });

  it('paints shape pixels into the thumbnail', () => {
    nav.setGrid(1, 1, 16, 16);
    nav.setCells({ '0,0': { shapes: [{ type: 'rect', params: { x: 0, y: 0, w: 4, h: 4, filled: true }, color: '#00ff00', zIndex: 0 }] } });
    nav.render();
    const ctx = document.querySelector('.cell-thumb-canvas').getContext('2d');
    const d = ctx.getImageData(1, 1, 1, 1).data; // inside the 4px rect at scale 3
    expect([d[0], d[1], d[2]]).toEqual([0, 255, 0]);
  });

  it('renders polygons in thumbnails', () => {
    nav.setGrid(1, 1, 16, 16);
    nav.setCells({ '0,0': { shapes: [{ type: 'polygon', params: { points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }], filled: true }, color: '#ff0000', zIndex: 0 }] } });
    nav.render();
    const ctx = document.querySelector('.cell-thumb-canvas').getContext('2d');
    const d = ctx.getImageData(2 * 3, 2 * 3, 1, 1).data; // interior pixel (2,2), scale 3
    expect(d[0]).toBe(255);
  });

  it('clicking a thumbnail selects that cell', () => {
    nav.setGrid(1, 2, 16, 16);
    nav.setCells({});
    nav.render();
    const thumbs = document.querySelectorAll('.cell-thumb');
    thumbs[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('0,1');
  });

  it('filters thumbnails to a group', () => {
    nav.setGrid(2, 2, 16, 16);
    nav.setCells({});
    nav.setFilter(['0,0', '1,1']);
    const refs = [...document.querySelectorAll('.cell-thumb')].map(el => el.dataset.ref);
    expect(refs).toEqual(['0,0', '1,1']);
  });
});
