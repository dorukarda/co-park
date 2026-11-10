// Bölümü bağlantıya gömme: JSON → (deflate) → base64url. Sunucu gerektirmez.
// 'z' öneki: sıkıştırılmış; 'j' öneki: sıkıştırılmamış (CompressionStream olmayan tarayıcılar için).

const toB64u = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

async function pipe(bytes, Stream, fmt) {
  const stream = new Blob([bytes]).stream().pipeThrough(new Stream(fmt));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeLevel(level) {
  const bytes = new TextEncoder().encode(JSON.stringify(level));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'z' + toB64u(await pipe(bytes, CompressionStream, 'deflate-raw')); } catch { /* sıkıştırmasız devam */ }
  }
  return 'j' + toB64u(bytes);
}

export async function decodeLevel(code) {
  const kind = code[0], body = code.slice(1);
  let bytes = fromB64u(body);
  if (kind === 'z') bytes = await pipe(bytes, DecompressionStream, 'deflate-raw');
  else if (kind !== 'j') throw new Error('Tanınmayan bölüm kodu');
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Paylaşılan bölüm verisini güvenli biçime getirir (beklenmeyen alanları atar, sayıları denetler).
export function sanitizeLevel(L) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const rect = (r) => (Array.isArray(r) ? r.slice(0, 4).map(num) : null);
  const rr = (r) => (Array.isArray(r) ? rect(r) : r && Array.isArray(r.r)
    ? { r: rect(r.r), ...(r.surface === 'ice' || r.surface === 'conveyor' ? { surface: r.surface, speed: num(r.speed) } : {}), ...(r.oneway ? { oneway: true } : {}) }
    : null);
  const req = (v) => (v === 'all' || v === 'half' ? v : Math.max(1, Math.min(8, Math.round(num(v)) || 1)));
  const str = (v, n) => String(v ?? '').slice(0, n);
  const pt = (p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : [0, 0]);
  const themes = ['park', 'workshop', 'construction', 'winter'];
  return {
    schema: num(L.schema) || 1, id: 'custom', world: 'Özel bölüm',
    name: str(L.name, 60) || 'Adsız bölüm', hint: str(L.hint, 200),
    theme: themes.includes(L.theme) ? L.theme : 'park',
    width: Math.max(16, Math.min(400, num(L.width))),
    spawn: pt(L.spawn), key: pt(L.key), door: pt(L.door),
    solids: (L.solids || []).map(rr).filter(Boolean).slice(0, 400),
    platforms: (L.platforms || []).map(rr).filter(Boolean).slice(0, 400),
    spikes: (L.spikes || []).map(rect).filter(Boolean).slice(0, 400),
    blocks: (L.blocks || []).slice(0, 40).map((b) => ({ x: num(b.x), y: num(b.y), w: num(b.w), h: num(b.h), req: req(b.req) })),
    plates: (L.plates || []).slice(0, 40).map((p) => ({ id: str(p.id, 24), x: num(p.x), y: num(p.y), w: num(p.w), req: req(p.req), ...(p.timer ? { timer: Math.max(1, Math.min(30, num(p.timer))) } : {}) })),
    gates: (L.gates || []).slice(0, 40).map((g) => ({ x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h), plates: (g.plates || []).map((x) => str(x, 24)), ...(g.axis === 'x' ? { axis: 'x' } : {}) })),
    colorGates: (L.colorGates || []).slice(0, 40).map((c) => ({ x: num(c.x), y: num(c.y), w: num(c.w), h: num(c.h), who: Math.max(1, Math.min(8, Math.round(num(c.who)) || 1)) })),
    movers: (L.movers || []).slice(0, 40).map((m) => ({
      path: [pt(m.path?.[0]), pt(m.path?.[1])], w: num(m.w), h: num(m.h), speed: Math.max(0.2, Math.min(10, num(m.speed) || 2)),
      ...(m.mode === 'lift' ? { mode: 'lift', req: req(m.req), passX: num(m.passX) } : { mode: 'loop', pause: Math.max(0, Math.min(10, num(m.pause))) }),
    })),
  };
}
