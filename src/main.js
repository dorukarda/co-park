import './style.css';
import { CFG, PLAYER_COLORS } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './world.js';
import { Input, deviceLabel } from './input.js';
import { GameRenderer } from './render/renderer.js';
import { Sfx } from './audio.js';
import { NetHost, NetClient, NET_VERSION, APP_VERSION, PAGES_URL, errorText, normalizeCode, rtcAvailable, isEmbedded } from './net.js';
import { encodeSnapshot, applySnapshot, interpolate, NET_EVENTS } from './sync.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game');
const input = new Input();
const gfx = new GameRenderer(canvas);
const sfx = new Sfx();

// ------------------------------------------------------------ durum
let mode = 'lobby';            // lobby | play | pause | end
let role = 'local';            // local | host | client
let host = null, client = null;
let menuOpen = false;          // çevrim içi menü (oyun durmaz)
let slots = [];                // { device, color, owner }  owner: 'host' veya istemcinin peer kimliği
let levelIndex = 0;
let world = null;
let acc = 0;
let hintTimer = 0;
let stats = { deaths: 0, time: 0 };

// ağ: host tarafı
const remoteInputs = {};       // owner -> device -> [l, r, j, a, jumpCount, actionCount]
const seenCounts = {};         // `${owner}|${device}` -> { jc, ac }
let pendingEvents = [];
let snapAcc = 0;
// ağ: istemci tarafı
let myId = null;
const snaps = [];              // { t, s }
const counters = {};           // device -> { jc, ac }
let inputAcc = 0, lastInputMsg = '';
let chipSig = '';

const online = () => role !== 'local';
const mine = (s) => (role === 'client' ? s.owner === myId : s.owner === 'host');

// ------------------------------------------------------------ yardımcı arayüz
let toastTimer = 0;
function toast(msg, dur = 3) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); toastTimer = dur; }

function setNetUI() {
  const box = $('#net-box'), pick = $('#online-pick');
  box.classList.toggle('hidden', !online());
  pick.classList.toggle('hidden', online());
  $('#start-btn').classList.toggle('hidden', role === 'client');
  $('#wait-msg').classList.toggle('hidden', role !== 'client');
  $('#lobby-note').classList.toggle('hidden', role === 'client');
  $('#btn-copy').classList.toggle('hidden', role !== 'host' || !host?.code);
  $('#btn-invite').classList.toggle('hidden', role !== 'host' || !host?.code || !/^https?:/.test(location.protocol));
  $('#btn-leave').textContent = role === 'host' ? 'Odayı kapat' : 'Odadan çık';
  $('#btn-pause-lobby').classList.toggle('hidden', role === 'client');
  $('#btn-pause-leave').classList.toggle('hidden', role !== 'client');
  $('#pause-levels').classList.toggle('hidden', role === 'client');
  $('#pause-title').textContent = online() ? 'Menü (oyun sürüyor)' : 'Duraklatıldı';
  $('#btn-again').classList.toggle('hidden', role === 'client');
  $('#btn-end-lobby').classList.toggle('hidden', role === 'client');
  $('#end-wait').classList.toggle('hidden', role !== 'client');
}
function netStatus(text) { $('#net-status').textContent = text; }
function netError(text) { const e = $('#net-error'); e.textContent = text || ''; e.classList.toggle('hidden', !text); }

function hudNet() {
  const el = $('#hud-net');
  if (role === 'host') el.textContent = `Çevrim içi · Oda ${host.code || '…'} · ${host.clientCount} bağlı`;
  else if (role === 'client') el.textContent = `Çevrim içi · Oda ${client.code}`;
  else el.textContent = '';
  $('#hud-bottom').textContent = role === 'client' ? 'R: yeniden başlatma iste · Esc: menü' : 'R: yeniden başlat · Esc: menü';
}

// ------------------------------------------------------------ lobi
function ownerLabel(s) {
  if (role === 'local') return deviceLabel(s.device);
  if (mine(s)) return `Sen · ${deviceLabel(s.device)}`;
  return s.owner === 'host' ? 'Host' : 'Uzak oyuncu';
}

