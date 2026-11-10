// CO-PARK bölüm editörü.
// 2D ızgaralı tuvalde hassas düzenleme; "Dene" ile aynı bölüm gerçek 3D oyunda açılır.
import { TYPES, PALETTE_ORDER, THEMES, makeObject, newDoc, toLevel, fromLevel, bounds, docHash } from '../levelmodel.js';
import { validate, hasErrors, PHYS } from '../validate.js';
import { sanitizeLevel } from '../share.js';
import { LEVELS } from '../levels.js';
import { drafts } from './store.js';
import { PLAYER_COLORS } from '../config.js';

const Z = { solid: 0, platform: 1, spike: 2, bridge: 3, plate: 4, gate: 5, colorgate: 5, mover: 6, lift: 6, block: 7, door: 8, key: 9, spawn: 9 };
const SURFACES = new Set(['solid', 'platform', 'block', 'mover', 'lift', 'bridge']);
const REQ_OPTS = [['all', 'Herkes'], ['half', 'Yarısı'], ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, `${n} kişi`])];
const BG = { park: '#1d2620', workshop: '#24221e', construction: '#28221f', winter: '#1f2630' };
const MIN = 0.3;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');
const parseNum = (v) => parseFloat(String(v).replace(',', '.'));
const reqText = (r) => (r === 'all' ? 'Herkes' : r === 'half' ? 'Yarısı' : `${r}`);

