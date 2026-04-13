/**
 * Animation preview — cycles through group cells at configurable FPS,
 * with onion skin overlay for editing context.
 */

const DEFAULT_PREVIEW_SIZE = 128;
const DEFAULT_FPS = 8;

export class AnimationPreview {
  constructor(opts = {}) {
    this._canvas = null;
    this._ctx = null;
    this._container = null;

    this._cells = {};
    this._cellSize = 16;
    this._palette = {};
    this._frames = [];
    this._currentFrame = 0;
    this._fps = DEFAULT_FPS;
    this._playing = false;
    this._intervalId = null;

    this._onionSkin = false;
    this._activeCell = null;

    this._onionCb = null;

    this._mountId = opts.mountId ?? 'anim-panel';
    this._size = opts.size ?? DEFAULT_this._size;
    this._showOnionSkin = opts.showOnionSkin ?? true;
    this._responsive = opts.responsive ?? false;
    this._title = opts.title ?? 'Animation';
  }

  init() {
    this._container = this._createUI();
    const mount = document.getElementById(this._mountId);
    if (!mount) return;
    mount.appendChild(this._container);
    if (this._responsive) this._attachResize();
  }

  /** Resize the canvas to fit the current mount (when responsive). */
  fitToMount() {
    if (!this._canvas) return;
    const mount = document.getElementById(this._mountId);
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const reserved = 80; // rough space for controls + header
    const available = Math.max(64, Math.min(rect.width, rect.height - reserved));
    // Snap to integer multiple of cellSize so pixels stay crisp.
    const target = Math.max(this._cellSize, Math.floor(available / this._cellSize) * this._cellSize);
    if (target !== this._size) {
      this._size = target;
      this._canvas.width = target;
      this._canvas.height = target;
      this._canvas.style.width = `${target}px`;
      this._canvas.style.height = `${target}px`;
      this._renderFrame();
    }
  }

  _attachResize() {
    const ro = new ResizeObserver(() => this.fitToMount());
    const mount = document.getElementById(this._mountId);
    if (mount) ro.observe(mount);
    // Initial fit once layout settles.
    requestAnimationFrame(() => this.fitToMount());
  }

  setPalette(paletteMap) { this._palette = paletteMap; }
  setCellSize(size) { this._cellSize = size; }
  setCells(cells) { this._cells = cells || {}; }
  setActiveCell(ref) { this._activeCell = ref; }
  onOnionSkin(cb) { this._onionCb = cb; }

  /**
   * Set the group's cell refs to animate.
   * @param {string[]} frames - Array of cell ref strings
   */
  setFrames(frames) {
    this._frames = frames || [];
    this._currentFrame = 0;
    this._updateFrameCounter();
    this._renderFrame();
    this._container.classList.toggle('has-frames', this._frames.length > 0);
  }

  /* -- Playback controls -- */

  play() {
    if (this._frames.length === 0) return;
    this._playing = true;
    this._updatePlayState();
    this._startInterval();
  }

  pause() {
    this._playing = false;
    this._updatePlayState();
    this._stopInterval();
  }

  stop() {
    this._playing = false;
    this._currentFrame = 0;
    this._updatePlayState();
    this._stopInterval();
    this._updateFrameCounter();
    this._renderFrame();
  }

  /* -- Onion skin -- */

  /**
   * Get onion skin data for the editor overlay.
   * Returns { prev, next } where each is an array of shapes at 30% opacity,
   * or null if onion skin is off or cell isn't in the current group.
   */
  getOnionSkinData() {
    if (!this._onionSkin || this._frames.length < 2) return null;
    const idx = this._frames.indexOf(this._activeCell);
    if (idx === -1) return null;

    const prevRef = idx > 0 ? this._frames[idx - 1] : this._frames[this._frames.length - 1];
    const nextRef = idx < this._frames.length - 1 ? this._frames[idx + 1] : this._frames[0];

    return {
      prev: this._getCellShapes(prevRef),
      next: this._getCellShapes(nextRef),
    };
  }

  _getCellShapes(ref) {
    const cell = this._cells[ref];
    if (!cell || !cell.shapes) return [];
    return cell.shapes.filter(s => s.visible !== false);
  }

  /* -- Internal: UI creation -- */

