// Bölüm modeli: editörün çalıştığı nesne listesi ⇄ oyunun okuduğu bölüm verisi.
// Bölüm verisi (levels.js ve paylaşılan bölümler) `schema` alanıyla sürümlenir.
export const LEVEL_SCHEMA = 1;

// Nesne türleri. kind: 'rect' (dikdörtgen) | 'point' (nokta) | 'door' (sabit boyut)
// resize: true (iki yön) | 'w' (yalnız genişlik) | 'h' (yalnız yükseklik) | false
// drag: yerleştirirken sürükleyerek boyut verilir
export const TYPES = {
  solid:    { label: 'Zemin',              icon: 'square',   kind: 'rect', resize: true,  drag: true, def: { w: 6, h: 3 },  color: '#8b7b66' },
  platform: { label: 'Platform',           icon: 'minus',    kind: 'rect', resize: true,  drag: true, def: { w: 3, h: 0.5 }, color: '#a87a4c' },
  spike:    { label: 'Diken',              icon: 'triangle', kind: 'rect', resize: 'w',   drag: true, def: { w: 2, h: 0.45 }, color: '#d9534f' },
  block:    { label: 'Sandık',             icon: 'box',      kind: 'rect', resize: true,  def: { w: 1.4, h: 1.4, req: 'all' }, color: '#d9a441' },
  plate:    { label: 'Plaka',              icon: 'circle-dot', kind: 'rect', resize: 'w', def: { w: 3.4, h: 0.12, req: 'half' }, color: '#c0392b' },
  gate:     { label: 'Parmaklık',          icon: 'fence',    kind: 'rect', resize: 'h',   def: { w: 0.8, h: 4, plates: [] }, color: '#5b6470' },
  bridge:   { label: 'Köprü',              icon: 'arrows-horizontal', kind: 'rect', resize: 'w', drag: true, def: { w: 6, h: 0.4, plates: [] }, color: '#7c8a99' },
  colorgate:{ label: 'Renkli kapı',        icon: 'door',     kind: 'rect', resize: true,  def: { w: 0.8, h: 2, who: 1 }, color: '#b07de8' },
  mover:    { label: 'Hareketli platform', icon: 'arrows-left-right', kind: 'rect', resize: 'w', def: { w: 3, h: 0.4, dx: 6, dy: 0, speed: 2.2, pause: 0.7 }, color: '#3d8fd1' },
  lift:     { label: 'Asansör',            icon: 'elevator', kind: 'rect', resize: 'w',   def: { w: 3.2, h: 0.4, dx: 0, dy: 6, speed: 2.4, req: 'all' }, color: '#2a6fb0' },
  key:      { label: 'Anahtar',            icon: 'key',      kind: 'point', single: true, def: {}, color: '#e2b13c' },
  door:     { label: 'Kapı',               icon: 'door',     kind: 'door', single: true, def: { w: 1.4, h: 2 }, color: '#7a4fb5' },
  spawn:    { label: 'Başlangıç',          icon: 'flag',     kind: 'point', single: true, def: {}, color: '#2e9e5b' },
};
export const PALETTE_ORDER = ['solid', 'platform', 'spike', 'block', 'plate', 'gate', 'bridge', 'colorgate', 'mover', 'lift', 'key', 'door', 'spawn'];

export const THEMES = [
  { id: 'park', label: 'Park' },
  { id: 'workshop', label: 'Atölye' },
  { id: 'construction', label: 'Şantiye' },
  { id: 'winter', label: 'Kış' },
];

let seq = 0;
export const newId = () => 'o' + Date.now().toString(36).slice(-4) + (seq++).toString(36);

export function makeObject(type, x, y, extra = {}) {
  const t = TYPES[type];
  const o = { id: newId(), type, x, y, ...structuredClone(t.def), ...extra };
  if (t.kind === 'point') { delete o.w; delete o.h; }
  return o;
}

export function newDoc() {
  return {
    schema: LEVEL_SCHEMA,
    meta: { name: 'Yeni bölüm', theme: 'park', width: 40, hint: '' },
    objects: [
      makeObject('solid', 0, -3, { w: 40, h: 3 }),
      makeObject('spawn', 1.2, 0),
      makeObject('key', 20, 0.6),
      makeObject('door', 34, 0),
    ],
  };
}

const r3 = (v) => Math.round(v * 1000) / 1000;

