// Mekanik testleri: node tests/mechanics.test.js
import { World, rectsOverlap } from '../src/world.js';
import { LEVELS } from '../src/levels.js';
import { CFG } from '../src/config.js';
import { Progress } from '../src/progress.js';

let fails = 0;
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if (!c) fails++; };
const slots = (n) => Array.from({ length: n }, (_, i) => ({ device: 'bot' + i, color: i }));
const L = (id) => LEVELS.findIndex((l) => l.id === id);
const mk = (li, n) => { const w = new World(typeof li === 'string' ? LEVELS[L(li)] : LEVELS[li], slots(n)); w.cam.halfW = 12; return w; };
function run(w, secs, fn) {
  const steps = Math.round(secs / CFG.fixedStep);
  for (let s = 0; s < steps; s++) {
    const inputs = {};
    w.players.forEach((p) => { inputs[p.id] = { left: false, right: false, jump: false, action: false, jumpPressed: false, actionPressed: false, ...(fn ? fn(p, s * CFG.fixedStep) : {}) }; });
    w.step(CFG.fixedStep, inputs);
  }
}
const place = (w, pos) => pos.forEach(([x, y], i) => { const p = w.players[i]; p.x = x; p.y = y; p.vx = p.vy = 0; });
const center = (w, x) => { w.cam.x = x; };

// 1) Tek oyuncu çıkıntıya ulaşamaz, iki oyuncu üst üste ulaşır
{
  const w = mk(0, 2); place(w, [[34.6, 0], [30, 0]]); center(w, 34);
  run(w, 0.3);
  run(w, 1.2, (p, t) => p.id === 0 ? { right: true, jump: true, jumpPressed: t < 0.01 } : {});
  ok(w.players[0].y < 2.7, 'tek oyuncu anahtar çıkıntısına çıkamıyor');
  const w2 = mk(0, 2); place(w2, [[34.6, 0], [34.6, 0.95]]); center(w2, 34);
  run(w2, 0.3);
  ok(w2.players[1].groundRef === w2.players[0], 'oyuncu 2, oyuncu 1\'in başında duruyor');
  run(w2, 0.5, (p) => p.id === 0 ? { right: true } : {});
  ok(Math.abs(w2.players[1].x - w2.players[0].x) < 0.05, 'alttaki yürüyünce üstteki taşınıyor');
  place(w2, [[34.6, 0], [34.6, 0.95]]); run(w2, 0.3);
  run(w2, 1.2, (p, t) => p.id === 1 ? { right: true, jump: true, jumpPressed: t < 0.01 } : {});
  ok(w2.players[1].y > 2.7, 'üst üste çıkarak çıkıntıya ulaşıldı');
  ok(w2.key.holder === w2.players[1], 'anahtar alındı');
}

// 2) Sayılı sandık: 4 oyuncuda 4 kişi gerekir
{
  for (const n of [3, 4]) {
    const w = mk('workshop-1', 4); const b = w.blocks[0];
    const pos = []; for (let i = 0; i < 4; i++) pos.push([b.x - 0.8 * (i + 1), 0]);
    place(w, pos); center(w, 16);
    const x0 = b.x;
    run(w, 1.5, (p) => (p.id < n ? { right: true } : {}));
    ok(n === 4 ? b.x > x0 + 2 : Math.abs(b.x - x0) < 0.01, `${n}/4 oyuncu iterse sandık ${n === 4 ? 'hareket ediyor' : 'kıpırdamıyor'}`);
  }
  const w = mk('workshop-1', 2); ok(w.blocks[0].req === 2 && w.plates[0].req === 1, '2 oyuncuda gereksinimler ölçekleniyor (sandık 2, plaka 1)');
  const w8 = mk('workshop-1', 8); ok(w8.blocks[0].req === 8 && w8.plates[0].req === 4, '8 oyuncuda gereksinimler ölçekleniyor (sandık 8, plaka 4)');
}

// 3) Plaka parmaklığı açar
{
  const w = mk('workshop-1', 4); center(w, 38);
  place(w, [[34, 0], [35.2, 0], [31, 0], [30, 0]]);
  run(w, 1);
  ok(w.plates[0].pressed && w.gates[0].open > 0.98, '2/4 oyuncu plakada → parmaklık açık');
  place(w, [[31, 0], [32, 0], [30, 0], [29, 0]]);
  run(w, 1);
  ok(w.gates[0].open < 0.02, 'plaka boşalınca parmaklık kapanıyor');
}

