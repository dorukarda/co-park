// Oyun dünyası: deterministik, kinematik fizik ve oyun kuralları (TK-02).
// Görselden tamamen bağımsızdır; ileride ağ senkronizasyonu için host bu sınıfı çalıştırır.
import { CFG, resolveReq } from './config.js';

const EPS = 1e-4;
const SKIN = 0.01;

const overlap1D = (a0, a1, b0, b1) => a0 < b1 - EPS && a1 > b0 + EPS;
export const rectsOverlap = (a, b) =>
  overlap1D(a.x, a.x + a.w, b.x, b.x + b.w) && overlap1D(a.y, a.y + a.h, b.y, b.y + b.h);

const NO_INPUT = { left: false, right: false, jump: false, action: false, jumpPressed: false, actionPressed: false };

export class World {
  constructor(level, slots) {
    this.level = level;
    this.slots = slots;
    this.reset();
  }

  reset() {
    const L = this.level;
    const n = this.slots.length;
    this.n = n;
    this.time = 0;
    this.status = 'play';      // play | dead | clear
    this.statusTime = 0;
    this.events = [];
    this.attempt = (this.attempt ?? 0) + 1;

    // dikdörtgen [x,y,w,h] ya da ek özellikli kayıt { r:[x,y,w,h], surface, speed, oneway }
    const st = (r, i, flag) => {
      const a = Array.isArray(r) ? r : r.r;
      const o = { kind: 'static', x: a[0], y: a[1], w: a[2], h: a[3], id: flag + i };
      if (!Array.isArray(r)) { if (r.surface) { o.surface = r.surface; o.speed = r.speed ?? 2; } if (r.oneway) o.oneway = true; }
      return o;
    };
    this.statics = [
      ...L.solids.map((r, i) => st(r, i, 's')),
      ...(L.platforms || []).map((r, i) => st(r, i, 'p')),
      { kind: 'static', id: 'boundL', x: -5, y: -50, w: 5, h: 200, invisible: true },
      { kind: 'static', id: 'boundR', x: L.width, y: -50, w: 5, h: 200, invisible: true },
    ];
    this.spikes = (L.spikes || []).map(([x, y, w, h]) => ({ x, y, w, h }));
    this.blocks = (L.blocks || []).map((b, i) => ({
      kind: 'block', id: 'b' + i, x: b.x, y: b.y, w: b.w, h: b.h,
      req: resolveReq(b.req, n), vy: 0, dx: 0, dy: 0, pushers: 0, moving: false,
    }));
    this.plates = (L.plates || []).map((p) => ({ ...p, h: 0.12, req: resolveReq(p.req, n), count: 0, pressed: false }));
    this.gates = (L.gates || []).map((g, i) => ({ kind: 'gate', id: 'g' + i, ...g, open: 0 }));
    this.movers = (L.movers || []).map((m, i) => ({
      kind: 'mover', id: 'm' + i, ...m, req: resolveReq(m.req ?? 'all', n),
      x: m.path[0][0], y: m.path[0][1], t: 0, dir: 1, wait: 0, dx: 0, dy: 0, aboard: 0, need: 0,
    }));
    this.key = { x: L.key[0], y: L.key[1], holder: null, cooldown: 0, used: false };
    this.door = { x: L.door[0], y: L.door[1], w: 1.4, h: 2.0, unlocked: false };
    this.players = this.slots.map((slot, i) => ({
      kind: 'player', id: i, slot,
      x: L.spawn[0] + i * 0.95, y: L.spawn[1], w: CFG.playerW, h: CFG.playerH,
      vx: 0, vy: 0, grounded: false, groundRef: null, coyote: 0, jumpBuf: 0,
      facing: 1, inDir: 0, entered: false, lastDx: 0, lastDy: 0, landImpact: 0,
    }));
    const startX = L.spawn[0] + Math.max(0, n - 1) * 0.475 + 0.4;
    this.cam = { x: startX, y: 2, halfW: CFG.viewHalfW, spreadY: 0 };
  }

  get active() { return this.players.filter((p) => !p.entered); }