function renderSlots() {
  const el = $('#slots');
  el.innerHTML = '';
  for (let i = 0; i < CFG.maxPlayers; i++) {
    const s = slots[i];
    const d = document.createElement('div');
    if (s) {
      const c = PLAYER_COLORS[s.color];
      d.className = 'slot on';
      d.style.background = c.hex;
      d.innerHTML = `<div class="num">${s.color + 1}</div><div>${c.name}</div><div class="owner">${ownerLabel(s)}</div>`;
    } else {
      d.className = 'slot';
      d.innerHTML = `<div style="opacity:.5">Oyuncu ${i + 1}<br>bekleniyor</div>`;
    }
    el.appendChild(d);
  }
}

function freeColor() {
  for (let i = 0; i < PLAYER_COLORS.length; i++) if (!slots.some((s) => s.color === i)) return i;
  return 0;
}

function addSlot(device, owner) {
  if (slots.length >= CFG.maxPlayers || slots.some((s) => s.device === device && s.owner === owner)) return false;
  slots.push({ device, color: freeColor(), owner });
  return true;
}

function lobbyUpdate(st) {
  for (const [dev, s] of Object.entries(st)) {
    if (!(s.jumpPressed || s.actionPressed)) continue;
    if (role === 'client') {
      if (!slots.some((x) => x.owner === myId && x.device === dev)) client.send({ t: 'join', device: dev });
    } else if (addSlot(dev, 'host')) {
      sfx.play('join', slots.length - 1);
      renderSlots();
      broadcastLobby();
    }
  }
  if (input.keyPressed('Backspace')) {
    const own = slots.filter(mine);
    const last = own[own.length - 1];
    if (last) {
      if (role === 'client') client.send({ t: 'leave', device: last.device });
      else { slots.splice(slots.indexOf(last), 1); renderSlots(); broadcastLobby(); }
    }
  }
  const start = input.keyPressed('Enter') || input.keyPressed('NumpadEnter') || Object.values(st).some((s) => s.startPressed);
  if (start && role !== 'client') startGame();
}

function showLobby() {
  mode = 'lobby'; menuOpen = false;
  $('#lobby').classList.remove('hidden');
  $('#pause').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#hud').classList.add('hidden');
  $('#banner').classList.add('hidden');
  $('#flash').style.opacity = 0;
  world = new World(LEVELS[0], []);
  gfx.buildLevel(LEVELS[0], world);
  setNetUI();
  renderSlots();
  broadcastLobby();
}

function startGame() {
  if (!slots.length) {
    if (online()) { toast('Önce en az bir oyuncu katılmalı (W / ↑ / A).'); return; }
    slots = [{ device: 'k1', color: 0, owner: 'host' }, { device: 'k2', color: 1, owner: 'host' }];
  }
  stats = { deaths: 0, time: 0 };
  $('#lobby').classList.add('hidden');
  loadLevel(0);
}

// ------------------------------------------------------------ bölüm
function loadLevel(i) {
  levelIndex = i;
  const L = LEVELS[i];
  world = new World(L, slots);
  gfx.buildLevel(L, world);
  mode = 'play'; menuOpen = false;
  acc = 0; snaps.length = 0; chipSig = '';
  $('#lobby').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#pause').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#flash').style.opacity = 0;
  $('#hud-world').textContent = `${L.world} · Bölüm ${i + 1}/${LEVELS.length}`;
  $('#hud-level').textContent = L.name;
  $('#hud-hint').textContent = L.hint;
  $('#hud-hint').classList.remove('fade');
  hintTimer = 12;
  banner(L.name, 1.6);
  renderChips();
  hudNet();
  setNetUI();
  canvas.focus();
  if (role === 'host') host.broadcast({ t: 'level', i, slots });
}

let bannerTimer = 0;
function banner(text, dur = 1.6) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  bannerTimer = dur;
}

function renderChips() {
  const sig = world.players.map((p) => `${p.entered ? 1 : 0}${world.key.holder === p ? 1 : 0}`).join('');
  if (sig === chipSig) return;
  chipSig = sig;
  const el = $('#hud-players');
  el.innerHTML = '';
  world.players.forEach((p) => {
    const c = PLAYER_COLORS[p.slot.color];
    const d = document.createElement('div');
    d.className = 'chip' + (p.entered ? ' in' : '');
    d.style.background = c.hex;
    d.style.color = '#111';
    d.title = online() ? ownerLabel(p.slot) : c.name;
    d.innerHTML = `${p.slot.color + 1}${world.key.holder === p ? '<span class="k">🔑</span>' : ''}`;
    el.appendChild(d);
  });
}

