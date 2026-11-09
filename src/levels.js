// Bölüm verileri (BT-07: bölümler veri olarak tanımlanır).
// Koordinatlar: x sağa, y yukarı; dikdörtgenler [x, y, genişlik, yükseklik], y = alt kenar.
// Zemin üst yüzeyi y = 0. Zıplama ≈ 2,2 birim; iki kişi üst üste ≈ 2,9 birime ulaşır.
// req: sayı, 'half' (oyuncuların yarısı) veya 'all' (herkes). Tüm bölümler 2–8 oyuncuyla bitirilebilir.
//
// Mekanikler: solids/platforms (sabit), spikes (diken), blocks (sayılı sandık),
// plates (basınç plakası; üzerindeki sandık da basar), gates (parmaklık; axis:'x' ise açılan köprü),
// movers: mode 'loop' (gidip gelen), mode 'lift' (req kadar oyuncu binince kalkan asansör).

export const LEVELS = [
  // ============================================================ DÜNYA 1 · PARK
  {
    id: 'park-1', world: 'Dünya 1', name: 'Park — İlk Adımlar', theme: 'park', width: 60, spawn: [1.2, 0],
    hint: 'Anahtar yüksekte: üst üste çıkın! Anahtarı kapıya götürün, sonra herkes kapıya girsin (S / ↓ / X).',
    solids: [[0, -3, 14, 3], [16, -3, 16, 3], [24, 0, 4, 1], [32, -3, 28, 3], [44, 0, 8, 1.5]],
    platforms: [[36, 2.3, 4, 0.5]],
    key: [38, 3.4], door: [55.5, 0],
  },
  {
    id: 'park-2', world: 'Dünya 1', name: 'Park — Sandık Basamağı', theme: 'park', width: 58, spawn: [1.2, 0],
    hint: 'Yüksek setin üstüne herkes çıkmalı. Sandığı sete dayayıp basamak yapın. Anahtar daha da yukarıda!',
    solids: [[0, -3, 26, 3], [26, -3, 14, 5.6], [40, -3, 4, 3], [46, -3, 12, 3]],
    platforms: [[31, 4.9, 3, 0.5]],
    blocks: [{ x: 14, y: 0, w: 1.4, h: 1.2, req: 'half' }],
    key: [32.5, 6.0], door: [53, 0],
  },
  {
    id: 'park-3', world: 'Dünya 1', name: 'Park — Açılır Köprü', theme: 'park', width: 62, spawn: [1.2, 0],
    hint: 'Plaka köprüyü açar. Bir grup plakada beklerken diğerleri geçsin, karşıdaki plakayı tutsun, sonra sıra ötekilerde.',
    solids: [[0, -3, 22, 3], [22, -3, 8, 1], [30, -3, 32, 3]],
    platforms: [[44, 2.3, 3, 0.5]],
    spikes: [[22, -2, 8, 0.45]],
    plates: [{ id: 'a', x: 16.5, y: 0, w: 3.4, req: 'half' }, { id: 'b', x: 32.5, y: 0, w: 3.4, req: 'half' }],
    gates: [{ x: 22, y: -0.4, w: 8, h: 0.4, plates: ['a', 'b'], axis: 'x' }],
    key: [45.5, 3.4], door: [56, 0],
  },
  {
    id: 'park-4', world: 'Dünya 1', name: 'Park — Tüneldeki Çukur', theme: 'park', width: 60, spawn: [1.2, 0],
    hint: 'Tünelde zıplayamazsınız. Sandığı hep birlikte itip dikenli çukura düşürün; köprü olsun.',
    solids: [[0, -3, 26, 3], [20, 1.5, 16, 8], [26, -3, 2.4, 2], [28.4, -3, 31.6, 3]],
    platforms: [[42, 2.3, 3, 0.5]],
    spikes: [[26, -1, 2.4, 0.4]],
    blocks: [{ x: 22, y: 0, w: 2.2, h: 1.0, req: 'all' }],
    key: [43.5, 3.4], door: [54, 0],
  },

  // ============================================================ DÜNYA 2 · ATÖLYE
  {
    id: 'workshop-1', world: 'Dünya 2', name: 'Atölye — Birlikte İtin', theme: 'workshop', width: 66, spawn: [1.2, 0],
    hint: 'Sandığı itmek için üzerindeki sayı kadar oyuncu gerekir. Kapıyı açık tutmak için plakaların üzerinde durun.',
    solids: [[0, -3, 66, 3], [18, 1.6, 12, 6], [39.5, 4, 1.6, 6]],
    blocks: [{ x: 19.2, y: 0, w: 1.4, h: 1.4, req: 'all' }],
    plates: [{ id: 'a', x: 33.5, y: 0, w: 3.4, req: 'half' }, { id: 'b', x: 42.2, y: 0, w: 3.4, req: 'half' }],
    gates: [{ x: 39.9, y: 0, w: 0.8, h: 4, plates: ['a', 'b'] }],
    key: [51, 0.6], door: [60, 0],
  },
  {
    id: 'workshop-2', world: 'Dünya 2', name: 'Atölye — Yük Asansörü', theme: 'workshop', width: 46, spawn: [1.2, 0],
    hint: 'Asansör, üzerinde yazan sayı kadar oyuncu binince kalkar. Herkes rafa çıkana kadar sırayla taşıyın.',
    solids: [[0, -3, 14, 3], [14, -3, 3.2, 2.6], [17.2, -3, 28.8, 9]],
    platforms: [[26, 8.1, 3, 0.5]],
    movers: [{ path: [[14, -0.4], [14, 5.6]], w: 3.2, h: 0.4, speed: 2.4, mode: 'lift', req: 'half', passX: 17.2 }],
    key: [27.5, 9.2], door: [40, 6],
  },
  {
    id: 'workshop-3', world: 'Dünya 2', name: 'Atölye — Sandık ve Düğme', theme: 'workshop', width: 66, spawn: [1.2, 0],
    hint: 'İlk plaka herkesi ister… ya da üstüne bir sandık! Sonra köprüyü plakalarla açık tutun.',
    solids: [[0, -3, 32, 3], [25.2, 4, 1.6, 6], [32, -3, 8, 1], [40, -3, 26, 3]],
    spikes: [[32, -2, 8, 0.45]],
    blocks: [{ x: 10.5, y: 0, w: 1.4, h: 1.4, req: 'half' }],
    plates: [
      { id: 'c', x: 18, y: 0, w: 3.4, req: 'all' },
      { id: 'a', x: 27.5, y: 0, w: 3.4, req: 'half' },
      { id: 'b', x: 41.5, y: 0, w: 3.4, req: 'half' },
    ],
    gates: [
      { x: 25.6, y: 0, w: 0.8, h: 4, plates: ['c'] },
      { x: 32, y: -0.4, w: 8, h: 0.4, plates: ['a', 'b'], axis: 'x' },
    ],
    key: [52, 0.6], door: [60, 0],
  },
  {
    id: 'workshop-4', world: 'Dünya 2', name: 'Atölye — Raylar', theme: 'workshop', width: 56, spawn: [1.2, 0],
    hint: 'Platformlar gidip gelir: doğru anda binin. Rafın üstündeki anahtar için yine üst üste çıkmanız gerek.',
    solids: [[0, -3, 10, 3], [10, -3, 10, 1], [20, -3, 8, 3], [28, -3, 3, 2.6], [31, -3, 25, 7]],
    platforms: [[40, 6.3, 3, 0.5]],
    spikes: [[10, -2, 10, 0.45]],
    movers: [
      { path: [[10, -0.4], [16.8, -0.4]], w: 3.2, h: 0.4, speed: 2.2, pause: 0.7, mode: 'loop' },
      { path: [[28, -0.4], [28, 3.6]], w: 3, h: 0.4, speed: 1.6, pause: 1.2, mode: 'loop' },
    ],
    key: [41.5, 7.4], door: [50, 4],
  },

  // ============================================================ DÜNYA 3 · ŞANTİYE
  {
    id: 'site-1', world: 'Dünya 3', name: 'Şantiye — Hep Birlikte Yukarı', theme: 'construction', width: 72, spawn: [1.2, 0],
    hint: 'Asansör yalnızca HERKES binince kalkar. Yer yetmezse üst üste binin!',
    solids: [[0, -3, 20, 3], [20, -3, 10, 1.5], [30, -3, 42, 3], [40, 0, 2.2, 7]],
    platforms: [[56, 3.1, 3, 0.5]],
    spikes: [[20, -1.5, 10, 0.45]],
    movers: [
      { path: [[20.2, -0.4], [26.8, -0.4]], w: 3, h: 0.4, speed: 2.2, pause: 0.7, mode: 'loop' },
      { path: [[36.8, 0], [36.8, 6.6]], w: 3.2, h: 0.4, speed: 2.4, mode: 'lift', req: 'all', passX: 40 },
    ],
    blocks: [{ x: 48, y: 0, w: 1.4, h: 1.2, req: 2 }],
    key: [57.5, 4.3], door: [67, 0],
  },
  {
    id: 'site-2', world: 'Dünya 3', name: 'Şantiye — Vinç', theme: 'construction', width: 68, spawn: [1.2, 0],
    hint: 'Kuleye çıkmak için sandığı itin, sonra vinç platformuyla dikenlerin üstünden geçin.',
    solids: [[0, -3, 14, 3], [14, -3, 6, 6], [20, -3, 12, 1.5], [32, -3, 6, 6], [38, -3, 30, 3]],
    platforms: [[46, 2.3, 3, 0.5]],
    spikes: [[20, -1.5, 12, 0.45]],
    blocks: [{ x: 9.2, y: 0, w: 1.4, h: 1.2, req: 'half' }],
    movers: [{ path: [[20, 2.6], [28.8, 2.6]], w: 3.2, h: 0.4, speed: 2.4, pause: 0.8, mode: 'loop' }],
    key: [47.5, 3.4], door: [62, 0],
  },
  {
    id: 'site-3', world: 'Dünya 3', name: 'Şantiye — Beton Bloklar', theme: 'construction', width: 68, spawn: [1.2, 0],
    hint: 'İki sandık: biri herkesi, öteki iki kişiyi ister. Duvarı aşmak için basamak yapın, sonra plakalarla kapıyı tutun.',
    solids: [[0, -3, 68, 3], [9, 1.6, 10, 6], [28, 0, 2, 2.6], [39.6, 4, 1.6, 6]],
    platforms: [[50, 2.3, 3, 0.5]],
    blocks: [{ x: 10, y: 0, w: 1.4, h: 1.4, req: 'all' }, { x: 22, y: 0, w: 1.4, h: 1.2, req: 2 }],
    plates: [{ id: 'a', x: 33, y: 0, w: 3.4, req: 'half' }, { id: 'b', x: 42.5, y: 0, w: 3.4, req: 'half' }],
    gates: [{ x: 40, y: 0, w: 0.8, h: 4, plates: ['a', 'b'] }],
    key: [51.5, 3.4], door: [62, 0],
  },
  {
    id: 'site-4', world: 'Dünya 3', name: 'Şantiye — Son Kat', theme: 'construction', width: 72, spawn: [1.2, 0],
    hint: 'Son sınav: köprüyü birlikte geçin, sonra herkes aynı anda asansöre binsin.',
    solids: [[0, -3, 16, 3], [16, -3, 8, 1], [24, -3, 10.8, 3], [34.8, -3, 3.2, 2.6], [38, -3, 34, 3], [38, 0, 3, 8]],
    platforms: [[52, 2.3, 3, 0.5]],
    spikes: [[16, -2, 8, 0.45]],
    plates: [{ id: 'a', x: 10.5, y: 0, w: 3.4, req: 'half' }, { id: 'b', x: 25.5, y: 0, w: 3.4, req: 'half' }],
    gates: [{ x: 16, y: -0.4, w: 8, h: 0.4, plates: ['a', 'b'], axis: 'x' }],
    movers: [{ path: [[34.8, -0.4], [34.8, 7.6]], w: 3.2, h: 0.4, speed: 2.4, mode: 'lift', req: 'all', passX: 38 }],
    key: [53.5, 3.4], door: [66, 0],
  },
];