// 4) Asansör yalnızca herkes binince kalkar
{
  const w = mk('site-1', 4); center(w, 36); const m = w.movers[1];
  place(w, [[37, 0.4], [38.2, 0.4], [33, 0], [32, 0]]);
  run(w, 1.5);
  ok(m.t === 0, '2/4 oyuncu binince asansör beklemede');
  place(w, [[37, 0.4], [38.2, 0.4], [37, 1.35], [38.2, 1.35]]);
  run(w, 4);
  ok(m.t > 0.99, 'herkes (üst üste) binince asansör tepeye çıktı');
  ok(w.players.every((p) => p.y > 6.5), 'yolcular asansörle birlikte taşındı');
}

// 5) Kapı: anahtarsız açılmaz; anahtarla açılır, herkes girince bölüm biter
{
  const w = mk(0, 2); center(w, 52);
  place(w, [[55.8, 0], [54.5, 0]]);
  run(w, 0.2, () => ({ action: true, actionPressed: true }));
  ok(!w.players[0].entered, 'kilitli kapıya girilemiyor');
  w.key.holder = w.players[0]; w.key.x = 56; w.key.y = 1;
  run(w, 0.1);
  ok(w.door.unlocked, 'anahtar kapıya ulaşınca kapı açıldı');
  place(w, [[55.8, 0], [56.2, 0.95]]);
  run(w, 0.4);
  run(w, 1 / 60, () => ({ action: true, actionPressed: true }));
  ok(w.players.every((p) => p.entered) && w.status === 'clear', 'herkes girince bölüm tamamlandı');
}

// 6) Düşen oyuncu herkesi baştan başlatır
{
  const w = mk(0, 2); center(w, 12); place(w, [[14.6, 0.5], [10, 0]]);
  run(w, 1.5);
  ok(w.status === 'dead', 'çukura düşen oyuncu → ekip ölümü');
}

// 7) Kamera kenarı: oyuncular ekran dışına çıkamaz
{
  const w = mk('workshop-1', 2); place(w, [[5, 0], [5.9, 0]]); center(w, 6); w.cam.halfW = 6;
  run(w, 3, (p) => (p.id === 1 ? { right: true } : { left: true }));
  const spread = w.players[1].x + 0.8 - w.players[0].x;
  ok(spread <= 2 * 6 + 0.01, `oyuncular kamera genişliği içinde kalıyor (aralık ${spread.toFixed(2)})`);
}

// 8) Kenar: dar temasla havada durulmaz, yeterli temasla durulur
{
  for (const [ov, shouldFall] of [[0.02, true], [0.2, true], [0.35, false], [0.6, false]]) {
    const w = mk(0, 2); center(w, 12); place(w, [[14 - ov, 0], [8, 0]]);
    run(w, 1);
    const fell = w.players[0].y < -0.5;
    ok(fell === shouldFall, `kenarda ${ov} birim temas → ${shouldFall ? 'düşüyor' : 'duruyor'}`);
  }
  const w = mk(0, 2); center(w, 6); place(w, [[5, 0], [5.7, 0.95]]);   // 0.1 birimlik baş teması
  run(w, 1);
  ok(w.players[1].y < 0.05, 'başkasının başının köşesinde durulmaz, yanına kayar');
  const w2 = mk(0, 2); center(w2, 6); place(w2, [[5, 0], [5.3, 0.95]]); // 0.5 birim temas
  run(w2, 1);
  ok(w2.players[1].groundRef === w2.players[0], 'başın üstünde yeterli temasla durulur');
}

// 9) Tüm bölümler: 2 ve 8 oyuncuyla başlangıçta kimse ölmüyor, kimse iç içe değil, anahtar/kapı bölüm içinde
for (const lv of LEVELS) {
  for (const n of [2, 8]) {
    const w = mk(lv.id, n);
    const startOverlap = w.players.some((p) => [...w.statics, ...w.blocks].some((s) => rectsOverlap(p, s)));
    run(w, 2);
    const okk = !startOverlap && w.status === 'play' && w.players.every((p) => p.grounded) &&
      lv.key[0] > 0 && lv.key[0] < lv.width && lv.door[0] + 1.4 < lv.width;
    ok(okk, `${lv.name}: ${n} oyuncuyla güvenli başlangıç`);
  }
}