function handleEvents(events) {
  for (const e of events) {
    sfx.play(e.type, e.id);
    gfx.onEvent(e, world);
    if (e.type === 'death') { stats.deaths++; banner('Ah! Baştan…', 0.9); $('#flash').style.opacity = 0.45; }
    if (e.type === 'unlock') banner('Kapı açıldı!', 1.2);
    if (e.type === 'clear') banner('Bölüm tamamlandı!', 2.4);
  }
  renderChips();
}

// Host / yerel: dünyayı simüle et
function simulate(dt, st) {
  const inputs = {};
  world.players.forEach((p) => {
    const s = p.slot;
    if (s.owner === 'host') { inputs[p.id] = menuOpen ? {} : { ...(st[s.device] || {}) }; return; }
    const a = remoteInputs[s.owner]?.[s.device];
    if (!a) { inputs[p.id] = {}; return; }
    const key = s.owner + '|' + s.device;
    const seen = seenCounts[key] || (seenCounts[key] = { jc: a[4], ac: a[5] });
    inputs[p.id] = { left: !!a[0], right: !!a[1], jump: !!a[2], action: !!a[3], jumpPressed: a[4] > seen.jc, actionPressed: a[5] > seen.ac };
    seen.jc = a[4]; seen.ac = a[5];
  });

  acc += dt;
  let first = true;
  while (acc >= CFG.fixedStep) {
    world.step(CFG.fixedStep, inputs);
    if (first) { for (const k in inputs) { inputs[k].jumpPressed = false; inputs[k].actionPressed = false; } first = false; }
    acc -= CFG.fixedStep;
  }
  const evs = world.events.splice(0);
  if (role === 'host') for (const e of evs) if (NET_EVENTS.has(e.type)) pendingEvents.push({ type: e.type, id: e.id });
  handleEvents(evs);
  if (world.status === 'play') stats.time += dt;

  if (world.status === 'dead' && world.statusTime > 0.9) {
    world.reset();
    $('#flash').style.opacity = 0;
    chipSig = ''; renderChips();
  }
  if (world.status === 'clear' && world.statusTime > 2.6) {
    if (levelIndex + 1 < LEVELS.length) loadLevel(levelIndex + 1);
    else showEnd();
    return;
  }

  if (role === 'host') {
    snapAcc += dt;
    if (snapAcc >= 1 / 30) {
      snapAcc = 0;
      host.broadcast(encodeSnapshot(world, levelIndex, pendingEvents));
      pendingEvents = [];
    }
  }
}

// İstemci: görüntüleri uygula, girdileri gönder
function clientPlay(dt) {
  const now = performance.now();
  const renderT = now - 90;
  while (snaps.length > 2 && snaps[1].t <= renderT) snaps.shift();
  const latest = snaps[snaps.length - 1];
  if (latest) {
    applySnapshot(world, latest.s);
    if (snaps.length >= 2 && snaps[0].t <= renderT) {
      const a = snaps[0], b = snaps[1];
      const t = Math.min(1, Math.max(0, (renderT - a.t) / Math.max(1, b.t - a.t)));
      interpolate(world, a.s, b.s, t);
    }
    if (world.status === 'play') $('#flash').style.opacity = 0;
  }
  renderChips();
  if (world.status === 'play') stats.time += dt;
}

function sendClientInput(dt, st) {
  if (role !== 'client' || !client) return;
  const d = {};
  for (const s of slots) {
    if (s.owner !== myId) continue;
    const dev = st[s.device] || {};
    const c = counters[s.device] || (counters[s.device] = { jc: 0, ac: 0 });
    if (!menuOpen && dev.jumpPressed) c.jc++;
    if (!menuOpen && dev.actionPressed) c.ac++;
    const on = (k) => (!menuOpen && dev[k] ? 1 : 0);
    d[s.device] = [on('left'), on('right'), on('jump'), on('action'), c.jc, c.ac];
  }
  const msg = JSON.stringify(d);
  inputAcc += dt;
  if (msg !== lastInputMsg || inputAcc > 0.25) {
    client.send({ t: 'in', d });
    lastInputMsg = msg; inputAcc = 0;
  }
}

