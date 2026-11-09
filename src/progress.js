// Bölüm ilerlemesi: bölümler sırayla açılır, ilerleme tarayıcıda saklanır.
// Depolama yoksa (gizli pencere, kısıtlı sayfa) oyun yine çalışır; ilerleme yalnızca o oturumda kalır.
const KEY = 'copark-progress-v1';

export class Progress {
  constructor(levelCount, storage = safeStorage()) {
    this.count = levelCount;
    this.storage = storage;
    this.unlocked = 0;            // açık olan en yüksek bölüm (0 tabanlı)
    this.cleared = new Set();     // bitirilmiş bölümler
    this.load();
  }

  load() {
    try {
      const d = JSON.parse(this.storage?.getItem(KEY) || 'null');
      if (d && Number.isInteger(d.unlocked)) {
        this.unlocked = Math.max(0, Math.min(this.count - 1, d.unlocked));
        this.cleared = new Set((d.cleared || []).filter((i) => Number.isInteger(i) && i >= 0 && i < this.count));
      }
    } catch { /* bozuk kayıt: baştan başla */ }
  }

  save() {
    try { this.storage?.setItem(KEY, JSON.stringify({ unlocked: this.unlocked, cleared: [...this.cleared] })); } catch { /* yok say */ }
  }

  isUnlocked(i) { return i >= 0 && i <= this.unlocked; }
  isCleared(i) { return this.cleared.has(i); }

  // Bölüm bitti: bir sonrakini aç. Yeni bir bölüm açıldıysa onun indeksini döndürür.
  complete(i) {
    this.cleared.add(i);
    let opened = null;
    if (i + 1 < this.count && i + 1 > this.unlocked) { this.unlocked = i + 1; opened = i + 1; }
    this.save();
    return opened;
  }

  // Çevrim içi: host'un oyununda ulaşılan bölüm istemcide de açılır.
  reach(i) {
    if (i > this.unlocked && i < this.count) { this.unlocked = i; this.save(); }
  }

  reset() { this.unlocked = 0; this.cleared.clear(); this.save(); }
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    const t = '__copark_test__';
    s.setItem(t, '1'); s.removeItem(t);
    return s;
  } catch { return null; }
}
