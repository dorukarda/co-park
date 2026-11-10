// Oyun genel ayarları. Birimler: 1 birim ≈ bir karakter genişliği.
export const CFG = {
  gravity: 32,
  jumpV: 11.8,          // ≈ 2.2 birim zıplama yüksekliği
  runSpeed: 5.5,
  groundAccel: 70,
  airAccel: 45,
  iceAccel: 7,          // buzda ivme/fren: kayma hissi
  maxFall: 20,
  pushSpeed: 2.2,       // sayılı blok itilirken hız
  playerW: 0.8,
  playerH: 0.9,
  deathY: -5,
  minSupport: 0.3,      // kenarda durmak için gereken en az temas genişliği (karakter 0.8)
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  keyGrabCooldown: 0.8,
  fixedStep: 1 / 120,
  maxPlayers: 8,
  // Fizik için sabit kamera yarı-genişliği: her ekranda aynı oynanış (çevrim içi tutarlılık için şart).
  // Renderer kamera uzaklığını bu genişliği gösterecek şekilde ayarlar.
  viewHalfW: 9.5,
};

// GS-01: 8 net ayrışan oyuncu rengi (ayrıca her karakterde numara var)
export const PLAYER_COLORS = [
  { hex: '#e8463b', name: 'Kırmızı' },
  { hex: '#2f7ff0', name: 'Mavi' },
  { hex: '#f5c518', name: 'Sarı' },
  { hex: '#3bb54a', name: 'Yeşil' },
  { hex: '#f28c28', name: 'Turuncu' },
  { hex: '#9b59d0', name: 'Mor' },
  { hex: '#f06ba8', name: 'Pembe' },
  { hex: '#22c3c9', name: 'Turkuaz' },
];

// OY-10: bölüm gereksinimleri oyuncu sayısına göre ölçeklenir.
// 'all' = herkes, 'half' = yarısı (en az 1), sayı = o sayı (oyuncu sayısını aşmaz)
export function resolveReq(req, n) {
  if (req === 'all') return Math.max(1, n);
  if (req === 'half') return Math.max(1, Math.floor(n / 2));
  return Math.max(1, Math.min(req, n));
}