export class Editor {
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;   // { onPlay(level, ctx), onExit(), toast(msg), isUnlocked(i), shareUrl(level) }
    this.doc = null;
    this.draftId = null;
    this.verified = null;
    this.sel = null;
    this.tool = 'select';
    this.linking = false;
    this.undoStack = []; this.redoStack = [];
    this.view = { cx: 20, cy: 3, scale: 30 };
    this.drag = null;
    this.hover = null;
    this.mouse = { x: 0, y: 0, in: false };
    this.issues = [];
    this.build();
  }

  // ------------------------------------------------------------ arayüz
  build() {
    const r = this.root;
    r.innerHTML = `
      <div class="ed-top">
        <button data-ed="exit" title="Lobiye dön">← Lobi</button>
        <select data-ed="drafts" title="Bölümlerim"></select>
        <button data-ed="new">Yeni</button>
        <select data-ed="copy" title="Resmi bir bölümü kopyalayıp düzenleyin"></select>
        <span class="ed-sep"></span>
        <button data-ed="undo" title="Geri al (Ctrl+Z)">↶ Geri al</button>
        <button data-ed="redo" title="Yinele (Ctrl+Y)">↷ Yinele</button>
        <span class="ed-flex"></span>
        <span class="ed-verified"></span>
        <button data-ed="import">İçe aktar</button>
        <button data-ed="export">Dışa aktar</button>
        <button data-ed="share">Bağlantıyla paylaş</button>
        <button data-ed="play" class="ed-play" title="Bölümü 3D olarak oyna (Enter)">▶ Dene</button>
        <input type="file" accept=".json,application/json" data-ed="file" hidden />
      </div>
      <div class="ed-main">
        <div class="ed-palette"></div>
        <div class="ed-stage"><canvas></canvas><div class="ed-tip"></div></div>
        <div class="ed-inspector"></div>
      </div>
      <div class="ed-status"><div class="ed-issues"></div><div class="ed-coords"></div></div>
      <div class="ed-dialog hidden"><div class="ed-dialog-box"></div></div>`;
    this.$ = (s) => r.querySelector(s);
    this.canvas = this.$('canvas');
    this.ctx = this.canvas.getContext('2d');

    const pal = this.$('.ed-palette');
    pal.innerHTML = `<div class="ed-h">Araçlar</div><button class="ed-tool" data-tool="select"><span class="sw" style="background:#ddd"></span>Seç ve taşı <kbd>V</kbd></button>
      <div class="ed-h">Nesneler</div>` + PALETTE_ORDER.map((t) =>
      `<button class="ed-tool" data-tool="${t}"><span class="sw" style="background:${TYPES[t].color}"></span>${TYPES[t].label}</button>`).join('') +
      `<div class="ed-help">Sol tık: yerleştir / seç<br>Sürükle: taşı · kenarlar: boyut<br>Sağ tık veya boşluğu sürükle: kaydır<br>Tekerlek: yakınlaştır<br>Shift: ince ızgara (0,1)<br>Del: sil · Ctrl+D: çoğalt<br>Oklar: kaydır · Esc: bırak</div>`;
    pal.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) this.setTool(b.dataset.tool); });

    r.querySelector('.ed-top').addEventListener('click', (e) => this.topAction(e.target.closest('[data-ed]')?.dataset.ed));
    this.$('[data-ed=drafts]').addEventListener('change', (e) => { if (e.target.value) this.openDraft(e.target.value); });
    this.$('[data-ed=copy]').addEventListener('change', (e) => { const i = Number(e.target.value); e.target.value = ''; if (!Number.isNaN(i)) this.copyOfficial(i); });
    this.$('[data-ed=file]').addEventListener('change', (e) => this.importFile(e.target.files?.[0]));

    const ins = this.$('.ed-inspector');
    ins.addEventListener('change', (e) => this.inspectorChange(e.target));
    ins.addEventListener('click', (e) => this.inspectorClick(e.target.closest('[data-act]')));
    this.$('.ed-issues').addEventListener('click', (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (id) { this.select(id); this.focusOn(id); }
    });

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    c.addEventListener('mouseleave', () => { this.mouse.in = false; this.hover = null; this.requestRender(); });
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
    new ResizeObserver(() => this.resize()).observe(this.$('.ed-stage'));
  }

  // ------------------------------------------------------------ açma / kaydetme
  open(draftId) {
    this.root.classList.remove('hidden');
    this.isOpen = true;
    const list = drafts.list();
    const id = draftId || list[0]?.id;
    if (id && drafts.get(id)) this.openDraft(id);
    else this.newDraft();
    this.resize();
  }

  close() { this.isOpen = false; this.root.classList.add('hidden'); this.drag = null; }

  newDraft(doc = newDoc(), name) {
    if (name) doc.meta.name = name;
    this.draftId = drafts.newId();
    this.doc = doc;
    this.verified = null;
    this.undoStack = []; this.redoStack = [];
    this.save();
    this.afterLoad();
  }

  openDraft(id) {
    const d = drafts.get(id);
    if (!d) return;
    this.draftId = id;
    this.doc = d.doc;
    this.verified = d.verified || null;
    this.undoStack = []; this.redoStack = [];
    this.afterLoad();
  }

  afterLoad() {
    this.sel = null; this.linking = false; this.setTool('select');
    this.fitView();
    this.refreshTop();
    this.changed(false);
  }

  save() {
    if (!this.doc) return;
    const ok = drafts.save({ id: this.draftId, name: this.doc.meta.name, doc: this.doc, verified: this.verified });
    if (!ok && !this.warnedStorage) { this.warnedStorage = true; this.opts.toast('Tarayıcı depolaması kullanılamıyor: taslaklar yalnızca bu oturumda kalır. Dışa aktarmayı unutmayın.'); }
  }

  markVerified(draftId, hash) {
    const d = drafts.get(draftId);
    if (!d) return;
    if (docHash(d.doc) !== hash) return;
    d.verified = hash; drafts.save(d);
    if (draftId === this.draftId) { this.verified = hash; this.refreshTop(); }
  }

  get isVerified() { return this.verified && this.verified === docHash(this.doc); }

  refreshTop() {
    const sel = this.$('[data-ed=drafts]');
    sel.innerHTML = drafts.list().map((d) => `<option value="${d.id}" ${d.id === this.draftId ? 'selected' : ''}>${esc(d.name || 'Adsız')}</option>`).join('');
    const copy = this.$('[data-ed=copy]');
    copy.innerHTML = '<option value="">Resmi bölümü kopyala…</option>' + LEVELS.map((L, i) =>
      `<option value="${i}" ${this.opts.isUnlocked(i) ? '' : 'disabled'}>${i + 1}. ${esc(L.name)}${this.opts.isUnlocked(i) ? '' : ' (kilitli)'}</option>`).join('');
    const v = this.$('.ed-verified');
    const errs = hasErrors(this.issues);
    if (errs) { v.textContent = 'Hataları düzeltin'; v.className = 'ed-verified bad'; }
    else if (this.isVerified) { v.textContent = '✓ Bitirildi, paylaşılabilir'; v.className = 'ed-verified ok'; }
    else { v.textContent = 'Paylaşmak için önce 2+ oyuncuyla bitirin'; v.className = 'ed-verified'; }
    this.$('[data-ed=undo]').disabled = !this.undoStack.length;
    this.$('[data-ed=redo]').disabled = !this.redoStack.length;
  }

  // ------------------------------------------------------------ değişiklik ve geri alma
  begin() { this.before = JSON.stringify(this.doc); }
  commit() {
    if (this.before === undefined) return;
    const now = JSON.stringify(this.doc);
    if (now !== this.before) {
      this.undoStack.push(this.before);
      if (this.undoStack.length > 150) this.undoStack.shift();
      this.redoStack = [];
      this.changed();
    }
    this.before = undefined;
  }
  edit(fn) { this.begin(); fn(); this.commit(); }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.undoStack.pop());
    if (this.sel && !this.obj(this.sel)) this.sel = null;
    this.changed();
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.redoStack.pop());
    if (this.sel && !this.obj(this.sel)) this.sel = null;
    this.changed();
  }

  changed(persist = true) {
    this.issues = validate(this.doc);
    if (persist) { clearTimeout(this.saveT); this.saveT = setTimeout(() => { this.save(); this.refreshTop(); }, 300); }
    this.refreshTop();
    this.renderInspector();
    this.renderIssues();
    this.requestRender();
  }

  // ------------------------------------------------------------ yardımcılar
  obj(id) { return this.doc.objects.find((o) => o.id === id); }
  single(type) { return this.doc.objects.find((o) => o.type === type); }
  select(id) { this.sel = id; this.linking = false; this.renderInspector(); this.requestRender(); }

  setTool(t) {
    this.tool = t; this.linking = false;
    this.root.querySelectorAll('.ed-tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    this.tip(t === 'select' ? '' : TYPES[t].drag ? `${TYPES[t].label}: sürükleyerek çizin ya da tıklayın` : `${TYPES[t].label}: yerleştirmek için tıklayın`);
    this.requestRender();
  }
  tip(t) { this.$('.ed-tip').textContent = t; this.$('.ed-tip').classList.toggle('hidden', !t); }

  snapStep(e) { return e?.shiftKey ? 0.1 : 0.5; }
  snap(v, step) { return Math.round(Math.round(v / step) * step * 1000) / 1000; }

  toWorld(sx, sy) {
    const { cx, cy, scale } = this.view;
    return { x: (sx - this.W / 2) / scale + cx, y: (this.H / 2 - sy) / scale + cy };
  }
  toScreen(x, y) {
    const { cx, cy, scale } = this.view;
    return { x: (x - cx) * scale + this.W / 2, y: this.H / 2 - (y - cy) * scale };
  }
  evtPos(e) { const r = this.canvas.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }

  fitView() {
    if (!this.W) return;
    const w = this.doc.meta.width;
    this.view.scale = Math.max(8, Math.min(48, (this.W - 40) / Math.min(w, 44)));
    this.view.cx = Math.min(w, 44) / 2;
    this.view.cy = Math.max(3, this.H * 0.18 / this.view.scale);
  }
  focusOn(id) {
    const o = this.obj(id); if (!o) return;
    const b = bounds(o);
    this.view.cx = b.x + b.w / 2; this.view.cy = b.y + b.h / 2;
    this.requestRender();
  }

  // Yerleştirirken nesneyi altındaki yüzeye oturtur
  groundY(x, w, y) {
    let best = null;
    for (const o of this.doc.objects) {
      if (!SURFACES.has(o.type)) continue;
      const top = o.y + o.h;
      if (o.x < x + w && o.x + o.w > x && top <= y + 0.6 && (best === null || top > best)) best = top;
    }
    return best !== null && y - best < 2.5 ? best : null;
  }

  hitTest(wx, wy) {
    const list = [...this.doc.objects].sort((a, b) => (Z[b.type] ?? 0) - (Z[a.type] ?? 0));
    const pad = 4 / this.view.scale;
    for (const o of list) {
      const b = bounds(o);
      const thin = Math.max(0, 0.3 - b.h) / 2;
      if (wx >= b.x - pad && wx <= b.x + b.w + pad && wy >= b.y - pad - thin && wy <= b.y + b.h + pad + thin) return o;
    }
    return null;
  }

  handles(o) {
    if (!o) return [];
    const t = TYPES[o.type]; const b = bounds(o); const hs = [];
    const add = (id, x, y) => hs.push({ id, x, y });
    if (t?.kind === 'rect' && t.resize) {
      const mx = b.x + b.w / 2, my = b.y + b.h / 2;
      if (t.resize === true || t.resize === 'w') { add('e', b.x + b.w, my); add('w', b.x, my); }
      if (t.resize === true || t.resize === 'h') { add('n', mx, b.y + b.h); add('s', mx, b.y); }
      if (t.resize === true) { add('ne', b.x + b.w, b.y + b.h); add('nw', b.x, b.y + b.h); add('se', b.x + b.w, b.y); add('sw', b.x, b.y); }
    }
    if (o.type === 'mover' || o.type === 'lift') add('path', o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
    return hs;
  }

  // ------------------------------------------------------------ fare
  onDown(e) {
    if (!this.doc) return;
    const { sx, sy } = this.evtPos(e);
    const w = this.toWorld(sx, sy);
    if (e.button === 1 || e.button === 2) { this.drag = { kind: 'pan', sx, sy, cx: this.view.cx, cy: this.view.cy }; return; }
    const step = this.snapStep(e);

    if (this.linking) {
      const o = this.hitTest(w.x, w.y);
      const g = this.obj(this.sel);
      if (o && o.type === 'plate' && g) {
        this.edit(() => { const i = g.plates.indexOf(o.id); if (i >= 0) g.plates.splice(i, 1); else g.plates.push(o.id); });
        this.opts.toast(g.plates.includes(o.id) ? 'Plaka bağlandı.' : 'Plaka bağlantısı kaldırıldı.');
      } else { this.linking = false; this.tip(''); this.renderInspector(); }
      this.requestRender();
      return;
    }

    if (this.tool !== 'select') { this.place(this.tool, w, step, e); return; }

    // tutamaçlar
    const sel = this.obj(this.sel);
    for (const h of this.handles(sel)) {
      const p = this.toScreen(h.x, h.y);
      if (Math.abs(p.x - sx) <= 7 && Math.abs(p.y - sy) <= 7) {
        this.begin();
        this.drag = { kind: 'handle', h: h.id, o: sel, wx: w.x, wy: w.y, start: { ...sel } };
        return;
      }
    }
    const o = this.hitTest(w.x, w.y);
    if (o) {
      this.select(o.id);
      this.begin();
      this.drag = { kind: 'move', o, wx: w.x, wy: w.y, start: { x: o.x, y: o.y } };
    } else {
      this.sel = null; this.renderInspector();
      this.drag = { kind: 'pan', sx, sy, cx: this.view.cx, cy: this.view.cy };
    }
    this.requestRender();
  }

  place(type, w, step, e) {
    const t = TYPES[type];
    if (t.drag) {
      const x = this.snap(w.x, step), y = this.snap(w.y, step);
      this.begin();
      const o = makeObject(type, x, y, { w: 0.01, h: type === 'spike' ? 0.45 : type === 'bridge' ? 0.4 : 0.01 });
      this.doc.objects.push(o);
      this.drag = { kind: 'create', o, x0: x, y0: y };
      this.sel = o.id;
      return;
    }
    this.edit(() => {
      let o = t.single ? this.single(type) : null;
      const def = t.def || {};
      const ow = o?.w ?? def.w ?? (type === 'spawn' ? 0.8 : 0);
      let x = t.kind === 'point' && type === 'key' ? this.snap(w.x, step) : this.snap(w.x - (ow || 0) / 2, step);
      let y = this.snap(w.y, step);
      if (type !== 'key') { const g = this.groundY(x, ow || 0.8, w.y); if (g !== null) y = g; }
      if (type === 'lift') y -= 0.4;
      if (o) { o.x = x; o.y = y; } else { o = makeObject(type, x, y); this.doc.objects.push(o); }
      this.sel = o.id;
      if (t.single) this.setTool('select');
    });
    void e;
  }

  onMove(e) {
    if (!this.isOpen || !this.doc) return;
    const { sx, sy } = this.evtPos(e);
    const w = this.toWorld(sx, sy);
    this.mouse = { x: w.x, y: w.y, in: sx >= 0 && sy >= 0 && sx <= this.W && sy <= this.H };
    const d = this.drag;
    const step = this.snapStep(e);
    if (d?.kind === 'pan') {
      this.view.cx = d.cx - (sx - d.sx) / this.view.scale;
      this.view.cy = d.cy + (sy - d.sy) / this.view.scale;
    } else if (d?.kind === 'move') {
      d.o.x = this.snap(d.start.x + (w.x - d.wx), step);
      d.o.y = this.snap(d.start.y + (w.y - d.wy), step);
    } else if (d?.kind === 'create') {
      const x1 = this.snap(w.x, step), y1 = this.snap(w.y, step);
      d.o.x = Math.min(d.x0, x1); d.o.w = Math.max(0.01, Math.abs(x1 - d.x0));
      if (d.o.type === 'solid' || d.o.type === 'platform') { d.o.y = Math.min(d.y0, y1); d.o.h = Math.max(0.01, Math.abs(y1 - d.y0)); }
    } else if (d?.kind === 'handle') {
      this.resizeBy(d, w, step);
    } else {
      this.hover = this.tool === 'select' || this.linking ? this.hitTest(w.x, w.y)?.id : null;
    }
    this.$('.ed-coords').textContent = `x ${fmt(w.x)} · y ${fmt(w.y)} · ızgara ${e.shiftKey ? '0,1' : '0,5'} · yakınlık ${Math.round(this.view.scale)} px/birim`;
    this.requestRender();
  }

  resizeBy(d, w, step) {
    const o = d.o, s = d.start;
    const h = d.h;
    if (h === 'path') {
      const nx = this.snap(w.x - o.w / 2, step), ny = this.snap(w.y - o.h / 2, step);
      if (o.type === 'lift') { o.dx = 0; o.dy = Math.round((ny - o.y) * 1000) / 1000; }
      else { o.dx = Math.round((nx - o.x) * 1000) / 1000; o.dy = Math.round((ny - o.y) * 1000) / 1000; }
      return;
    }
    if (h.includes('e')) o.w = Math.max(MIN, this.snap(w.x, step) - s.x);
    if (h.includes('w')) { const nx = Math.min(this.snap(w.x, step), s.x + s.w - MIN); o.x = nx; o.w = s.x + s.w - nx; }
    if (h.includes('n')) o.h = Math.max(o.type === 'gate' ? 0.5 : 0.1, this.snap(w.y, step) - s.y);
    if (h.includes('s') && h !== 'e' && h !== 'w') { const ny = Math.min(this.snap(w.y, step), s.y + s.h - 0.1); o.y = ny; o.h = s.y + s.h - ny; }
  }

  onUp() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'create') {
      const o = d.o;
      if (o.w < MIN) { o.w = TYPES[o.type].def.w; o.x = this.snap(d.x0 - o.w / 2, 0.5); }
      // tıklayarak (sürüklemeden) yerleştirilen zemin/platformun üst yüzü tıklanan noktada olur
      if ((o.type === 'solid' || o.type === 'platform') && o.h < 0.1) { o.h = TYPES[o.type].def.h; o.y = d.y0 - o.h; }
      this.commit();
      this.renderInspector();
    } else if (d.kind === 'move' || d.kind === 'handle') {
      this.commit();
      this.renderInspector();
    }
    this.requestRender();
  }

  onWheel(e) {
    e.preventDefault();
    const { sx, sy } = this.evtPos(e);
    const before = this.toWorld(sx, sy);
    this.view.scale = Math.max(6, Math.min(90, this.view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const after = this.toWorld(sx, sy);
    this.view.cx += before.x - after.x; this.view.cy += before.y - after.y;
    this.requestRender();
  }

  onKey(e) {
    if (!this.isOpen) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); this.redo(); return; }
    if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); this.duplicate(); return; }
    if (k === 'Escape') { if (this.linking) { this.linking = false; this.tip(''); this.renderInspector(); } else if (this.tool !== 'select') this.setTool('select'); else this.select(null); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.removeSelected(); return; }
    if (k === 'Enter') { e.preventDefault(); this.play(); return; }
    if (k === 'v' || k === 'V') { this.setTool('select'); return; }
    if ((k === 'l' || k === 'L') && ['gate', 'bridge'].includes(this.obj(this.sel)?.type)) { this.startLinking(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (arrows[k] && this.sel) {
      e.preventDefault();
      const st = e.shiftKey ? 0.1 : 0.5;
      const o = this.obj(this.sel);
      this.edit(() => { o.x = Math.round((o.x + arrows[k][0] * st) * 1000) / 1000; o.y = Math.round((o.y + arrows[k][1] * st) * 1000) / 1000; });
    }
  }

  removeSelected() {
    const o = this.obj(this.sel);
    if (!o) return;
    if (TYPES[o.type]?.single) { this.opts.toast(`${TYPES[o.type].label} silinemez; yerini değiştirebilirsiniz.`); return; }
    this.edit(() => {
      this.doc.objects = this.doc.objects.filter((x) => x !== o);
      if (o.type === 'plate') for (const g of this.doc.objects) if (g.plates) g.plates = g.plates.filter((id) => id !== o.id);
    });
    this.sel = null;
    this.changed();
  }

  duplicate() {
    const o = this.obj(this.sel);
    if (!o || TYPES[o.type]?.single) return;
    const c = makeObject(o.type, o.x + 1, o.y, { ...structuredClone(o), id: undefined });
    c.id = makeObject(o.type, 0, 0).id;
    c.x = o.x + (o.w || 1) + 0.5;
    this.edit(() => this.doc.objects.push(c));
    this.select(c.id);
  }

  startLinking() {
    this.linking = true;
    this.tip('Bağlamak ya da bağlantıyı kaldırmak için plakalara tıklayın. Bitirmek için boş yere tıklayın veya Esc.');
    this.renderInspector(); this.requestRender();
  }

  // ------------------------------------------------------------ üst düğmeler
  topAction(a) {
    if (!a) return;
    if (a === 'exit') { this.save(); this.opts.onExit(); }
    if (a === 'new') this.newDraft();
    if (a === 'undo') this.undo();
    if (a === 'redo') this.redo();
    if (a === 'play') this.play();
    if (a === 'export') this.exportFile();
    if (a === 'import') this.$('[data-ed=file]').click();
    if (a === 'share') this.share();
  }

  play() {
    this.save();
    if (hasErrors(this.issues)) {
      const first = this.issues.find((r) => r.level === 'error');
      this.opts.toast(`Önce hataları düzeltin: ${first.msg}`);
      if (first.ids[0]) this.select(first.ids[0]);
      return;
    }
    this.opts.onPlay(toLevel(this.doc), { draftId: this.draftId, hash: docHash(this.doc) });
  }

  copyOfficial(i) {
    if (!this.opts.isUnlocked(i)) return;
    const doc = fromLevel(LEVELS[i]);
    doc.meta.name = `${LEVELS[i].name} (kopya)`;
    this.newDraft(doc);
    this.opts.toast('Resmi bölümün kopyası açıldı. Asıl bölüm değişmez.');
  }

  exportFile() {
    const level = toLevel(this.doc);
    const json = JSON.stringify(level, null, 1);
    const name = (this.doc.meta.name || 'bolum').toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '') || 'bolum';
    let embedded = true;
    try { embedded = window.self !== window.top; } catch { /* çerçeve içinde */ }
    const showText = () => this.dialog('Bölüm verisi', `<p>Bu görünümde dosya indirme engelli. Aşağıdaki metni kopyalayıp <code>${name}.co-park.json</code> adıyla kaydedin; <b>İçe aktar</b> ile geri yükleyebilirsiniz.</p><textarea readonly rows="10">${esc(json)}</textarea>`);
    if (embedded) { showText(); return; }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `${name}.co-park.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.opts.toast('Bölüm dosyası indirildi.');
    } catch {
      showText();
    }
  }

  async importFile(file) {
    this.$('[data-ed=file]').value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const doc = data.objects && data.meta ? data : fromLevel(sanitizeLevel(data));
      this.newDraft(doc);
      this.opts.toast(`"${doc.meta.name}" içe aktarıldı.`);
    } catch {
      this.opts.toast('Dosya okunamadı: geçerli bir CO-PARK bölüm dosyası değil.');
    }
  }

  async share() {
    if (hasErrors(this.issues)) { this.opts.toast('Hatalı bölüm paylaşılamaz. Önce alttaki hataları düzeltin.'); return; }
    if (!this.isVerified) {
      this.dialog('Önce bölümü bitirin', '<p>Paylaşılan her bölümün çözülebilir olduğundan emin olmak için, bölümü <b>en az 2 oyuncuyla</b> sizin bitirmeniz gerekir.</p><p><b>▶ Dene</b> ile oynayıp kapıdan herkesi geçirin; bitirince paylaşma açılır. Bölümde değişiklik yaparsanız yeniden bitirmeniz gerekir.</p>');
      return;
    }
    const url = await this.opts.shareUrl(toLevel(this.doc));
    this.dialog('Bölüm bağlantısı', `<p>Bu bağlantıyı açan herkes bölümünüzü oynayabilir ve kendi editöründe kopyasını açabilir.</p>
      <input readonly value="${esc(url)}" class="ed-url" />
      <p class="ed-small">Bağlantı ${url.length} karakter. Bölüm bağlantının içinde saklanır, sunucu gerekmez.</p>
      <div class="ed-row"><button data-act="copy-url">Bağlantıyı kopyala</button></div>`);
    const box = this.$('.ed-dialog-box');
    box.querySelector('[data-act=copy-url]').onclick = async () => {
      try { await navigator.clipboard.writeText(url); this.opts.toast('Bağlantı kopyalandı.'); } catch { box.querySelector('.ed-url').select(); this.opts.toast('Kopyalamak için Ctrl+C'); }
    };
  }

  dialog(title, html) {
    const d = this.$('.ed-dialog');
    d.classList.remove('hidden');
    d.querySelector('.ed-dialog-box').innerHTML = `<h3>${esc(title)}</h3>${html}<div class="ed-row"><button data-act="close">Kapat</button></div>`;
    d.onclick = (e) => { if (e.target === d || e.target.dataset.act === 'close') d.classList.add('hidden'); };
  }

  // ------------------------------------------------------------ ayar paneli
  renderInspector() {
    const el = this.$('.ed-inspector');
    if (!this.doc) { el.innerHTML = ''; return; }
    const o = this.obj(this.sel);
    if (!o) { el.innerHTML = this.metaPanel(); return; }
    const t = TYPES[o.type] || { label: o.type };
    const f = [];
    const num = (k, label, step = 0.1, dis = false) => f.push(`<label>${label}<input type="text" inputmode="decimal" data-f="${k}" value="${fmt(o[k] ?? 0)}" ${dis ? 'disabled' : ''}></label>`);
    const req = (k, label) => f.push(`<label>${label}<select data-f="${k}" data-kind="req">${REQ_OPTS.map(([v, l]) => `<option value="${v}" ${String(o[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`);
    f.push(`<div class="ed-title"><span class="sw" style="background:${t.color || '#999'}"></span>${t.label}</div>`);
    num('x', 'X'); num('y', 'Y');
    if (t.kind === 'rect') {
      num('w', 'Genişlik', 0.1, !(t.resize === true || t.resize === 'w'));
      num('h', 'Yükseklik', 0.1, !(t.resize === true || t.resize === 'h'));
    }
    if (o.type === 'block') { req('req', 'İtmek için gereken'); f.push('<p class="ed-small">Sayı, oyuncu sayısını aşarsa herkes gerekir.</p>'); }
    if (o.type === 'plate') {
      req('req', 'Basmak için gereken');
      const users = this.doc.objects.filter((g) => g.plates?.includes(o.id));
      f.push(`<p class="ed-small">${users.length ? `Bağlı: ${users.map((g) => TYPES[g.type].label).join(', ')}` : 'Henüz hiçbir şeye bağlı değil. Parmaklık ya da köprü seçip "Plaka bağla" deyin.'}</p>`);
      f.push('<p class="ed-small">Plakanın üstüne itilen sandık da plakayı basılı tutar.</p>');
    }
    if (o.type === 'gate' || o.type === 'bridge') {
      const ps = o.plates.map((id) => this.obj(id)).filter(Boolean);
      f.push(`<div class="ed-sub">Bağlı plakalar (${ps.length})</div>`);
      f.push(ps.length ? ps.map((p) => `<div class="ed-chip">Plaka · x ${fmt(p.x)} <button data-act="unlink" data-id="${p.id}" title="Bağlantıyı kaldır">×</button></div>`).join('') : '<p class="ed-small warn">Plaka bağlı değil: hiç açılmaz.</p>');
      f.push(`<button data-act="link" class="${this.linking ? 'on' : ''}">${this.linking ? 'Plakalara tıklayın…' : 'Plaka bağla (L)'}</button>`);
      f.push(`<p class="ed-small">${o.type === 'gate' ? 'Bağlı plakalardan biri basılıyken parmaklık açılır.' : 'Bağlı plakalardan biri basılıyken köprü açılır; üstünde biri varken toplanmaz.'}</p>`);
    }
    if (o.type === 'mover') {
      num('dx', 'Yol: yatay'); num('dy', 'Yol: dikey'); num('speed', 'Hız'); num('pause', 'Uçlarda bekleme (sn)');
      f.push('<p class="ed-small">Yolun ucundaki tutamacı sürükleyerek de ayarlayabilirsiniz.</p>');
    }
    if (o.type === 'lift') {
      num('dy', 'Kalkış yüksekliği'); num('speed', 'Hız'); req('req', 'Kalkmak için binen');
      f.push('<p class="ed-small">Asansörün sağ kenarını geçen oyuncular "çıkmış" sayılır; geride kalanların hepsi binince de kalkar.</p>');
    }
    const sel = (k, label, opts, cur) => f.push(`<label>${label}<select data-f="${k}" data-kind="opt">${opts.map(([v, l]) => `<option value="${v}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`);
    if (o.type === 'solid') {
      sel('surface', 'Yüzey', [['', 'Normal'], ['ice', 'Buz (kaygan)'], ['conveyor', 'Yürüyen bant']], o.surface);
      if (o.surface === 'conveyor') { num('speed', 'Bant hızı (eksi: sola)'); f.push('<p class="ed-small">Üstünde duran oyuncuları ve sandıkları bu hızla taşır. Koşma hızı 5,5.</p>'); }
      if (o.surface === 'ice') f.push('<p class="ed-small">Buzda hızlanmak ve durmak zordur.</p>');
    }
    if (o.type === 'platform') {
      f.push(`<label class="ed-check"><input type="checkbox" data-f="oneway" ${o.oneway ? 'checked' : ''}> Alttan geçilebilir (tek yönlü)</label>`);
    }
    if (o.type === 'plate') {
      num('timer', 'Zamanlayıcı (sn, 0 = kapalı)');
      f.push('<p class="ed-small">Zamanlayıcı varsa plaka bırakıldıktan sonra o kadar saniye daha basılı kalır.</p>');
    }
    if (o.type === 'colorgate') {
      sel('who', 'Geçebilen oyuncu', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, `${n}. oyuncu (${PLAYER_COLORS[n - 1].name})`]), o.who);
      f.push('<p class="ed-small">Yalnızca bu oyuncu geçebilir; diğerleri ve sandıklar için duvardır. Oyuncu sayısı azsa son oyuncuya düşer. Renk, oyunda o oyuncunun seçtiği renge uyar.</p>');
    }
    f.push('<div class="ed-row">');
    if (!t.single) f.push('<button data-act="dup">Çoğalt</button><button data-act="del" class="danger">Sil</button>');
    f.push('</div>');
    const iss = this.issues.filter((r) => r.ids.includes(o.id) && r.level !== 'info');
    if (iss.length) f.push(iss.map((r) => `<p class="ed-small ${r.level}">${esc(r.msg)}</p>`).join(''));
    el.innerHTML = f.join('');
  }

  metaPanel() {
    const m = this.doc.meta;
    const counts = {};
    for (const o of this.doc.objects) counts[o.type] = (counts[o.type] || 0) + 1;
    return `<div class="ed-title">Bölüm ayarları</div>
      <label>Ad<input type="text" data-m="name" maxlength="60" value="${esc(m.name)}"></label>
      <label>Tema<select data-m="theme">${THEMES.map((t) => `<option value="${t.id}" ${m.theme === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
      <label>Genişlik (birim)<input type="text" inputmode="decimal" data-m="width" value="${fmt(m.width)}"></label>
      <label>İpucu (bölüm başında görünür)<textarea data-m="hint" rows="3" maxlength="200">${esc(m.hint)}</textarea></label>
      <p class="ed-small">${this.doc.objects.length} nesne · ${Object.entries(counts).map(([k, v]) => `${v} ${TYPES[k]?.label.toLowerCase() || k}`).join(', ')}</p>
      <p class="ed-small">Bir nesneyi seçince ayarları burada görünür. Fizik: zıplama ≈ ${fmt(PHYS.jump)} birim, en geniş güvenli atlama ≈ ${fmt(PHYS.maxGap)} birim.</p>
      <div class="ed-row"><button data-act="delete-draft" class="danger">Taslağı sil</button></div>`;
  }

  inspectorChange(el) {
    const o = this.obj(this.sel);
    if (el.dataset.m) {
      const k = el.dataset.m;
      this.edit(() => {
        if (k === 'width') { const v = parseNum(el.value); if (v > 0) this.doc.meta.width = Math.max(16, Math.min(400, v)); }
        else this.doc.meta[k] = el.value;
      });
      return;
    }
    if (!o || !el.dataset.f) return;
    const k = el.dataset.f;
    this.edit(() => {
      if (el.dataset.kind === 'req') o[k] = /^\d+$/.test(el.value) ? Number(el.value) : el.value;
      else if (el.dataset.kind === 'opt') {
        if (el.value === '') delete o[k];
        else o[k] = /^-?\d+(\.\d+)?$/.test(el.value) ? Number(el.value) : el.value;
        if (k === 'surface' && o.surface === 'conveyor' && !o.speed) o.speed = 2;
        if (k === 'surface' && o.surface !== 'conveyor') delete o.speed;
      }
      else if (k === 'timer') { const v = parseNum(el.value); if (Number.isFinite(v) && v > 0) o.timer = Math.min(30, Math.round(v * 10) / 10); else delete o.timer; }
      else if (el.type === 'checkbox') { if (el.checked) o[k] = true; else delete o[k]; }
      else if (el.tagName === 'SELECT') o[k] = el.value;
      else {
        const v = parseNum(el.value);
        if (!Number.isFinite(v)) return;
        if ((k === 'w' || k === 'h') && v < 0.1) return;
        if (k === 'speed' && o.type !== 'solid' && v <= 0) return;
        if (k === 'speed' && o.type === 'solid' && v === 0) return;
        o[k] = Math.round(v * 1000) / 1000;
      }
    });
  }

  inspectorClick(b) {
    if (!b) return;
    const a = b.dataset.act;
    const o = this.obj(this.sel);
    if (a === 'link') { if (this.linking) { this.linking = false; this.tip(''); this.renderInspector(); } else this.startLinking(); }
    if (a === 'unlink' && o) this.edit(() => { o.plates = o.plates.filter((id) => id !== b.dataset.id); });
    if (a === 'dup') this.duplicate();
    if (a === 'del') this.removeSelected();
    if (a === 'delete-draft') {
      if (b.dataset.armed) {
        drafts.remove(this.draftId);
        const next = drafts.list()[0];
        if (next) this.openDraft(next.id); else this.newDraft();
        this.opts.toast('Taslak silindi.');
      } else { b.dataset.armed = '1'; b.textContent = 'Emin misiniz? Tekrar tıklayın'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Taslağı sil'; } }, 3500); }
    }
  }

  renderIssues() {
    const el = this.$('.ed-issues');
    const list = this.issues.filter((r) => r.level !== 'info');
    const infos = this.issues.filter((r) => r.level === 'info');
    const icon = { error: '✕', warn: '!', info: '✓' };
    const items = (list.length ? list : infos).slice(0, 4);
    el.innerHTML = items.map((r) => `<span class="iss ${r.level}" ${r.ids[0] ? `data-id="${r.ids[0]}"` : ''}>${icon[r.level]} ${esc(r.msg)}</span>`).join('') +
      (list.length > 4 ? `<span class="iss more">+${list.length - 4} daha</span>` : '');
  }

  // ------------------------------------------------------------ çizim
  resize() {
    const st = this.$('.ed-stage');
    const r = st.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.fitted && this.doc) { this.fitView(); this.fitted = true; }
    this.requestRender();
  }

  requestRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render() {
    if (!this.isOpen || !this.doc || !this.W) return;
    const c = this.ctx, W = this.W, H = this.H, S = this.view.scale;
    const P = (x, y) => this.toScreen(x, y);
    const meta = this.doc.meta;
    c.fillStyle = BG[meta.theme] || BG.park;
    c.fillRect(0, 0, W, H);

    // ızgara
    const tl = this.toWorld(0, 0), br = this.toWorld(W, H);
    const minor = S >= 14 ? 1 : S >= 7 ? 5 : 10;
    for (let x = Math.floor(tl.x / minor) * minor; x <= br.x; x += minor) {
      const sx = Math.round(P(x, 0).x) + 0.5;
      c.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.05)';
      c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, H); c.stroke();
    }
    for (let y = Math.floor(br.y / minor) * minor; y <= tl.y; y += minor) {
      const sy = Math.round(P(0, y).y) + 0.5;
      c.strokeStyle = y === 0 ? 'rgba(255,255,255,.28)' : y % 5 === 0 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.05)';
      c.beginPath(); c.moveTo(0, sy); c.lineTo(W, sy); c.stroke();
    }
    // bölüm dışı ve düşme sınırı
    c.fillStyle = 'rgba(0,0,0,.35)';
    const x0 = P(0, 0).x, x1 = P(meta.width, 0).x;
    if (x0 > 0) c.fillRect(0, 0, x0, H);
    if (x1 < W) c.fillRect(x1, 0, W - x1, H);
    const dy = P(0, -5).y;
    c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,90,80,.6)'; c.beginPath(); c.moveTo(x0, dy); c.lineTo(x1, dy); c.stroke(); c.setLineDash([]);
    this.label('düşme sınırı', x0 + 6, dy - 5, 'rgba(255,120,110,.8)', 'left');

    const issueLevel = {};
    for (const r of this.issues) for (const id of r.ids) if (r.level !== 'info' && issueLevel[id] !== 'error') issueLevel[id] = r.level;

    const objs = [...this.doc.objects].sort((a, b) => (Z[a.type] ?? 0) - (Z[b.type] ?? 0));
    for (const o of objs) this.drawObject(o, issueLevel[o.id]);

    // plaka bağlantıları
    for (const g of this.doc.objects) {
      if (!g.plates?.length) continue;
      const gb = bounds(g);
      for (const id of g.plates) {
        const p = this.obj(id); if (!p) continue;
        const a = P(gb.x + gb.w / 2, gb.y + gb.h / 2), b = P(p.x + p.w / 2, p.y + 0.06);
        c.strokeStyle = this.sel === g.id || this.sel === p.id ? 'rgba(120,230,160,.95)' : 'rgba(120,230,160,.4)';
        c.setLineDash([4, 4]); c.beginPath(); c.moveTo(a.x, a.y);
        c.bezierCurveTo(a.x, a.y - 40, b.x, b.y - 40, b.x, b.y); c.stroke(); c.setLineDash([]);
      }
    }

    const sel = this.obj(this.sel);
    if (sel) this.drawGuides(sel);

    // vurgu ve seçim
    if (this.hover && this.hover !== this.sel) { const o = this.obj(this.hover); if (o) this.outline(o, 'rgba(255,255,255,.55)', 1); }
    if (this.linking) for (const p of this.doc.objects.filter((x) => x.type === 'plate')) this.outline(p, 'rgba(120,230,160,.9)', 2);
    if (sel) {
      this.outline(sel, '#f5c518', 2);
      for (const h of this.handles(sel)) {
        const p = P(h.x, h.y);
        c.fillStyle = h.id === 'path' ? '#3db0ff' : '#f5c518'; c.strokeStyle = '#111';
        c.beginPath(); if (h.id === 'path') c.arc(p.x, p.y, 6, 0, 7); else c.rect(p.x - 5, p.y - 5, 10, 10); c.fill(); c.stroke();
      }
      const b = bounds(sel);
      if (this.drag && sel.w) this.label(`${fmt(sel.w)} × ${fmt(sel.h)}`, P(b.x + b.w / 2, 0).x, P(0, b.y + b.h).y - 8, '#f5c518');
    }

    // yerleştirme önizlemesi
    if (this.tool !== 'select' && this.mouse.in && !this.drag) {
      const t = TYPES[this.tool];
      const ww = t.def?.w ?? 0.8, hh = t.def?.h ?? 0.9;
      const p = P(this.snap(this.mouse.x - (t.kind === 'point' ? 0 : ww / 2), 0.5), this.snap(this.mouse.y, 0.5));
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.setLineDash([3, 3]);
      c.strokeRect(p.x, p.y - hh * S, (t.kind === 'point' ? 0.8 : ww) * S, hh * S); c.setLineDash([]);
    }
  }

  rectPath(o) {
    const b = bounds(o); const p = this.toScreen(b.x, b.y + b.h);
    return { x: p.x, y: p.y, w: b.w * this.view.scale, h: b.h * this.view.scale };
  }

  outline(o, color, w) {
    const r = this.rectPath(o); const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w; c.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); c.lineWidth = 1;
  }

  label(text, x, y, color = '#fff', align = 'center', size = 11) {
    const c = this.ctx;
    c.font = `600 ${size}px system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(text, x, y);
    c.fillStyle = color; c.fillText(text, x, y); c.lineWidth = 1;
  }

  drawObject(o, issue) {
    const c = this.ctx, S = this.view.scale, t = TYPES[o.type] || { color: '#999' };
    const r = this.rectPath(o);
    const P = (x, y) => this.toScreen(x, y);
    c.globalAlpha = 1;
    switch (o.type) {
      case 'solid': case 'platform': {
        c.fillStyle = o.surface === 'ice' ? '#9fd3ee' : o.surface === 'conveyor' ? '#3a3f46' : t.color;
        c.fillRect(r.x, r.y, r.w, r.h);
        c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(r.x, r.y, r.w, Math.min(4, r.h));
        if (o.oneway) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([4, 3]); c.strokeRect(r.x, r.y, r.w, r.h); c.setLineDash([]); }
        if (o.surface === 'conveyor') this.label(o.speed >= 0 ? '→→' : '←←', r.x + r.w / 2, r.y + r.h / 2 + 4, '#ffd166');
        break;
      }
      case 'spike': {
        c.fillStyle = t.color;
        const n = Math.max(1, Math.round(o.w / 0.5));
        for (let i = 0; i < n; i++) {
          const a = r.x + (i * r.w) / n;
          c.beginPath(); c.moveTo(a, r.y + r.h); c.lineTo(a + r.w / n / 2, r.y); c.lineTo(a + r.w / n, r.y + r.h); c.fill();
        }
        break;
      }
      case 'block':
        c.fillStyle = t.color; c.fillRect(r.x, r.y, r.w, r.h);
        c.strokeStyle = '#7a5a20'; c.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        this.label(reqText(o.req), r.x + r.w / 2, r.y + r.h / 2 + 4, '#fff', 'center', Math.max(10, Math.min(16, S * 0.45)));
        break;
      case 'plate':
        c.fillStyle = t.color; c.fillRect(r.x, r.y - 3, r.w, Math.max(4, r.h + 3));
        this.label(`${reqText(o.req)}${o.timer ? ` · ${o.timer} sn` : ''}`, r.x + r.w / 2, r.y - 7, '#ffb3ad');
        break;
      case 'gate':
        c.fillStyle = 'rgba(91,100,112,.35)'; c.fillRect(r.x, r.y, r.w, r.h);
        c.strokeStyle = '#b9c2cc';
        for (let i = 1; i < 4; i++) { const x = r.x + (r.w * i) / 4; c.beginPath(); c.moveTo(x, r.y); c.lineTo(x, r.y + r.h); c.stroke(); }
        break;
      case 'bridge':
        c.setLineDash([5, 4]); c.strokeStyle = t.color; c.lineWidth = 2; c.strokeRect(r.x, r.y, r.w, r.h); c.lineWidth = 1; c.setLineDash([]);
        c.fillStyle = 'rgba(124,138,153,.25)'; c.fillRect(r.x, r.y, r.w, r.h);
        break;
      case 'colorgate':
        c.fillStyle = (PLAYER_COLORS[(o.who || 1) - 1]?.hex || '#888888') + '99'; c.fillRect(r.x, r.y, r.w, r.h);
        c.strokeStyle = '#fff'; c.strokeRect(r.x, r.y, r.w, r.h);
        this.label(String(o.who), r.x + r.w / 2, r.y + r.h / 2 + 4);
        break;
      case 'mover': case 'lift': {
        const end = P(o.x + o.dx, o.y + o.dy + o.h);
        c.setLineDash([4, 4]); c.strokeStyle = 'rgba(61,176,255,.7)';
        c.strokeRect(end.x, end.y, r.w, r.h);
        c.beginPath(); c.moveTo(r.x + r.w / 2, r.y + r.h / 2); c.lineTo(end.x + r.w / 2, end.y + r.h / 2); c.stroke(); c.setLineDash([]);
        c.fillStyle = t.color; c.fillRect(r.x, r.y, r.w, r.h);
        if (o.type === 'lift') this.label(`asansör · ${reqText(o.req)}`, r.x + r.w / 2, r.y - 5, '#9fd0ff');
        break;
      }
      case 'door':
        c.fillStyle = t.color; c.fillRect(r.x, r.y, r.w, r.h);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(r.x + r.w * 0.15, r.y + r.h * 0.1, r.w * 0.7, r.h * 0.9);
        this.label('KAPI', r.x + r.w / 2, r.y + r.h / 2 + 4);
        break;
      case 'key': {
        const p = P(o.x, o.y);
        c.strokeStyle = t.color; c.lineWidth = 3; c.beginPath(); c.arc(p.x - 6, p.y, 5, 0, 7); c.moveTo(p.x - 1, p.y); c.lineTo(p.x + 10, p.y); c.lineTo(p.x + 10, p.y + 5); c.stroke(); c.lineWidth = 1;
        c.strokeStyle = 'rgba(226,177,60,.35)'; c.beginPath(); c.arc(p.x, p.y, 0.75 * S, 0, 7); c.stroke();
        break;
      }
      case 'spawn':
        for (let i = 7; i >= 0; i--) {
          const p = P(o.x + i * 0.95, o.y + 0.9);
          c.fillStyle = i === 0 ? t.color : 'rgba(46,158,91,.25)';
          c.fillRect(p.x, p.y, 0.8 * S, 0.9 * S);
        }
        this.label('başlangıç', P(o.x + 0.4, 0).x, P(0, o.y + 0.9).y - 6, '#9be3b5');
        break;
      default:
        c.fillStyle = t.color; c.fillRect(r.x, r.y, r.w, r.h);
    }
    if (issue) { c.strokeStyle = issue === 'error' ? '#ff5a50' : '#f5b041'; c.lineWidth = 2; c.setLineDash([3, 3]); c.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); c.setLineDash([]); c.lineWidth = 1; }
  }

  // Seçili yüzeyin üstünde zıplama kılavuzları ve yanlarındaki boşluk ölçüsü
  drawGuides(o) {
    if (!SURFACES.has(o.type)) return;
    const c = this.ctx, P = (x, y) => this.toScreen(x, y);
    const top = o.y + o.h;
    const xa = o.x - 3, xb = o.x + o.w + 3;
    const cols = ['rgba(120,230,160,.8)', 'rgba(160,150,255,.8)', 'rgba(255,170,120,.8)'];
    const names = ['1 kişi zıplar', '2 kişi üst üste', '3 kişi üst üste'];
    for (let k = 1; k <= 3; k++) {
      const y = P(0, top + PHYS.stackReach(k)).y;
      c.strokeStyle = cols[k - 1]; c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(P(xa, 0).x, y); c.lineTo(P(xb, 0).x, y); c.stroke(); c.setLineDash([]);
      this.label(names[k - 1], P(xb, 0).x + 4, y + 4, cols[k - 1], 'left');
    }
    if (o.type !== 'solid' && o.type !== 'platform') return;
    const surf = this.doc.objects.filter((s) => (s.type === 'solid' || s.type === 'platform') && s !== o && Math.abs(s.y + s.h - top) <= 0.6);
    const right = surf.filter((s) => s.x >= o.x + o.w - 0.01).sort((a, b) => a.x - b.x)[0];
    const left = surf.filter((s) => s.x + s.w <= o.x + 0.01).sort((a, b) => b.x + b.w - (a.x + a.w))[0];
    const gapLine = (xA, xB) => {
      const g = xB - xA; if (g < 0.05 || g > 30) return;
      const okc = g <= PHYS.maxGap ? '#7be0a0' : '#ff7a70';
      const y = P(0, top + 0.35).y, a = P(xA, 0).x, b = P(xB, 0).x;
      c.strokeStyle = okc; c.beginPath(); c.moveTo(a, y); c.lineTo(b, y); c.moveTo(a, y - 4); c.lineTo(a, y + 4); c.moveTo(b, y - 4); c.lineTo(b, y + 4); c.stroke();
      this.label(`${fmt(g)} birim ${g <= PHYS.maxGap ? '· atlanır' : '· atlanamaz'}`, (a + b) / 2, y - 6, okc);
    };
    if (right) gapLine(o.x + o.w, right.x);
    if (left) gapLine(left.x + left.w, o.x);
  }
}