function playUpdate(dt, st) {
  const menuKey = input.keyPressed('Escape') || Object.values(st).some((s) => s.startPressed);
  if (online()) {
    if (menuKey) { menuOpen = !menuOpen; $('#pause').classList.toggle('hidden', !menuOpen); }
  } else if (menuKey) { openPause(); return; }

  if (input.keyPressed('KeyR')) requestRestart();
  if (input.keyPressed('KeyL') && role !== 'client') { showLobby(); return; }

  if (role === 'client') { sendClientInput(dt, st); clientPlay(dt); }
  else simulate(dt, st);

  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('#hud-hint').classList.add('fade'); }
}

function requestRestart() {
  if (role === 'client') { client.send({ t: 'restart' }); return; }
  world.reset(); chipSig = ''; renderChips();
  if (menuOpen) { menuOpen = false; $('#pause').classList.add('hidden'); }
}

// ------------------------------------------------------------ menüler
function openPause() { mode = 'pause'; $('#pause').classList.remove('hidden'); }
function closePause() {
  if (online()) menuOpen = false; else mode = 'play';
  $('#pause').classList.add('hidden'); canvas.focus();
}

function showEnd() {
  mode = 'end'; menuOpen = false;
  $('#hud').classList.add('hidden');
  $('#pause').classList.add('hidden');
  $('#end').classList.remove('hidden');
  const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
  $('#end-stats').textContent = `Süre: ${m} dk ${s} sn · Düşme: ${stats.deaths}`;
  setNetUI();
  if (role === 'host') host.broadcast({ t: 'end', stats });
}

function buildLevelButtons() {
  const el = $('#pause-levels');
  el.innerHTML = '';
  let w = '';
  LEVELS.forEach((L, i) => {
    if (L.world !== w) { w = L.world; const h = document.createElement('div'); h.className = 'w'; h.textContent = `${L.world} · ${L.name.split(' — ')[0]}`; el.appendChild(h); }
    const b = document.createElement('button');
    b.dataset.act = 'lv' + i;
    b.textContent = String(i + 1);
    b.title = L.name;
    el.appendChild(b);
  });
}

// ------------------------------------------------------------ ağ: host
function broadcastLobby() {
  if (role === 'host') host.broadcast({ t: 'lobby', slots, mode });
}

function startHosting() {
  netError('');
  role = 'host';
  // mevcut yerel oyuncular host'a ait olur
  slots.forEach((s) => { s.owner = 'host'; });
  host = new NetHost({
    onOpen: (code) => {
      $('#net-code').innerHTML = `Oda kodu<b>${code}</b>`;
      netStatus('Bu kodu arkadaşlarınıza gönderin. Onlar "Odaya katıl" ile bağlanır.');
      setNetUI();
    },
    onJoin: (id) => {
      toast('Bir oyuncu odaya bağlandı.');
      if (mode === 'lobby') host.send(id, { t: 'lobby', slots, mode });
      else host.send(id, { t: 'level', i: levelIndex, slots, spectate: true });
      netStatus(`${host.clientCount} bilgisayar bağlı.`);
    },
    onMessage: (id, m) => hostMessage(id, m),
    onLeave: (id) => {
      delete remoteInputs[id];
      const had = slots.some((s) => s.owner === id);
      slots = slots.filter((s) => s.owner !== id);
      for (const k of Object.keys(seenCounts)) if (k.startsWith(id + '|')) delete seenCounts[k];
      netStatus(`${host.clientCount} bilgisayar bağlı.`);
      if (!had) return;
      toast('Bir oyuncu ayrıldı.');
      if (mode === 'lobby') { renderSlots(); broadcastLobby(); }
      else if (slots.length) loadLevel(levelIndex);   // kalanlarla bölüm yeniden ölçeklenir
      else showLobby();
    },
    onError: (e) => { netError(errorText(e)); if (!host?.peer?.open || e.type === 'browser-incompatible') stopOnline(true); },
  });
  host.start(CFG.maxPlayers - 1);
  $('#net-code').innerHTML = 'Oda açılıyor…';
  netStatus('Eşleştirme sunucusuna bağlanılıyor.');
  setNetUI();
  renderSlots();
}

