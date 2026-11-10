// Editör taslakları: tarayıcıda saklanır. Depolama yoksa bellekte tutulur (sayfa kapanınca gider).
const KEY = 'copark-drafts-v1';
let memory = { drafts: [] };

function read() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.drafts)) return d; } catch { /* bellek */ }
  return memory;
}
function write(d) {
  memory = d;
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

export const drafts = {
  list() { return read().drafts.slice().sort((a, b) => b.updated - a.updated); },
  get(id) { return read().drafts.find((d) => d.id === id) || null; },
  save(draft) {
    const d = read();
    const i = d.drafts.findIndex((x) => x.id === draft.id);
    const rec = { ...draft, updated: Date.now() };
    if (i >= 0) d.drafts[i] = rec; else d.drafts.push(rec);
    return write(d);
  },
  remove(id) { const d = read(); d.drafts = d.drafts.filter((x) => x.id !== id); write(d); },
  newId: () => 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
};