  _createUI() {
    const container = document.createElement('div');
    container.id = 'animation-preview';

    const header = document.createElement('div');
    header.className = 'anim-header';
    header.textContent = this._title;
    container.appendChild(header);

    this._canvas = document.createElement('canvas');
    this._canvas.width = this._size;
    this._canvas.height = this._size;
    this._canvas.className = 'anim-canvas';
    this._ctx = this._canvas.getContext('2d');
    container.appendChild(this._canvas);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'anim-controls';

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.className = 'anim-btn anim-play';
    playBtn.addEventListener('click', () => this._playing ? this.pause() : this.play());
    controls.appendChild(playBtn);
    this._playBtn = playBtn;

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.className = 'anim-btn';
    stopBtn.addEventListener('click', () => this.stop());
    controls.appendChild(stopBtn);

    container.appendChild(controls);

    // Frame counter
    const frameInfo = document.createElement('div');
    frameInfo.className = 'anim-frame-info';
    frameInfo.textContent = '— / —';
    container.appendChild(frameInfo);
    this._frameInfo = frameInfo;

    // FPS slider
    const fpsRow = document.createElement('div');
    fpsRow.className = 'anim-fps-row';

    const fpsLabel = document.createElement('span');
    fpsLabel.className = 'anim-fps-label';
    fpsLabel.textContent = `${this._fps} FPS`;
    this._fpsLabel = fpsLabel;

    const fpsSlider = document.createElement('input');
    fpsSlider.type = 'range';
    fpsSlider.min = '1';
    fpsSlider.max = '30';
    fpsSlider.value = String(this._fps);
    fpsSlider.className = 'anim-fps-slider';
    fpsSlider.addEventListener('input', () => {
      this._fps = parseInt(fpsSlider.value, 10);
      this._fpsLabel.textContent = `${this._fps} FPS`;
      if (this._playing) {
        this._stopInterval();
        this._startInterval();
      }
    });

    fpsRow.appendChild(fpsLabel);
    fpsRow.appendChild(fpsSlider);
    container.appendChild(fpsRow);

    // Onion skin toggle (optional)
    if (!this._showOnionSkin) return container;
    const onionRow = document.createElement('div');
    onionRow.className = 'anim-onion-row';

    const onionCheck = document.createElement('input');
    onionCheck.type = 'checkbox';
    onionCheck.id = 'onion-skin-toggle';
    onionCheck.addEventListener('change', () => {
      this._onionSkin = onionCheck.checked;
      if (this._onionCb) this._onionCb(this.getOnionSkinData());
    });

    const onionLabel = document.createElement('label');
    onionLabel.htmlFor = 'onion-skin-toggle';
    onionLabel.textContent = 'Onion Skin';

    onionRow.appendChild(onionCheck);
    onionRow.appendChild(onionLabel);
    container.appendChild(onionRow);

    return container;
  }

  /* -- Internal: rendering -- */

  _renderFrame() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._size, this._size);

    // Checkerboard background — one square per pixel, matching the cell grid
    const style = getComputedStyle(document.documentElement);
    const colorA = style.getPropertyValue('--checker-a').trim();
    const colorB = style.getPropertyValue('--checker-b').trim();
    const tileSize = this._size / this._cellSize;
    for (let row = 0; row < this._cellSize; row++) {
      for (let col = 0; col < this._cellSize; col++) {
        ctx.fillStyle = ((row + col) % 2 === 0) ? colorA : colorB;
        ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    if (this._frames.length === 0) return;

    const ref = this._frames[this._currentFrame];
    const shapes = this._getCellShapes(ref);
    const scale = this._size / this._cellSize;

    for (const shape of shapes) {
      ctx.fillStyle = this._resolveColor(shape.color);
      const p = shape.params;

      switch (shape.type) {
        case 'point':
          ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
          break;
        case 'line':
          this._drawLine(ctx, scale, p.x1, p.y1, p.x2, p.y2);
          break;
        case 'rect':
          if (p.filled) {
            ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
          } else {
            ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, scale);
            ctx.fillRect(p.x * scale, (p.y + p.h - 1) * scale, p.w * scale, scale);
            ctx.fillRect(p.x * scale, p.y * scale, scale, p.h * scale);
            ctx.fillRect((p.x + p.w - 1) * scale, p.y * scale, scale, p.h * scale);
          }
          break;
        case 'circle':
          if (p.filled) {
            for (let y = -p.r; y <= p.r; y++) {
              for (let x = -p.r; x <= p.r; x++) {
                if (x * x + y * y <= p.r * p.r) {
                  ctx.fillRect((p.cx + x) * scale, (p.cy + y) * scale, scale, scale);
                }
              }
            }
          }
          break;
        case 'ellipse':
          if (p.filled) {
            for (let y = -p.ry; y <= p.ry; y++) {
              for (let x = -p.rx; x <= p.rx; x++) {
                if ((x * x) / (p.rx * p.rx) + (y * y) / (p.ry * p.ry) <= 1) {
                  ctx.fillRect((p.cx + x) * scale, (p.cy + y) * scale, scale, scale);
                }
              }
            }
          }
          break;
      }
    }
  }

  _drawLine(ctx, scale, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      ctx.fillRect(x * scale, y * scale, scale, scale);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  _resolveColor(ref) {
    if (!ref) return '#ff00ff';
    if (ref.startsWith('#')) return ref;
    return this._palette[ref] || '#ff00ff';
  }

  /* -- Internal: playback -- */

  _startInterval() {
    this._stopInterval();
    this._intervalId = setInterval(() => {
      this._currentFrame = (this._currentFrame + 1) % this._frames.length;
      this._updateFrameCounter();
      this._renderFrame();
    }, 1000 / this._fps);
  }

  _stopInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _updatePlayState() {
    if (this._playBtn) {
      this._playBtn.textContent = this._playing ? 'Pause' : 'Play';
    }
  }

  _updateFrameCounter() {
    if (this._frameInfo) {
      if (this._frames.length === 0) {
        this._frameInfo.textContent = '— / —';
      } else {
        this._frameInfo.textContent = `${this._currentFrame + 1} / ${this._frames.length}`;
      }
    }
  }
}