  // ---------------------------------------------------------------- adım
  step(dt, inputs) {
    if (this.status !== 'play') { this.statusTime += dt; return; }
    this.time += dt;

    for (const p of this.players) {
      const inp = inputs[p.id] || NO_INPUT;
      p.inp = inp;
      p.inDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    }

    this.updateDoorEntry();
    this.updatePlates();
    this.updateGates(dt);
    this.updateMovers(dt);
    this.updateCamera(dt);
    this.updateBlocks(dt);
    this.updatePlayers(dt);
    this.updateKey(dt);
    this.checkDeath();
    this.checkClear();
  }

  // ---------------------------------------------------------------- yardımcılar
  gateRect(g) {
    if (g.axis === 'x') {                         // köprü: soldan sağa uzanır
      if (g.open < 0.02) return null;
      return { kind: 'gate', ref: g, x: g.x, y: g.y, w: g.w * g.open, h: g.h };
    }
    if (g.open > 0.98) return null;
    return { kind: 'gate', ref: g, x: g.x, y: g.y + g.h * g.open, w: g.w, h: g.h * (1 - g.open) };
  }

  camWalls() {
    const m = 0.25;
    return [
      { kind: 'cam', x: this.cam.x - this.cam.halfW + m - 10, y: -100, w: 10, h: 300 },
      { kind: 'cam', x: this.cam.x + this.cam.halfW - m, y: -100, w: 10, h: 300 },
    ];
  }

  envSolids() {
    const out = [...this.statics, ...this.movers, ...this.blocks];
    for (const g of this.gates) { const r = this.gateRect(g); if (r) out.push(r); }
    return out;
  }

  moveX(e, dx, solids) {
    if (dx === 0) return null;
    let nx = e.x + dx, hit = null;
    for (const s of solids) {
      if (s === e || s.ref === e) continue;
      if (!overlap1D(e.y, e.y + e.h, s.y, s.y + s.h)) continue;
      if (dx > 0 && e.x + e.w <= s.x + SKIN && nx + e.w > s.x) { nx = s.x - e.w; hit = s; }
      else if (dx < 0 && e.x >= s.x + s.w - SKIN && nx < s.x + s.w) { nx = s.x + s.w; hit = s; }
    }
    e.x = nx;
    return hit;
  }

  moveY(e, dy, solids) {
    if (dy === 0) return null;
    let ny = e.y + dy, hit = null;
    for (const s of solids) {
      if (s === e || s.ref === e) continue;
      if (!overlap1D(e.x, e.x + e.w, s.x, s.x + s.w)) continue;
      if (dy > 0 && e.y + e.h <= s.y + SKIN && ny + e.h > s.y) { ny = s.y - e.h; hit = s; }
      else if (dy < 0 && e.y >= s.y + s.h - SKIN && ny < s.y + s.h) { ny = s.y + s.h; hit = s; }
    }
    e.y = ny;
    return hit;
  }

  // Bir sütunda (üst üste binmiş oyuncular dahil) duran aktif oyuncuları sayar.
  countColumn(x0, x1, yBase) {
    let c = 0;
    for (const p of this.active) {
      const cx = p.x + p.w / 2;
      if (cx >= x0 && cx <= x1 && p.y >= yBase - 0.2 && p.y <= yBase + 9) c++;
    }
    return c;
  }

  // ---------------------------------------------------------------- sistemler
  updatePlates() {
    for (const pl of this.plates) {
      const c = this.countColumn(pl.x, pl.x + pl.w, pl.y);
      // üzerindeki bir sandık plakayı tek başına basılı tutar
      const crate = this.blocks.some((b) => {
        const cx = b.x + b.w / 2;
        return cx >= pl.x && cx <= pl.x + pl.w && Math.abs(b.y - pl.y) < 0.2;
      });
      const pressed = crate || c >= pl.req;
      if (pressed && !pl.pressed) this.events.push({ type: 'plate' });
      pl.count = crate ? pl.req : c;
      pl.crate = crate;
      pl.pressed = pressed;
    }
  }

  updateGates(dt) {
    for (const g of this.gates) {
      const want = g.plates.some((id) => this.plates.find((p) => p.id === id)?.pressed) ? 1 : 0;
      if (want > g.open) g.open = Math.min(1, g.open + dt * 2.5);
      else if (want < g.open) {
        const next = Math.max(0, g.open - dt * 2.5);
        let blocked;
        if (g.axis === 'x') {
          // köprü, üstünde biri varken toplanmaz
          const top = g.y + g.h;
          blocked = [...this.active, ...this.blocks].some((e) =>
            Math.abs(e.y - top) < 0.06 && overlap1D(e.x, e.x + e.w, g.x, g.x + g.w * g.open));
        } else {
          const rect = { x: g.x, y: g.y + g.h * next, w: g.w, h: g.h * (1 - next) };
          blocked = [...this.active, ...this.blocks].some((e) => rectsOverlap(e, rect));
        }
        if (!blocked) g.open = next;
      }
    }
  }

