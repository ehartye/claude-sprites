/**
 * Panels — Shape list and Group manager panels for the right sidebar.
 */

export class ShapePanel {
  constructor() {
    this._shapes = [];
    this._selectedId = null;
    this._palette = {};

    this._selectCb = null;
    this._actionCb = null;
  }

  /**
   * @param {object} opts
   * @param {Function} opts.onSelect - Called with shape id when clicked
   * @param {Function} opts.onAction - Called with (action, shapeId) for rename/recolor/delete/z
   */
  init({ onSelect, onAction }) {
    this._selectCb = onSelect;
    this._actionCb = onAction;
    this._bindContextMenu();
  }

  setPalette(paletteMap) {
    this._palette = paletteMap;
  }

  setShapes(shapes) {
    this._shapes = shapes || [];
    this.render();
  }

  setSelected(shapeId) {
    this._selectedId = shapeId;
    this._updateSelection();
  }

  render() {
    const ul = document.getElementById('shape-items');
    ul.innerHTML = '';

    const sorted = [...this._shapes].sort((a, b) => a.zIndex - b.zIndex);

    for (const shape of sorted) {
      const li = document.createElement('li');
      li.dataset.shapeId = shape.id;
      if (shape.id === this._selectedId) li.classList.add('selected');

      const colorDot = document.createElement('span');
      colorDot.className = 'shape-color';
      colorDot.style.backgroundColor = this._resolveColor(shape.color);
      li.appendChild(colorDot);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shape-name';
      nameSpan.textContent = shape.name || `${shape.type} (${shape.id})`;
      li.appendChild(nameSpan);

      const zSpan = document.createElement('span');
      zSpan.className = 'shape-z';
      zSpan.textContent = `z${shape.zIndex}`;
      li.appendChild(zSpan);

      li.addEventListener('click', () => {
        this._selectedId = shape.id;
        this._updateSelection();
        if (this._selectCb) this._selectCb(shape.id);
      });

      ul.appendChild(li);
    }
  }

  _updateSelection() {
    document.querySelectorAll('#shape-items li').forEach((li) => {
      li.classList.toggle('selected', li.dataset.shapeId === this._selectedId);
    });
  }

  _resolveColor(ref) {
    if (!ref) return '#888';
    if (ref.startsWith('#')) return ref;
    return this._palette[ref] || '#888';
  }

  _bindContextMenu() {
    const ul = document.getElementById('shape-items');
    ul.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const li = e.target.closest('li[data-shape-id]');
      if (!li) return;
      const shapeId = li.dataset.shapeId;
      this._showContextMenu(e.clientX, e.clientY, shapeId);
    });
  }

  _showContextMenu(x, y, shapeId) {
    this._removeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const actions = [
      { label: 'Rename', action: 'rename' },
      { label: 'Recolor', action: 'recolor' },
      { label: 'Move Up', action: 'z_up' },
      { label: 'Move Down', action: 'z_down' },
      { label: 'Delete', action: 'delete' },
    ];

    for (const { label, action } of actions) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.textContent = label;
      item.addEventListener('click', () => {
        this._removeContextMenu();
        if (this._actionCb) this._actionCb(action, shapeId);
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);

    const dismiss = (e) => {
      if (!menu.contains(e.target)) {
        this._removeContextMenu();
        document.removeEventListener('mousedown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
  }

  _removeContextMenu() {
    document.querySelectorAll('.context-menu').forEach((el) => el.remove());
  }
}

export class GroupPanel {
  constructor() {
    this._groups = {};
    this._activeGroup = null;

    this._selectCb = null;
    this._createCb = null;
    this._deleteCb = null;
  }

  /**
   * @param {object} opts
   * @param {Function} opts.onSelect - Called with group name or null (all)
   * @param {Function} opts.onCreate - Called when create button clicked
   * @param {Function} opts.onDelete - Called with group name
   */
  init({ onSelect, onCreate, onDelete }) {
    this._selectCb = onSelect;
    this._createCb = onCreate;
    this._deleteCb = onDelete;
  }

  setGroups(groups) {
    this._groups = groups || {};
    this.render();
  }

  get activeGroup() { return this._activeGroup; }

  render() {
    const ul = document.getElementById('group-items');
    ul.innerHTML = '';
    // Remove any previous create button
    ul.parentElement.querySelectorAll('.group-create-btn').forEach(el => el.remove());

    // "All" option
    const allLi = document.createElement('li');
    allLi.textContent = 'All Cells';
    if (!this._activeGroup) allLi.classList.add('active');
    allLi.addEventListener('click', () => this._select(null));
    ul.appendChild(allLi);

    for (const [name, cells] of Object.entries(this._groups)) {
      const li = document.createElement('li');
      li.dataset.group = name;
      if (name === this._activeGroup) li.classList.add('active');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${name} (${cells.length})`;
      li.appendChild(nameSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'group-delete-btn';
      delBtn.textContent = 'x';
      delBtn.title = 'Delete group';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._deleteCb) this._deleteCb(name);
      });
      li.appendChild(delBtn);

      li.addEventListener('click', () => this._select(name));
      ul.appendChild(li);
    }

    // Create button
    const createBtn = document.createElement('button');
    createBtn.className = 'group-create-btn';
    createBtn.textContent = '+ New Group';
    createBtn.addEventListener('click', () => {
      if (this._createCb) this._createCb();
    });
    ul.parentElement.appendChild(createBtn);
  }

  _select(name) {
    this._activeGroup = name;
    document.querySelectorAll('#group-items li').forEach((li) => {
      const isAll = !li.dataset.group;
      li.classList.toggle('active', isAll ? !name : li.dataset.group === name);
    });
    if (this._selectCb) this._selectCb(name);
  }
}
