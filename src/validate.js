// Bölüm denetçisi: editörde sürekli çalışır, testlerde resmi bölümleri de denetler.
// Sonuç: [{ level: 'error' | 'warn' | 'info', msg, ids: [nesne kimlikleri] }]
// 'error' varken bölüm denenebilir ama paylaşılamaz.
import { CFG } from './config.js';
import { bounds } from './levelmodel.js';

export const PHYS = {
  jump: (CFG.jumpV * CFG.jumpV) / (2 * CFG.gravity),                 // ≈ 2,18 birim
  maxGap: CFG.runSpeed * ((2 * CFG.jumpV) / CFG.gravity) - 0.4,      // ≈ 3,7 birim (güvenli)
  stackReach: (k) => 0.9 * (k - 1) + (CFG.jumpV * CFG.jumpV) / (2 * CFG.gravity),
};

const EPS = 1e-3;
const overlap = (a, b) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
const SOLID_TYPES = new Set(['solid', 'platform', 'block', 'colorgate']);
const SURFACE_TYPES = new Set(['solid', 'platform', 'block', 'mover', 'lift', 'bridge']);

export function validate(doc) {
  const out = [];
  const err = (msg, ids = []) => out.push({ level: 'error', msg, ids });
  const warn = (msg, ids = []) => out.push({ level: 'warn', msg, ids });
  const info = (msg, ids = []) => out.push({ level: 'info', msg, ids });
  const objs = doc.objects;
  const W = doc.meta.width;
  const of = (t) => objs.filter((o) => o.type === t);
  const solids = objs.filter((o) => SOLID_TYPES.has(o.type));

  if (!doc.meta.name?.trim()) warn('Bölümün adı yok.');
  if (!(W >= 16 && W <= 400)) err('Bölüm genişliği 16 ile 400 birim arasında olmalı.');

  for (const t of ['spawn', 'key', 'door']) {
    const n = of(t).length;
    const label = { spawn: 'Başlangıç noktası', key: 'Anahtar', door: 'Kapı' }[t];
    if (n === 0) err(`${label} yok.`);
    if (n > 1) err(`Birden fazla ${label.toLowerCase()} var.`, of(t).map((o) => o.id));
  }

  for (const o of objs) {
    const b = bounds(o);
    if (b.x < -EPS || b.x + b.w > W + EPS) err(`${label(o)} bölümün dışında (0–${W}).`, [o.id]);
    if (b.y < -20 || b.y > 60) err(`${label(o)} çok aşağıda ya da yukarıda.`, [o.id]);
    if ('w' in o && (o.w <= 0.05 || o.h <= 0.05)) err(`${label(o)} çok küçük.`, [o.id]);
  }

  // başlangıç: 8 oyuncunun dizildiği alan boş ve zeminde olmalı
  const spawn = of('spawn')[0];
  if (spawn) {
    const line = { x: spawn.x, y: spawn.y, w: 0.95 * 7 + 0.8, h: 0.9 };
    const hit = solids.filter((s) => overlap(line, bounds(s)));
    if (hit.length) err('Başlangıçta 8 oyuncu yan yana dizilince bir şeyin içinde kalıyor (sağa doğru 7,5 birim boş olmalı).', [spawn.id, ...hit.map((h) => h.id)]);
    if (!supported(line, objs)) warn('Başlangıç noktası havada: oyuncular başlar başlamaz düşebilir.', [spawn.id]);
    if (line.x + line.w > W) err('Başlangıç bölüm sonuna çok yakın: 8 oyuncu sığmıyor.', [spawn.id]);
  }

  const door = of('door')[0];
  if (door) {
    const d = bounds(door);
    const hit = solids.filter((s) => overlap(d, bounds(s)));
    if (hit.length) err('Kapı bir şeyin içinde.', [door.id, ...hit.map((h) => h.id)]);
    if (!supported(d, objs)) warn('Kapı zeminde durmuyor.', [door.id]);
  }

  const key = of('key')[0];
  if (key) {
    const kb = bounds(key);
    const hit = solids.filter((s) => overlap(kb, bounds(s)));
    if (hit.length) err('Anahtar bir şeyin içinde.', [key.id, ...hit.map((h) => h.id)]);
    // Anahtara ulaşmak için kaç kişi üst üste gerekir?
    // Anahtar bir çıkıntının üstündeyse oyuncu o çıkıntıya çıkabilmeli (altından zıplayan başını çarpar);
    // değilse oyuncunun merkezi anahtara 0,75 birim yaklaşabilmeli.
    const below = objs.filter((s) => SURFACE_TYPES.has(s.type) && s.x - 0.4 <= key.x && s.x + s.w + 0.4 >= key.x && s.y + s.h <= key.y + EPS);
    const near = below.filter((s) => s.y + s.h >= key.y - 1.0);
    const far = below.filter((s) => s.y + s.h < key.y - 1.0);
    const farTop = far.length ? Math.max(...far.map((s) => s.y + s.h)) : null;
    const nearTop = near.length ? Math.max(...near.map((s) => s.y + s.h)) : null;
    if (farTop === null && nearTop === null) warn('Anahtarın altında basılacak bir yüzey yok.', [key.id]);
    else if (farTop === null) info('Anahtara tek kişi ulaşabilir.', [key.id]);
    else {
      const reached = (k) => (nearTop !== null ? farTop + PHYS.stackReach(k) >= nearTop - 0.05 : farTop + PHYS.stackReach(k) + 0.45 >= key.y - 0.7);
      let k = 1;
      while (k <= 9 && !reached(k)) k++;
      const crates = of('block').length > 0;
      if (k > 8) err('Anahtar 8 kişi üst üste çıksa bile ulaşılamayacak kadar yüksek.', [key.id]);
      else if (k > 2 && crates) warn(`Sandık kullanılmazsa anahtara ulaşmak için ${k} kişi üst üste gerekiyor. 2 kişiyle bir sandığın basamak olarak işe yaradığından emin olun.`, [key.id]);
      else if (k > 2) warn(`Anahtara ulaşmak için ${k} kişi üst üste gerekiyor: 2 kişiyle oynanamaz (sandık ya da basamak ekleyin).`, [key.id]);
      else info(k === 1 ? 'Anahtara tek kişi zıplayarak ulaşabilir.' : 'Anahtar için 2 kişi üst üste çıkmalı.', [key.id]);
    }
  }

  // plakalar ve kapılar
  const plateIds = new Set(of('plate').map((p) => p.id));
  const linked = new Set();
  for (const g of [...of('gate'), ...of('bridge')]) {
    const ps = (g.plates || []).filter((id) => plateIds.has(id));
    ps.forEach((id) => linked.add(id));
    if (!ps.length) err(`${label(g)} hiçbir plakaya bağlı değil: hiç açılmaz.`, [g.id]);
  }
  for (const p of of('plate')) if (!linked.has(p.id)) warn('Plaka hiçbir şeye bağlı değil.', [p.id]);
  for (const m of [...of('mover'), ...of('lift')]) {
    if (Math.hypot(m.dx, m.dy) < 0.5) err(`${label(m)} yolu çok kısa.`, [m.id]);
    if (!(m.speed > 0)) err(`${label(m)} hızı 0.`, [m.id]);
  }
  for (const b of of('block')) if (!supported(bounds(b), objs)) warn('Sandık havada: başlayınca düşer.', [b.id]);

  // zıplanamayan boşluklar (köprü veya hareketli platform yoksa)
  const surf = objs.filter((s) => s.type === 'solid' || s.type === 'platform').map((s) => ({ s, x0: s.x, x1: s.x + s.w, top: s.y + s.h }));
  for (const a of surf) {
    let best = null;
    for (const b of surf) {
      if (b === a || b.x0 < a.x1 - EPS || Math.abs(b.top - a.top) > 0.6) continue;
      if (!best || b.x0 < best.x0) best = b;
    }
    if (!best) continue;
    const gap = best.x0 - a.x1;
    if (gap <= PHYS.maxGap) continue;
    const blockedBetween = surf.some((c) => c !== a && c !== best && c.x0 < best.x0 && c.x1 > a.x1 && c.top >= a.top - 0.6);
    if (blockedBetween) continue;
    // Boşluğun altında dikensiz bir zemin varsa düşmek ölüm değildir: uyarma.
    const safeAt = (x) => surf.some((c) => c.x0 <= x && c.x1 >= x && c.top < a.top - 0.3
      && !objs.some((k) => k.type === 'spike' && k.x <= x && k.x + k.w >= x && Math.abs(k.y - c.top) < 0.6));
    let safe = true;
    for (let x = a.x1 + 0.25; x < best.x0; x += 0.5) if (!safeAt(x)) { safe = false; break; }
    if (safe) continue;
    const covered = objs.some((o) => (o.type === 'bridge' || o.type === 'mover' || o.type === 'lift')
      && Math.min(o.x, o.x + (o.dx || 0)) <= a.x1 + 1 && Math.max(o.x + o.w, o.x + (o.dx || 0) + o.w) >= best.x0 - 1);
    if (!covered) warn(`${gap.toFixed(1)} birimlik boşluk zıplanamaz (en fazla ${PHYS.maxGap.toFixed(1)}): köprü ya da hareketli platform gerekebilir.`, [a.s.id, best.s.id]);
  }

  if (!out.some((r) => r.level === 'error')) info('Bölüm yapısı geçerli.');
  return out;
}

function supported(rect, objs) {
  return objs.some((s) => SURFACE_TYPES.has(s.type) && Math.abs(s.y + s.h - rect.y) < 0.06 && s.x < rect.x + rect.w - 0.1 && s.x + s.w > rect.x + 0.1);
}

const label = (o) => ({
  solid: 'Zemin', platform: 'Platform', spike: 'Diken', block: 'Sandık', plate: 'Plaka', gate: 'Parmaklık',
  bridge: 'Köprü', mover: 'Hareketli platform', lift: 'Asansör', key: 'Anahtar', door: 'Kapı', spawn: 'Başlangıç',
  colorgate: 'Renkli kapı',
}[o.type] || o.type);

export const hasErrors = (results) => results.some((r) => r.level === 'error');
