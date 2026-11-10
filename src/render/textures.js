// Prosedürel PBR dokuları: dış dosya gerektirmeden ahşap, metal, beton, toprak, çim...
// Her doku bir renk haritası ve aynı tuvalden türetilen bir pürüz (bump) haritası üretir.
import * as THREE from 'three';

// --- tohumlu gürültü
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function makeNoise(seed) {
  const rnd = makeRng(seed);
  const N = 256, perm = new Uint8Array(512), val = new Float32Array(256);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = rnd(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const h = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
  const sm = (t) => t * t * (3 - 2 * t);
  // periyodik (döşenebilir) değer gürültüsü
  const n2 = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const w = (a) => ((a % per) + per) % per;
    const a = h(w(xi), w(yi)), b = h(w(xi + 1), w(yi)), c = h(w(xi), w(yi + 1)), d = h(w(xi + 1), w(yi + 1));
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 4, base = 4) => {
    let sum = 0, amp = 0.5, f = base, norm = 0;
    for (let o = 0; o < oct; o++) { sum += amp * n2(x * f, y * f, f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
}

const SIZE = 256;
function canvasOf(fn, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const noise = makeNoise(seed);
  const rnd = makeRng(seed * 7 + 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x / SIZE, y / SIZE, noise, rnd);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, rnd };
}
const clamp = (v) => Math.max(0, Math.min(255, v));
const shade = (col, k) => [clamp(col[0] * k), clamp(col[1] * k), clamp(col[2] * k)];

const RECIPES = {
  soil: (u, v, n) => {
    const f = n(u, v, 5, 4), p = n(u + 3.1, v + 1.7, 2, 16);
    let k = 0.75 + f * 0.5;
    if (p > 0.72) k *= 1.25; if (p < 0.25) k *= 0.8;
    return shade([104, 74, 50], k);
  },
  grass: (u, v, n) => {
    const f = n(u, v, 5, 4), blade = n(u * 1, v * 0.25 + u * 0.1, 3, 32);
    const k = 0.7 + f * 0.35 + (blade - 0.5) * 0.45;
    const dry = n(u + 9, v + 4, 3, 2);
    return [clamp((62 + dry * 40) * k), clamp(118 * k), clamp((40 + dry * 10) * k)];
  },
  wood: (u, v, n) => {
    const plank = Math.floor(v * 4);
    const off = plank * 0.37;
    const grain = Math.sin((v * 4 - plank) * 30 + n(u * 0.6 + off, v * 2, 3, 4) * 9);
    const f = n(u + off, v, 4, 6);
    let k = 0.78 + grain * 0.07 + f * 0.25 + ((plank * 0.13) % 0.15);
    const seam = (v * 4) % 1;
    if (seam < 0.03 || seam > 0.985) k *= 0.45;
    return shade([152, 104, 64], k);
  },
  darkwood: (u, v, n) => {
    const grain = Math.sin(v * 70 + n(u, v, 3, 4) * 10);
    const k = 0.75 + grain * 0.08 + n(u, v, 4, 6) * 0.3;
    return shade([92, 60, 38], k);
  },
  metal: (u, v, n) => {
    const streak = n(u * 0.05, v * 6, 3, 8);
    const f = n(u, v, 4, 4);
    const k = 0.82 + streak * 0.18 + (f - 0.5) * 0.12;
    return shade([150, 155, 160], k);
  },
  darkmetal: (u, v, n) => {
    const k = 0.8 + n(u * 0.1, v * 4, 3, 8) * 0.2 + (n(u, v, 4, 4) - 0.5) * 0.15;
    return shade([72, 76, 82], k);
  },
  rust: (u, v, n) => {
    const r = n(u, v, 5, 3);
    const base = r > 0.55 ? [140, 72, 40] : [95, 92, 90];
    const k = 0.75 + n(u + 2, v + 5, 4, 8) * 0.4;
    return shade(base, k);
  },
  concrete: (u, v, n, rnd) => {
    const f = n(u, v, 5, 4);
    let k = 0.78 + f * 0.3;
    const sp = rnd();
    if (sp > 0.985) k *= 0.6; else if (sp < 0.01) k *= 1.15;
    return shade([168, 164, 156], k);
  },
  bark: (u, v, n) => {
    const s = n(u * 6, v * 0.6, 4, 4);
    const k = 0.6 + s * 0.6;
    return shade([88, 64, 46], k);
  },
  hazard: (u, v, n) => {
    const stripe = ((u + v) * 4) % 1 < 0.5;
    const base = stripe ? [228, 178, 32] : [34, 32, 30];
    const grime = n(u, v, 4, 4);
    return shade(base, 0.7 + grime * 0.35);
  },
  pegboard: (u, v, n) => {
    const gx = (u * 16) % 1, gy = (v * 16) % 1;
    const hole = (gx - 0.5) ** 2 + (gy - 0.5) ** 2 < 0.02;
    const k = 0.85 + n(u, v, 4, 4) * 0.25;
    return hole ? [30, 24, 18] : shade([176, 140, 98], k);
  },
  crate: (u, v, n) => {
    const border = u < 0.09 || u > 0.91 || v < 0.09 || v > 0.91;
    const diag = Math.abs(u - v) < 0.07;
    const grain = Math.sin(v * 50 + n(u, v, 3, 4) * 8);
    let k = 0.8 + grain * 0.06 + n(u, v, 4, 6) * 0.25;
    if (border || diag) k *= 0.78;
    if (Math.abs(u - 0.09) < 0.008 || Math.abs(u - 0.91) < 0.008 || Math.abs(v - 0.09) < 0.008 || Math.abs(v - 0.91) < 0.008) k *= 0.5;
    return shade([170, 122, 72], k);
  },
  foliage: (u, v, n) => {
    const f = n(u, v, 5, 6);
    return shade([58, 104, 44], 0.6 + f * 0.6);
  },
  snow: (u, v, n, rnd) => {
    const f = n(u, v, 5, 4), sp = rnd();
    const k = 0.9 + f * 0.12 + (sp > 0.995 ? 0.08 : 0);
    return [clamp(232 * k), clamp(238 * k), clamp(246 * k)];
  },
  rubber: (u, v, n) => {
    const k = 0.75 + n(u, v, 4, 8) * 0.3;
    const rib = (v * 16) % 1 < 0.12 ? 0.7 : 1;
    return shade([46, 48, 52], k * rib);
  },
  asphalt: (u, v, n, rnd) => {
    const k = 0.75 + n(u, v, 5, 6) * 0.35 + (rnd() - 0.5) * 0.12;
    return shade([66, 66, 70], k);
  },
};

const cache = new Map();
export function getTexture(kind, seed = 1) {
  const key = kind + ':' + seed;
  if (cache.has(key)) return cache.get(key);
  const { c } = canvasOf(RECIPES[kind], seed * 31 + kind.length);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const out = { map, bump };
  cache.set(key, out);
  return out;
}

const PBR = {
  soil: { roughness: 0.95, metalness: 0, bump: 2.5 },
  grass: { roughness: 0.9, metalness: 0, bump: 2 },
  wood: { roughness: 0.65, metalness: 0, bump: 1.5 },
  darkwood: { roughness: 0.6, metalness: 0, bump: 1.2 },
  metal: { roughness: 0.38, metalness: 0.85, bump: 0.6 },
  darkmetal: { roughness: 0.45, metalness: 0.8, bump: 0.6 },
  rust: { roughness: 0.8, metalness: 0.45, bump: 2 },
  concrete: { roughness: 0.92, metalness: 0, bump: 2 },
  bark: { roughness: 0.95, metalness: 0, bump: 3 },
  hazard: { roughness: 0.6, metalness: 0.3, bump: 0.8 },
  pegboard: { roughness: 0.85, metalness: 0, bump: 1 },
  crate: { roughness: 0.7, metalness: 0, bump: 1.5 },
  foliage: { roughness: 0.85, metalness: 0, bump: 1 },
  asphalt: { roughness: 0.9, metalness: 0, bump: 2 },
  snow: { roughness: 0.85, metalness: 0, bump: 1.2 },
  rubber: { roughness: 0.8, metalness: 0, bump: 1.5 },
};

const matCache = new Map();
export function getMaterial(kind, opts = {}) {
  const key = kind + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const t = getTexture(kind, opts.seed || 1);
  const p = PBR[kind];
  const m = new THREE.MeshStandardMaterial({
    map: t.map, bumpMap: t.bump, bumpScale: p.bump,
    roughness: opts.roughness ?? p.roughness, metalness: opts.metalness ?? p.metalness,
    color: opts.color ? new THREE.Color(opts.color) : 0xffffff,
  });
  matCache.set(key, m);
  return m;
}

// Kutu geometrisinin UV'lerini dünya ölçüsüne göre ölçekler: doku uzamaz, tekrar eder.
export function worldBox(w, h, d, texPerUnit = 0.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // yüz sırası: +x, -x, +y, -y, +z, -z (her yüz 4 köşe)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * dims[f][0] * texPerUnit, uv.getY(idx) * dims[f][1] * texPerUnit);
    }
  }
  return g;
}

// Sayı / yazı etiketi dokusu (sandık, plaka, asansör)
export function labelTexture(text, { fg = '#fff', bg = 'rgba(0,0,0,0)', size = 128, font = 'bold 84px system-ui, sans-serif', w } = {}) {
  const c = document.createElement('canvas');
  c.width = w || size; c.height = size;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (t, color = fg, back = bg) => {
    ctx.clearRect(0, 0, c.width, c.height);
    if (back !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = back;
      const r = 22;
      ctx.beginPath(); ctx.roundRect(6, 6, c.width - 12, c.height - 12, r); ctx.fill();
    }
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(t, c.width / 2, c.height / 2 + 4);
    tex.needsUpdate = true;
  };
  draw(text);
  tex.userData.draw = draw;
  return tex;
}
