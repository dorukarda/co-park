// Host → istemci durum anlık görüntüleri (ÇO-05: host otoriteli model).
// Host 30 Hz gönderir; istemci iki görüntü arasında ara değer alarak akıcı çizer.
const R = (v) => Math.round(v * 1000) / 1000;

export const NET_EVENTS = new Set(['jump', 'land', 'key', 'unlock', 'enter', 'exit', 'plate', 'blockStart', 'death', 'clear', 'emote']);

export function encodeSnapshot(w, levelIndex, events) {
  return {
    t: 'snap', lv: levelIndex, at: w.attempt, s: w.status, st: R(w.statusTime),
    c: [R(w.cam.x), R(w.cam.y), R(w.cam.spreadY || 0)],
    p: w.players.map((p) => [R(p.x), R(p.y), R(p.vx), R(p.vy), p.grounded ? 1 : 0, p.facing, p.entered ? 1 : 0, R(p.landImpact || 0), R(p.emote || 0)]),
    k: [R(w.key.x), R(w.key.y), w.key.holder ? w.key.holder.id : -1, w.key.used ? 1 : 0],
    d: w.door.unlocked ? 1 : 0,
    b: w.blocks.map((b) => [R(b.x), R(b.y), b.pushers]),
    pl: w.plates.map((p) => [p.count, p.pressed ? 1 : 0, R(p.hold || 0)]),
    g: w.gates.map((g) => R(g.open)),
    m: w.movers.map((m) => [R(m.x), R(m.y), m.aboard, m.need]),
    ev: events,
  };
}

export function applySnapshot(w, s) {
  w.status = s.s; w.statusTime = s.st;
  w.cam.x = s.c[0]; w.cam.y = s.c[1]; w.cam.spreadY = s.c[2];
  s.p.forEach((a, i) => {
    const p = w.players[i]; if (!p) return;
    [p.x, p.y, p.vx, p.vy] = a;
    p.grounded = !!a[4]; p.facing = a[5]; p.entered = !!a[6]; p.landImpact = a[7]; p.emote = a[8] || 0;
  });
  w.key.x = s.k[0]; w.key.y = s.k[1];
  w.key.holder = s.k[2] >= 0 ? w.players[s.k[2]] || null : null;
  w.key.used = !!s.k[3];
  w.door.unlocked = !!s.d;
  s.b.forEach((a, i) => { const b = w.blocks[i]; if (b) [b.x, b.y, b.pushers] = a; });
  s.pl.forEach((a, i) => { const p = w.plates[i]; if (p) { p.count = a[0]; p.pressed = !!a[1]; p.hold = a[2] || 0; } });
  s.g.forEach((o, i) => { if (w.gates[i]) w.gates[i].open = o; });
  s.m.forEach((a, i) => { const m = w.movers[i]; if (m) [m.x, m.y, m.aboard, m.need] = a; });
}

// Konumları iki görüntü arasında ara değerle (aynı bölüm ve aynı deneme ise).
export function interpolate(w, a, b, t) {
  if (!a || !b || a.lv !== b.lv || a.at !== b.at) return;
  const L = (x, y) => x + (y - x) * t;
  w.cam.x = L(a.c[0], b.c[0]); w.cam.y = L(a.c[1], b.c[1]);
  b.p.forEach((pb, i) => {
    const pa = a.p[i], p = w.players[i];
    if (!pa || !p || pa[6] !== pb[6]) return;
    p.x = L(pa[0], pb[0]); p.y = L(pa[1], pb[1]);
  });
  w.key.x = L(a.k[0], b.k[0]); w.key.y = L(a.k[1], b.k[1]);
  b.b.forEach((bb, i) => { const ba = a.b[i], k = w.blocks[i]; if (ba && k) { k.x = L(ba[0], bb[0]); k.y = L(ba[1], bb[1]); } });
  b.m.forEach((mb, i) => { const ma = a.m[i], m = w.movers[i]; if (ma && m) { m.x = L(ma[0], mb[0]); m.y = L(ma[1], mb[1]); } });
  b.g.forEach((gb, i) => { if (w.gates[i]) w.gates[i].open = L(a.g[i] ?? gb, gb); });
}