// 10) Açılır köprü: plaka basılıyken açık, üstünde biri varken toplanmaz
{
  const w = mk('park-3', 2); center(w, 22);
  place(w, [[17, 0], [21, 0]]);
  run(w, 1);
  ok(w.gates[0].open > 0.98, 'plakada 1/2 oyuncu → köprü açıldı');
  place(w, [[17, 0], [25, 0]]); run(w, 0.3);
  place(w, [[12, 0], [25, 0]]); run(w, 1);
  ok(w.gates[0].open > 0.9 && w.status === 'play', 'üstünde oyuncu varken köprü toplanmadı');
  place(w, [[12, 0], [33, 0]]); run(w, 0.4);
  ok(w.plates[1].pressed && w.gates[0].open > 0.98, 'karşıdaki plaka köprüyü açık tutuyor');
  place(w, [[12, 0], [36, 0]]); run(w, 1.2);
  ok(w.gates[0].open < 0.02, 'iki plaka da boşken köprü kapandı');
}

// 11) Tünel: sandık dikenli çukura düşüp köprü olur
{
  const w = mk('park-4', 2); center(w, 22);
  const b = w.blocks[0];
  place(w, [[b.x - 1.6, 0], [b.x - 0.8, 0]]);
  run(w, 4, () => ({ right: true }));
  ok(Math.abs(b.y + 1) < 0.05 && b.x >= 26 && b.x + b.w <= 28.4 + 0.01, `sandık çukura oturdu (x=${b.x.toFixed(2)}, y=${b.y.toFixed(2)})`);
  run(w, 3, () => ({ right: true }));
  ok(w.status === 'play' && w.players.every((p) => p.x > 29), 'oyuncular sandığın üstünden geçti');
}
{
  const w = mk('park-4', 2); center(w, 22); place(w, [[24.5, 0], [10, 0]]);
  run(w, 1.5, (p, t) => p.id === 0 ? { right: true, jump: true, jumpPressed: t < 0.01 } : {});
  ok(w.status === 'dead', 'tünelde çukurun üstünden zıplanamıyor');
}

// 12) Sandık plakayı basar ve parmaklığı açar
{
  const w = mk('workshop-3', 2); center(w, 16);
  w.blocks[0].x = 19; place(w, [[10, 0], [12, 0]]);
  run(w, 1.5);
  ok(w.plates[0].pressed && w.gates[0].open > 0.98, 'plakadaki sandık parmaklığı açtı');
}

// 13) Yük asansörü (yarısı): 4 oyuncu iki seferde çıkar
{
  const w = mk('workshop-2', 4); center(w, 12); const m = w.movers[0];
  place(w, [[14.2, 0], [15.4, 0], [8, 0], [9, 0]]);
  run(w, 4);
  ok(m.need === 2 && m.t > 0.99, '2/4 oyuncu binince asansör kalktı');
  run(w, 1.5, (p) => (p.id < 2 ? { right: true } : {}));
  run(w, 4);
  ok(w.players[0].y > 5.9 && w.players[1].y > 5.9 && m.t < 0.01, 'ilk grup rafa indi, asansör geri döndü');
  place(w, [[0, 0], [0, 0], [14.2, 0], [15.4, 0]].map((v, i) => i < 2 ? [w.players[i].x, w.players[i].y] : v));
  run(w, 4);
  ok(m.t > 0.99, 'kalan 2 oyuncu ile ikinci sefer');
}

// 14) Vinç platformu kuleler arasında taşır
{
  const w = mk('site-2', 2); center(w, 22);
  const m = w.movers[0];
  let boarded = false, done = false;
  for (let s = 0; s < 120 * 20 && !done; s++) {
    const inputs = {};
    const p = w.players[0];
    let r = false;
    if (!boarded) { p.x = 19.1; p.y = 3; p.vy = 0; if (m.t === 0 && m.wait > 0.3) boarded = true; }
    else if (p.x < 20.5 || m.t >= 1) r = true;
    inputs[0] = { left: false, right: r, jump: false, action: false, jumpPressed: false, actionPressed: false };
    inputs[1] = { left: false, right: false, jump: false, action: false, jumpPressed: false, actionPressed: false };
    w.players[1].x = 17; w.players[1].y = 3;
    w.step(CFG.fixedStep, inputs);
    if (w.status !== 'play') break;
    if (p.x > 33) done = true;
  }
  ok(done, 'vinç platformuyla karşı kuleye geçildi');
}