function hostMessage(id, m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'hello':
      if (m.v !== NET_VERSION || m.app !== APP_VERSION) {
        host.send(id, { t: 'error', msg: `Sürümler farklı: host v${APP_VERSION}, sizde v${m.app || '?'}. Aynı sürümü kullanın: ${PAGES_URL}` });
        setTimeout(() => host.kick(id), 500);
      }
      break;
    case 'join':
      if (mode !== 'lobby') { host.send(id, { t: 'info', msg: 'Oyun sürüyor. Host lobiye dönünce katılabilirsiniz.' }); break; }
      if (typeof m.device === 'string' && m.device.length < 12 && addSlot(m.device, id)) {
        sfx.play('join', slots.length - 1); renderSlots(); broadcastLobby();
      } else if (slots.length >= CFG.maxPlayers) host.send(id, { t: 'info', msg: 'Oda dolu (8 oyuncu).' });
      break;
    case 'leave': {
      if (mode !== 'lobby') break;
      const i = slots.findIndex((s) => s.owner === id && s.device === m.device);
      if (i >= 0) { slots.splice(i, 1); renderSlots(); broadcastLobby(); }
      break;
    }
    case 'in':
      if (m.d && typeof m.d === 'object') remoteInputs[id] = m.d;
      break;
    case 'restart':
      if (mode === 'play' && world.status === 'play') { world.reset(); chipSig = ''; toast('Bir oyuncu bölümü yeniden başlattı.', 2); }
      break;
    default: break;
  }
}

// ------------------------------------------------------------ ağ: istemci
function joinRoom(raw) {
  const code = normalizeCode(raw);
  if (code.length < 4) { netError('Geçerli bir oda kodu yazın.'); return; }
  netError('');
  role = 'client';
  slots = [];
  client = new NetClient({
    onOpen: () => {
      myId = client.peer.id;
      client.send({ t: 'hello', v: NET_VERSION, app: APP_VERSION });
      $('#net-code').innerHTML = `Oda<b>${code}</b>`;
      netStatus('Bağlandı! Katılmak için W / ↑ / gamepad A tuşuna basın.');
      setNetUI();
    },
    onMessage: (m) => clientMessage(m),
    onClose: (reason) => { toast(reason, 4); stopOnline(); },
    onError: (e) => { netError(errorText(e)); stopOnline(true); },
  });
  client.join(code);
  $('#net-code').innerHTML = `Oda<b>${code}</b>`;
  netStatus('Bağlanılıyor…');
  setNetUI();
  renderSlots();
}

function clientMessage(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'lobby':
      slots = m.slots || [];
      if (m.mode === 'lobby' && mode !== 'lobby') showLobby();
      else renderSlots();
      break;
    case 'level':
      slots = m.slots || [];
      if (m.spectate) toast('Oyun sürüyor: izliyorsunuz. Host lobiye dönünce katılabilirsiniz.', 4);
      loadLevel(m.i);
      break;
    case 'snap':
      if (mode !== 'play' || m.lv !== levelIndex) break;
      snaps.push({ t: performance.now(), s: m });
      if (snaps.length > 12) snaps.shift();
      if (m.ev?.length) {
        applySnapshot(world, m);
        handleEvents(m.ev);
      }
      break;
    case 'end': stats = m.stats || stats; showEnd(); break;
    case 'info': toast(m.msg, 4); break;
    case 'error': netError(m.msg); stopOnline(true); break;
    case 'full': netError('Oda dolu.'); stopOnline(true); break;
    default: break;
  }
}

function stopOnline(keepError = false) {
  const wasClient = role === 'client';
  host?.close(); client?.close();
  host = null; client = null; myId = null;
  role = 'local';
  if (wasClient) slots = [];
  else slots = slots.filter((s) => s.owner === 'host');
  if (!keepError) netError('');
  if (mode !== 'lobby') showLobby(); else { setNetUI(); renderSlots(); }
}

