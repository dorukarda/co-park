// Çevrim içi bağlantı katmanı (ÇO-02, ÇO-05, ÇO-11).
// PeerJS ile WebRTC eşler arası bağlantı: host oyunu çalıştırır, istemciler girdi gönderir.
// Eşleştirme (signaling) varsayılan olarak PeerJS'in ücretsiz bulut sunucusu üzerinden yapılır;
// URL'ye ?server=alanadi:port eklenerek kendi PeerJS sunucunuz kullanılabilir.
// Herkese açık eşleştirme yoktur: yalnızca oda kodunu bilenler katılabilir.
import { Peer } from 'peerjs';

export const NET_VERSION = 3;                         // ağ protokolü sürümü
export const APP_VERSION = __APP_VERSION__;           // oyun sürümü (package.json)
export const PAGES_URL = 'https://dorukarda.github.io/co-park/';
const PREFIX = 'copark-v2-';               // oda adı öneki: sürümden bağımsız; sürüm kontrolü 'hello' ile yapılır
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // karışan karakterler yok (0/O, 1/I/L)
const TIMEOUT_MS = 15000;

export function makeCode() {
  let c = '';
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}
// WebRTC bu sayfada gerçekten kullanılabilir mi? (claude.ai gibi korumalı çerçevelerde kapalıdır)
export function rtcAvailable() {
  try {
    if (typeof RTCPeerConnection === 'undefined') return false;
    const pc = new RTCPeerConnection();
    pc.close();
    return true;
  } catch { return false; }
}
export const isEmbedded = () => { try { return window.self !== window.top; } catch { return true; } };

export const normalizeCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function peerOptions() {
  const q = new URLSearchParams(location.search);
  const opts = { debug: 1 };
  const srv = q.get('server');
  if (srv) {
    const [host, port] = srv.split(':');
    opts.host = host;
    opts.port = Number(port || 443);
    opts.path = q.get('path') || '/';
    opts.secure = q.has('secure') ? q.get('secure') !== '0' : !(host === 'localhost' || host === '127.0.0.1');
  }
  return opts;
}

const ERR_TR = {
  'peer-unavailable': 'Oda bulunamadı. Kodu kontrol edin; host hâlâ lobide mi?',
  'network': 'Eşleştirme sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin.',
  'server-error': 'Eşleştirme sunucusu yanıt vermedi. Biraz sonra tekrar deneyin.',
  'browser-incompatible': 'Çevrim içi bağlantı bu görünümde kapalı. Oyunu bilgisayarınızdaki CO-PARK-demo.html dosyasına çift tıklayarak Chrome, Edge veya Firefox ile açın.',
  'socket-error': 'Eşleştirme sunucusuyla bağlantı koptu.',
  'socket-closed': 'Eşleştirme sunucusuyla bağlantı kapandı.',
  'webrtc': 'Doğrudan bağlantı kurulamadı (ağ/güvenlik duvarı).',
};
export const errorText = (e) => ERR_TR[e?.type] || `Bağlantı hatası: ${e?.message || e}`;

// ------------------------------------------------------------ HOST
export class NetHost {
  constructor(h) {
    this.h = h;                // { onOpen(code), onJoin(id), onMessage(id,msg), onLeave(id), onError(err) }
    this.conns = new Map();    // peerId -> { conn, last }
    this.closed = false;
  }

  start(maxClients = 7, tries = 0) {
    if (!rtcAvailable()) { this.h.onError({ type: 'browser-incompatible' }); return; }
    this.code = makeCode();
    this.maxClients = maxClients;
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on('open', () => this.h.onOpen(this.code));
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); this.start(maxClients, tries + 1); return; }
      if (e.type === 'peer-unavailable') return;
      this.h.onError(e);
    });
    peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });   // signaling koptu; açık oyunlar sürer
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.conns.size >= this.maxClients) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
        this.conns.set(conn.peer, { conn, last: performance.now() });
        this.h.onJoin(conn.peer);
      });
      conn.on('data', (d) => {
        const c = this.conns.get(conn.peer);
        if (!c) return;
        c.last = performance.now();
        this.h.onMessage(conn.peer, d);
      });
      const gone = () => { if (this.conns.delete(conn.peer)) this.h.onLeave(conn.peer); };
      conn.on('close', gone);
      conn.on('error', gone);
    });
    this.watch = setInterval(() => {
      const now = performance.now();
      for (const [id, c] of this.conns) if (now - c.last > TIMEOUT_MS) { c.conn.close(); if (this.conns.delete(id)) this.h.onLeave(id); }
    }, 1000);
  }

  send(id, msg) { const c = this.conns.get(id); if (c && c.conn.open) c.conn.send(msg); }
  broadcast(msg) { for (const { conn } of this.conns.values()) if (conn.open) conn.send(msg); }
  kick(id) { const c = this.conns.get(id); if (c) { c.conn.close(); this.conns.delete(id); } }
  get clientCount() { return this.conns.size; }

  close() {
    this.closed = true;
    clearInterval(this.watch);
    for (const { conn } of this.conns.values()) conn.close();
    this.conns.clear();
    this.peer?.destroy();
  }
}

// ------------------------------------------------------------ İSTEMCİ
export class NetClient {
  constructor(h) {
    this.h = h;                // { onOpen(), onMessage(msg), onClose(reason), onError(err) }
    this.closed = false;
    this.last = performance.now();
  }

  join(code) {
    if (!rtcAvailable()) { this.h.onError({ type: 'browser-incompatible' }); return; }
    this.code = normalizeCode(code);
    const peer = new Peer(undefined, peerOptions());
    this.peer = peer;
    peer.on('error', (e) => { if (!this.closed) this.h.onError(e); });
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      const t = setTimeout(() => { if (!conn.open && !this.closed) this.h.onError({ type: 'webrtc' }); }, 15000);
      conn.on('open', () => { clearTimeout(t); this.last = performance.now(); this.h.onOpen(); });
      conn.on('data', (d) => { this.last = performance.now(); this.h.onMessage(d); });
      conn.on('close', () => this.end('Host bağlantıyı kapattı.'));
      conn.on('error', () => this.end('Bağlantı hatası.'));
    });
    this.watch = setInterval(() => {
      if (this.conn?.open && performance.now() - this.last > TIMEOUT_MS) this.end('Host yanıt vermiyor (zaman aşımı).');
    }, 1000);
  }

  end(reason) {
    if (this.closed) return;
    this.close();
    this.h.onClose(reason);
  }

  send(msg) { if (this.conn?.open) this.conn.send(msg); }

  close() {
    this.closed = true;
    clearInterval(this.watch);
    this.conn?.close();
    this.peer?.destroy();
  }
}