  updateMovers(dt) {
    for (const m of this.movers) {
      const [a, b] = m.path;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ox = m.x, oy = m.y;
      if (m.mode === 'loop') {
        if (m.wait > 0) m.wait -= dt;
        else {
          m.t += (m.dir * m.speed * dt) / len;
          if (m.t >= 1) { m.t = 1; m.dir = -1; m.wait = m.pause || 0; }
          if (m.t <= 0) { m.t = 0; m.dir = 1; m.wait = m.pause || 0; }
        }
      } else if (m.mode === 'lift' || m.mode === 'allAboard') {
        // req kadar oyuncu (ya da geride kalanların hepsi) binince kalkar
        const top = m.y + m.h;
        const aboard = this.countColumn(m.x, m.x + m.w, top);
        const passed = this.active.filter((p) => p.x > m.passX).length;
        const total = this.active.length;
        m.aboard = aboard;
        m.need = Math.min(m.req, Math.max(0, total - passed));
        let goal = m.t;                        // yarı doluysa bekle
        if (aboard > 0 && aboard >= m.need) goal = 1;
        else if (aboard === 0) goal = 0;
        const s = (m.speed * dt) / len;
        if (goal > m.t) m.t = Math.min(goal, m.t + s);
        else if (goal < m.t) m.t = Math.max(goal, m.t - s);
      }
      m.x = a[0] + (b[0] - a[0]) * m.t;
      m.y = a[1] + (b[1] - a[1]) * m.t;
      m.dx = m.x - ox;
      m.dy = m.y - oy;

      // Platform, üzerinde durmayan oyuncuya girerse onu iter.
      for (const p of this.active) {
        if (p.groundRef === m || !rectsOverlap(p, m)) continue;
        if (m.dy > 0) p.y = m.y + m.h;
        else if (m.dy < 0) p.y = m.y - p.h;
        else if (m.dx > 0) p.x = m.x + m.w;
        else if (m.dx < 0) p.x = m.x - p.w;
      }
    }
  }

