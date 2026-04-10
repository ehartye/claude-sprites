import { CanvasRenderer } from './canvas-renderer.js';

const RESET = '\x1b[0m';
const DIM_GREY = '\x1b[38;2;80;80;80m';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function colorBlock(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m██${RESET}`;
}

function transparentBlock() {
  return `${DIM_GREY}· ${RESET}`;
}

function hexDigit(n) {
  return n.toString(16).toUpperCase();
}

export class TerminalRenderer {
  constructor(palette) {
    this.palette = palette;
    this._canvasRenderer = new CanvasRenderer(palette);
  }

  renderCell(cell) {
    const size = cell.size;
    const imgData = this._canvasRenderer.renderCellRaw(cell);
    const shapes = cell.shapes.listByZ();

    const lines = [];

    // Column header
    const headerParts = ['  '];
    if (size <= 16) {
      for (let c = 0; c < size; c++) {
        headerParts.push(` ${hexDigit(c)}`);
      }
    } else {
      for (let c = 0; c < size; c++) {
        if (c % 4 === 0) {
          const label = hexDigit(c);
          headerParts.push(label.length === 1 ? ` ${label}` : label);
        } else {
          headerParts.push('  ');
        }
      }
    }
    lines.push(headerParts.join(''));

    // Pixel rows
    for (let y = 0; y < size; y++) {
      const rowLabel = size <= 16 ? hexDigit(y) : hexDigit(y).padStart(2, '0');
      const parts = [rowLabel + ' '];
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const a = imgData[idx + 3];
        if (a === 0) {
          parts.push(transparentBlock());
        } else {
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          parts.push(colorBlock(hex));
        }
      }
      lines.push(parts.join(''));
    }

    // Legend: group shapes by resolved color
    if (shapes.length > 0) {
      lines.push('');
      const colorGroups = new Map();
      for (const shape of shapes) {
        const resolvedColor = this.palette.resolve(shape.color);
        const label = shape.name ?? shape.id;
        if (!colorGroups.has(resolvedColor)) {
          colorGroups.set(resolvedColor, []);
        }
        colorGroups.get(resolvedColor).push(label);
      }
      for (const [hex, names] of colorGroups) {
        lines.push(`  ${colorBlock(hex)} ${hex} ${names.join(', ')}`);
      }
    }

    return lines.join('\n');
  }
}