// Editör belgesi → oyunun okuduğu bölüm verisi
export function toLevel(doc, id = 'custom') {
  const m = doc.meta;
  const L = {
    schema: LEVEL_SCHEMA, id, world: 'Özel bölüm', name: m.name || 'Adsız bölüm', theme: m.theme || 'park',
    width: m.width, hint: m.hint || '', spawn: [0, 0], key: [0, 0], door: [0, 0],
    solids: [], platforms: [], spikes: [], blocks: [], plates: [], gates: [], movers: [],
  };
  const R = (o) => [r3(o.x), r3(o.y), r3(o.w), r3(o.h)];
  for (const o of doc.objects) {
    switch (o.type) {
      case 'solid': L.solids.push(o.surface ? { r: R(o), surface: o.surface, speed: o.speed } : R(o)); break;
      case 'platform': L.platforms.push(o.oneway ? { r: R(o), oneway: true } : R(o)); break;
      case 'spike': L.spikes.push(R(o)); break;
      case 'block': L.blocks.push({ x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), req: o.req }); break;
      case 'plate': L.plates.push({ id: o.id, x: r3(o.x), y: r3(o.y), w: r3(o.w), req: o.req, ...(o.timer ? { timer: o.timer } : {}) }); break;
      case 'gate': L.gates.push({ x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), plates: [...o.plates] }); break;
      case 'bridge': L.gates.push({ x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), plates: [...o.plates], axis: 'x' }); break;
      case 'mover':
        L.movers.push({ path: [[r3(o.x), r3(o.y)], [r3(o.x + o.dx), r3(o.y + o.dy)]], w: r3(o.w), h: r3(o.h), speed: o.speed, pause: o.pause, mode: 'loop' });
        break;
      case 'lift':
        L.movers.push({ path: [[r3(o.x), r3(o.y)], [r3(o.x + o.dx), r3(o.y + o.dy)]], w: r3(o.w), h: r3(o.h), speed: o.speed, mode: 'lift', req: o.req, passX: r3(o.x + o.w) });
        break;
      case 'key': L.key = [r3(o.x), r3(o.y)]; break;
      case 'door': L.door = [r3(o.x), r3(o.y)]; break;
      case 'spawn': L.spawn = [r3(o.x), r3(o.y)]; break;
      default: break;
    }
    if (o.type === 'colorgate') L.colorGates = [...(L.colorGates || []), { x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), who: o.who }];
  }
  for (const k of Object.keys(L)) if (Array.isArray(L[k]) && !L[k].length && !['spawn', 'key', 'door'].includes(k)) delete L[k];
  return L;
}

// Bölüm verisi (resmi ya da paylaşılan) → editör belgesi
export function fromLevel(L) {
  const objects = [];
  const add = (type, props) => { const o = makeObject(type, props.x, props.y, props); objects.push(o); return o; };
  const rect = (r) => (Array.isArray(r) ? { x: r[0], y: r[1], w: r[2], h: r[3] } : { x: r.r[0], y: r.r[1], w: r.r[2], h: r.r[3] });
  for (const s of L.solids || []) add('solid', { ...rect(s), ...(s.surface ? { surface: s.surface, speed: s.speed } : {}) });
  for (const s of L.platforms || []) add('platform', { ...rect(s), ...(s.oneway ? { oneway: true } : {}) });
  for (const s of L.spikes || []) add('spike', rect(s));
  for (const b of L.blocks || []) add('block', { x: b.x, y: b.y, w: b.w, h: b.h, req: b.req });
  const plateIds = {};
  for (const p of L.plates || []) { const o = add('plate', { x: p.x, y: p.y, w: p.w, h: 0.12, req: p.req, ...(p.timer ? { timer: p.timer } : {}) }); plateIds[p.id] = o.id; }
  for (const g of L.gates || []) add(g.axis === 'x' ? 'bridge' : 'gate', { x: g.x, y: g.y, w: g.w, h: g.h, plates: g.plates.map((id) => plateIds[id]).filter(Boolean) });
  for (const c of L.colorGates || []) add('colorgate', { x: c.x, y: c.y, w: c.w, h: c.h, who: c.who });
  for (const m of L.movers || []) {
    const [a, b] = m.path;
    const base = { x: a[0], y: a[1], w: m.w, h: m.h, dx: b[0] - a[0], dy: b[1] - a[1], speed: m.speed };
    if (m.mode === 'loop') add('mover', { ...base, pause: m.pause ?? 0 });
    else add('lift', { ...base, req: m.req ?? 'all' });
  }
  add('spawn', { x: L.spawn[0], y: L.spawn[1] });
  add('key', { x: L.key[0], y: L.key[1] });
  add('door', { x: L.door[0], y: L.door[1] });
  return {
    schema: LEVEL_SCHEMA,
    meta: { name: L.name, theme: L.theme, width: L.width, hint: L.hint || '' },
    objects,
  };
}

// Nesnenin kapladığı dikdörtgen (seçme, çizim, denetim için)
export function bounds(o) {
  const t = TYPES[o.type];
  if (o.type === 'key') return { x: o.x - 0.35, y: o.y - 0.25, w: 0.7, h: 0.5 };
  if (o.type === 'spawn') return { x: o.x, y: o.y, w: 0.8, h: 0.9 };
  if (t?.kind === 'door') return { x: o.x, y: o.y, w: 1.4, h: 2 };
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

// Bir belgenin içeriğine göre kısa özet (doğrulama kaydı için)
export function docHash(doc) {
  const s = JSON.stringify({ m: doc.meta, o: doc.objects.map(({ id, ...rest }) => rest) });
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