  updateCamera(dt) {
    const act = this.active;
    if (!act.length) return;
    let minX = Infinity, maxX = -Infinity, sum = 0, sumY = 0;
    for (const p of act) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w);
      sum += p.x + p.w / 2; sumY += p.y + p.h / 2;
    }
    const hw = this.cam.halfW;
    let target = sum / act.length;
    const lo = maxX - hw + 0.6, hi = minX + hw - 0.6;
    if (lo <= hi) target = Math.min(hi, Math.max(lo, target));
    else target = (minX + maxX) / 2;
    target = Math.min(this.level.width - hw + 1, Math.max(hw - 1, target));
    this.cam.x += (target - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (sumY / act.length - this.cam.y) * Math.min(1, dt * 3);
    let spread = 0;
    for (const p of act) spread = Math.max(spread, Math.abs(p.y - this.cam.y));
    this.cam.spreadY = spread;
  }

  // Bir hedefi (blok veya oyuncu) d yönünde iten oyuncu zincirini bulur.
  pushChain(target, d) {
    const chain = new Set();
    let frontier = [target];
    while (frontier.length) {
      const next = [];
      for (const t of frontier) {
        for (const p of this.active) {
          if (chain.has(p) || p === t || p.inDir !== d) continue;
          const touching = d > 0 ? Math.abs(p.x + p.w - t.x) < 0.04 : Math.abs(p.x - (t.x + t.w)) < 0.04;
          if (touching && overlap1D(p.y, p.y + p.h, t.y, t.y + t.h)) { chain.add(p); next.push(p); }
        }
      }
      frontier = next;
    }
    return chain;
  }

  updateBlocks(dt) {
    for (const b of this.blocks) {
      const ox = b.x, oy = b.y;
      let dir = 0, best = 0;
      for (const d of [1, -1]) {
        const c = this.pushChain(b, d).size;
        if (c > best) best = c;
        if (c >= b.req) { dir = d; break; }
      }
      b.pushers = best;
      const wasMoving = b.moving;
      b.moving = dir !== 0;
      if (b.moving && !wasMoving) this.events.push({ type: 'blockStart' });
      const others = [...this.envSolids().filter((s) => s !== b)];
      if (dir) {
        const blockers = [...others, ...this.active.filter((p) => p.inDir !== dir)];
        this.moveX(b, dir * CFG.pushSpeed * dt, blockers);
      }
      b.vy = Math.max(-CFG.maxFall, b.vy - CFG.gravity * dt);
      const hit = this.moveY(b, b.vy * dt, others);
      if (hit && b.vy < 0) b.vy = 0;
      b.dx = b.x - ox; b.dy = b.y - oy;
    }
  }

  updatePlayers(dt) {
    const act = this.active.sort((a, b) => a.y - b.y);   // önce alttakiler (taşıyıcılar)
    const env = this.envSolids();
    const walls = this.camWalls();

    for (const p of act) {
      const sx = p.x, sy = p.y;
      const inp = p.inp || NO_INPUT;
      const others = act.filter((q) => q !== p);
      const riders = others.filter((q) => q.groundRef === p);

      // zıplama tamponu ve coyote süresi
      if (inp.jumpPressed) p.jumpBuf = CFG.jumpBuffer; else p.jumpBuf -= dt;
      if (p.grounded) p.coyote = CFG.coyoteTime; else p.coyote -= dt;
      const jumping = p.jumpBuf > 0 && p.coyote > 0;

      // 1) Taşınma: durduğu şey hareket ettiyse onunla birlikte hareket et
      let ref = p.groundRef;
      if (ref && ref.kind === 'player' && ref.entered) ref = p.groundRef = null;
      if (ref) {
        const cdx = ref.kind === 'player' ? ref.lastDx : ref.dx || 0;
        const cdy = ref.kind === 'player' ? ref.lastDy : ref.dy || 0;
        const solids = [...env, ...others].filter((s) => s !== ref && !riders.includes(s));
        if (cdx) this.moveX(p, cdx, [...solids, ...walls]);
        if (cdy && !jumping) this.moveY(p, cdy, solids);
      }

      // 2) Girdi ile yatay hız
      const target = p.inDir * CFG.runSpeed;
      const acc = p.grounded ? CFG.groundAccel : CFG.airAccel;
      if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
      else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
      if (p.inDir) p.facing = p.inDir;

      if (jumping) {
        p.vy = CFG.jumpV; p.jumpBuf = 0; p.coyote = 0; p.grounded = false;
        this.events.push({ type: 'jump', id: p.id });
      }
      if (!inp.jump && p.vy > 0) p.vy -= CFG.gravity * dt * 1.6;   // kısa basış = kısa zıplama
      p.vy = Math.max(-CFG.maxFall, p.vy - CFG.gravity * dt);

      const solidsX = [...env, ...others, ...walls];
      if (this.moveX(p, p.vx * dt, solidsX)) p.vx = 0;

      const solidsY = [...env, ...others.filter((q) => !riders.includes(q))];
      const vyBefore = p.vy;
      const hit = this.moveY(p, p.vy * dt, solidsY);
      const wasGrounded = p.grounded;
      if (hit && p.vy <= 0 && this.slipOffEdge(p, solidsY)) {
        // destek çok darsa kenardan kay: zemin sayılmaz, düşmeye devam eder
        p.grounded = false; p.groundRef = null;
      } else if (hit && p.vy <= 0) {
        p.grounded = true;
        p.groundRef = hit.kind === 'static' || hit.kind === 'gate' ? null : (hit.ref || hit);
        p.vy = 0;
        if (!wasGrounded && vyBefore < -7) { p.landImpact = Math.min(1, -vyBefore / 18); this.events.push({ type: 'land', id: p.id }); }
      } else {
        if (hit && p.vy > 0) p.vy = 0;
        p.grounded = false;
        p.groundRef = null;
      }

      p.lastDx = p.x - sx;
      p.lastDy = p.y - sy;
    }
    for (const p of this.players) if (p.entered) { p.lastDx = 0; p.lastDy = 0; }
    this.separatePlayers(act);
  }

  // Kenar kontrolü: oyuncunun altındaki toplam destek genişliği minSupport'tan azsa
  // oyuncuyu destekten dışarı iter ve true döner (köşede havada durmayı engeller).
  slipOffEdge(p, solids) {
    let lo = Infinity, hi = -Infinity, total = 0;
    for (const s of solids) {
      if (s === p || s.ref === p) continue;
      if (Math.abs(s.y + s.h - p.y) > 0.02) continue;
      const a = Math.max(p.x, s.x), b = Math.min(p.x + p.w, s.x + s.w);
      if (b - a <= EPS) continue;
      total += b - a; lo = Math.min(lo, s.x); hi = Math.max(hi, s.x + s.w);
    }
    if (total <= 0 || total >= CFG.minSupport) return false;
    const pc = p.x + p.w / 2, sc = (lo + hi) / 2;
    const target = pc >= sc ? hi + 0.002 : lo - p.w - 0.002;
    const others = solids.filter((s) => Math.abs(s.y + s.h - p.y) > 0.02);
    this.moveX(p, target - p.x, others);
    const still = solids.some((s) => s !== p && Math.abs(s.y + s.h - p.y) <= 0.02 && overlap1D(p.x, p.x + p.w, s.x, s.x + s.w));
    if (still) return false;           // itilemiyorsa (ör. duvar) olduğu yerde dursun
    p.y -= 0.001;
    return true;
  }

  // Sağlamlık: iç içe geçmiş oyuncuları ayırır (üstteki yukarı, yan yanaysa iki yana).
  separatePlayers(act) {
    for (let i = 0; i < act.length; i++) {
      for (let j = i + 1; j < act.length; j++) {
        const a = act[i], b = act[j];
        if (!rectsOverlap(a, b)) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (oy <= ox) {
          const up = a.y >= b.y ? a : b, dn = up === a ? b : a;
          up.y = dn.y + dn.h; up.vy = Math.max(0, up.vy); up.groundRef = dn; up.grounded = true;
        } else {
          const s = (a.x < b.x ? -1 : 1) * (ox / 2 + 0.001);
          a.x += s; b.x -= s;
        }
      }
    }
  }

  updateKey(dt) {
    const k = this.key;
    if (k.used) return;
    k.cooldown -= dt;
    for (const p of this.active) {
      if (p === k.holder || k.cooldown > 0) continue;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (Math.hypot(cx - k.x, cy - k.y) < 0.75) {
        k.holder = p; k.cooldown = CFG.keyGrabCooldown;
        this.events.push({ type: 'key', id: p.id });
        break;
      }
    }
    const h = k.holder;
    if (h) {
      const tx = h.x + h.w / 2 - h.facing * 0.7, ty = h.y + h.h + 0.15;
      const f = Math.min(1, dt * 10);
      k.x += (tx - k.x) * f; k.y += (ty - k.y) * f;
      if (rectsOverlap(h, this.door)) {
        this.door.unlocked = true; k.used = true; k.holder = null;
        this.events.push({ type: 'unlock' });
      }
    }
  }

  updateDoorEntry() {
    const d = this.door;
    for (const p of this.players) {
      if (!p.inp?.actionPressed) continue;
      if (p.entered) {
        p.entered = false; p.x = d.x + 0.3; p.y = d.y; p.vx = p.vy = 0; p.groundRef = null;
        this.events.push({ type: 'exit', id: p.id });
      } else if (d.unlocked && rectsOverlap(p, d)) {
        p.entered = true; p.groundRef = null;
        for (const q of this.players) if (q.groundRef === p) q.groundRef = null;
        this.events.push({ type: 'enter', id: p.id });
      }
    }
  }

  checkDeath() {
    for (const p of this.active) {
      const hitSpike = this.spikes.some((s) => rectsOverlap(p, { x: s.x + 0.1, y: s.y, w: s.w - 0.2, h: s.h * 0.8 }));
      if (p.y < CFG.deathY || hitSpike) {
        this.status = 'dead'; this.statusTime = 0;
        this.events.push({ type: 'death', id: p.id });
        return;
      }
    }
  }

  checkClear() {
    if (this.players.length && this.players.every((p) => p.entered)) {
      this.status = 'clear'; this.statusTime = 0;
      this.events.push({ type: 'clear' });
    }
  }
}
