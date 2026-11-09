// Girdi: 2 klavye düzeni + 8 gamepad'e kadar (KA-01, KA-02).
const KEYMAPS = {
  k1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], action: ['KeyS'] },
  k2: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], action: ['ArrowDown'] },
};
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export const DEVICE_LABELS = { k1: 'Klavye 1 (WASD)', k2: 'Klavye 2 (Oklar)' };
export const deviceLabel = (d) => DEVICE_LABELS[d] || `Gamepad ${Number(d.slice(2)) + 1}`;

export class Input {
  constructor() {
    this.down = new Set();
    this.just = new Set();
    this.padPrev = {};
    this.state = {};
    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;                       // oda kodu yazarken oyun tuşları çalışmasın
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.just.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  keyPressed(code) { return this.just.has(code); }

  // Her karenin başında çağrılır: tüm cihazların durumunu hesaplar.
  poll() {
    const st = {};
    for (const [dev, map] of Object.entries(KEYMAPS)) {
      const any = (arr) => arr.some((c) => this.down.has(c));
      const anyJust = (arr) => arr.some((c) => this.just.has(c));
      st[dev] = {
        left: any(map.left), right: any(map.right), jump: any(map.jump), action: any(map.action),
        jumpPressed: anyJust(map.jump), actionPressed: anyJust(map.action), startPressed: false,
      };
    }
    let pads = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { pads = []; }
    pads.forEach((gp, i) => {
      if (!gp || !gp.connected) return;
      const dev = 'gp' + i;
      const b = (n) => !!gp.buttons[n]?.pressed;
      const ax = gp.axes[0] || 0;
      const cur = {
        left: ax < -0.4 || b(14), right: ax > 0.4 || b(15),
        jump: b(0) || b(12), action: b(2) || b(1) || b(13), start: b(9),
      };
      const prev = this.padPrev[dev] || {};
      st[dev] = {
        left: cur.left, right: cur.right, jump: cur.jump, action: cur.action,
        jumpPressed: cur.jump && !prev.jump, actionPressed: cur.action && !prev.action,
        startPressed: cur.start && !prev.start,
      };
      this.padPrev[dev] = cur;
    });
    this.state = st;
    return st;
  }

  device(dev) { return this.state[dev]; }

  // Karenin sonunda çağrılır.
  endFrame() { this.just.clear(); }
}