// ------------------------------------------------------------ düğmeler
let quality = 'high', muted = false;
document.addEventListener('click', (e) => {
  sfx.unlock();
  const act = e.target?.dataset?.act;
  if (!act) return;
  if (act === 'resume') closePause();
  if (act === 'restart') { requestRestart(); closePause(); }
  if (act.startsWith('lv') && role !== 'client') { stats = { deaths: 0, time: 0 }; loadLevel(Number(act.slice(2))); }
  if (act === 'lobby') showLobby();
  if (act === 'leave') stopOnline();
  if (act === 'again') { stats = { deaths: 0, time: 0 }; loadLevel(0); }
  if (act === 'quality') {
    quality = quality === 'high' ? 'low' : 'high';
    gfx.setQuality(quality);
    e.target.textContent = `Grafik kalitesi: ${quality === 'high' ? 'Yüksek' : 'Düşük'}`;
  }
  if (act === 'mute') { muted = !muted; sfx.muted = muted; e.target.textContent = `Ses: ${muted ? 'Kapalı' : 'Açık'}`; }
});
$('#start-btn').addEventListener('click', () => { sfx.unlock(); startGame(); });
$('#btn-host').addEventListener('click', () => { sfx.unlock(); startHosting(); });
$('#btn-join').addEventListener('click', () => { sfx.unlock(); joinRoom($('#code-input').value); });
$('#code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); joinRoom(e.target.value); e.target.blur(); } });
$('#btn-leave').addEventListener('click', () => stopOnline());
$('#btn-invite').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?join=${host.code}`;
  try { await navigator.clipboard.writeText(link); toast('Davet bağlantısı kopyalandı. Açan kişi doğrudan odaya bağlanır.', 4); }
  catch { toast(link, 8); }
});
$('#btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(host.code); toast('Kod kopyalandı.'); } catch { toast('Kopyalanamadı; kodu elle yazın.'); }
});
window.addEventListener('keydown', () => sfx.unlock());
// Çevrim içi bu görünümde kullanılamıyorsa baştan açıkça söyle
if (!rtcAvailable()) {
  $('#btn-host').disabled = true; $('#btn-join').disabled = true; $('#code-input').disabled = true;
  const note = document.createElement('div');
  note.className = 'rtc-note';
  note.innerHTML = isEmbedded()
    ? '<b>Bu önizleme sayfasında çevrim içi oyun kapalı</b> (claude.ai güvenlik kısıtlaması). Yerel oyun çalışır. Çevrim içi için klasördeki <b>CO-PARK-demo.html</b> dosyasına çift tıklayıp Chrome, Edge veya Firefox ile açın.'
    : '<b>Bu tarayıcıda çevrim içi oyun kullanılamıyor.</b> Chrome, Edge veya Firefox ile açmayı deneyin.';
  $('#online-pick').after(note);
}
// Sürüm ve değişiklik günlüğü bağlantıları
document.querySelectorAll('.app-version').forEach((e) => { e.textContent = `v${APP_VERSION}`; });
const changelogUrl = /^https?:/.test(location.protocol) && !isEmbedded() ? './changelog.html' : `${PAGES_URL}changelog.html`;
document.querySelectorAll('.changelog-link').forEach((a) => { a.href = changelogUrl; });

// Davet bağlantısı: ?join=KOD ile açılırsa odaya otomatik bağlan
const q = new URLSearchParams(location.search);
if (q.get('join')) {
  $('#code-input').value = normalizeCode(q.get('join'));
  if (rtcAvailable()) setTimeout(() => joinRoom($('#code-input').value), 300);
}

// ------------------------------------------------------------ döngü
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const st = input.poll();

  if (mode === 'lobby') {
    lobbyUpdate(st);
    if (world) world.cam.x = 18 + Math.sin(now / 6000) * 14;
  } else if (mode === 'play') {
    playUpdate(dt, st);
  } else if (mode === 'pause') {
    if (input.keyPressed('Escape') || Object.values(st).some((s) => s.startPressed)) closePause();
    else if (input.keyPressed('KeyR')) { requestRestart(); closePause(); }
    else if (input.keyPressed('KeyL')) showLobby();
  } else if (mode === 'end') {
    if (input.keyPressed('Enter') && role !== 'client') { stats = { deaths: 0, time: 0 }; loadLevel(0); }
  }

  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('#banner').classList.add('hidden'); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('#toast').classList.add('hidden'); }
  if (mode === 'play' && online()) hudNet();
  if (world) gfx.update(world, dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Canlı tutma: kare döngüsünden bağımsız (pencere arka planda olsa da çalışır)
setInterval(() => {
  if (role === 'client' && client) client.send({ t: 'ping' });
  if (role === 'host' && host) {
    if (mode === 'lobby') broadcastLobby();
    else if (mode === 'end') host.broadcast({ t: 'end', stats });
    else host.broadcast({ t: 'ping' });
  }
}, 1000);

buildLevelButtons();
showLobby();
requestAnimationFrame(frame);

// test ve hata ayıklama için
window.__coPark = {
  get world() { return world; }, loadLevel, get slots() { return slots; }, set slots(v) { slots = v; },
  get role() { return role; }, get code() { return host?.code; }, get mode() { return mode; }, get myId() { return myId; },
  startGame, startHosting, joinRoom, LEVELS,
};