// 15) Sandıktan yüksek sete çıkılır, sandık olmadan tek başına çıkılamaz
{
  const w = mk('park-2', 2); center(w, 22);
  w.blocks[0].x = 24.6; place(w, [[24.9, 1.2], [18, 0]]); run(w, 0.3);
  run(w, 1.5, (p, t) => p.id === 0 ? { right: true, jump: true, jumpPressed: t < 0.01 } : {});
  ok(w.players[0].y > 2.55 && w.players[0].x > 26, 'sandık basamağıyla sete çıkıldı');
  const w2 = mk('park-2', 2); center(w2, 22); place(w2, [[24.5, 0], [18, 0]]);
  run(w2, 1.5, (p, t) => p.id === 0 ? { right: true, jump: true, jumpPressed: t < 0.01 } : {});
  ok(w2.players[0].y < 0.1, 'sandıksız tek oyuncu sete çıkamıyor');
}

// 16) Dikey platform rafa taşır
{
  const w = mk('workshop-4', 2); center(w, 28); const m = w.movers[1];
  let on = false, done = false;
  for (let s = 0; s < 120 * 15 && !done; s++) {
    const p = w.players[0];
    if (!on) { p.x = 27; p.y = 0; p.vy = 0; if (m.t === 0 && m.wait > 0.5) on = true; }
    const r = on && (p.x < 28.6 || m.t >= 1);
    const z = { left: false, right: false, jump: false, action: false, jumpPressed: false, actionPressed: false };
    w.players[1].x = 22; w.players[1].y = 0;
    w.step(CFG.fixedStep, { 0: { ...z, right: r }, 1: z });
    if (w.status !== 'play') break;
    if (p.x > 32 && p.y > 3.9) done = true;
  }
  ok(done, 'dikey platformla rafa çıkıldı');
}

// 17) Bölüm kilitleri: sırayla açılır, kaydedilir, sıfırlanır
{
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } };
  const pr = new Progress(12, mem);
  ok(pr.isUnlocked(0) && !pr.isUnlocked(1) && !pr.isUnlocked(3), 'başlangıçta yalnızca 1. bölüm açık');
  ok(pr.complete(0) === 1 && pr.isUnlocked(1) && !pr.isUnlocked(2), '1. bölüm bitince 2. açılıyor');
  pr.complete(1); pr.complete(2);
  ok(pr.isUnlocked(3) && !pr.isUnlocked(4), '3. bölüm bitince 4. açılıyor, 5. kilitli');
  ok(pr.complete(1) === null && pr.unlocked === 3, 'eski bir bölümü tekrar bitirmek kilit durumunu bozmuyor');
  const pr2 = new Progress(12, mem);
  ok(pr2.unlocked === 3 && pr2.isCleared(2), 'ilerleme kaydedilip yeniden yükleniyor');
  for (let i = 3; i < 12; i++) pr2.complete(i);
  ok(pr2.unlocked === 11 && pr2.cleared.size === 12, 'son bölüm bitince taşma yok');
  pr2.reset();
  ok(new Progress(12, mem).unlocked === 0, 'sıfırlama kaydediliyor');
  const bad = { getItem() { return '{bozuk'; }, setItem() { throw new Error('dolu'); } };
  const pr3 = new Progress(12, bad); pr3.complete(0);
  ok(pr3.isUnlocked(1), 'bozuk/erişilemeyen depolamada oyun çalışmaya devam ediyor');
  const pr4 = new Progress(12, mem); pr4.reach(5);
  ok(pr4.isUnlocked(5) && !pr4.isUnlocked(6), 'çevrim içi ulaşılan bölüm istemcide açılıyor');
}

console.log(fails ? `\n${fails} test başarısız` : '\nTüm testler geçti');
process.exit(fails ? 1 : 0);
