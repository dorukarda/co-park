// Basit sentez ses efektleri (SM-04). Dış ses dosyası gerektirmez.
export class Sfx {
  constructor() { this.ctx = null; this.volume = 0.5; this.muted = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol = 0.2, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  play(type, id = 0) {
    const pitch = 1 + (id % 8) * 0.05;   // SM-03: oyuncuya göre hafif farklı ton
    switch (type) {
      case 'jump': this.tone(380 * pitch, 0.12, { type: 'triangle', vol: 0.12, slide: 260 }); break;
      case 'land': this.noise(0.08, 0.12); break;
      case 'key': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, { type: 'sine', vol: 0.18, delay: i * 0.07 })); break;
      case 'unlock': this.tone(220, 0.08, { type: 'square', vol: 0.1 }); this.tone(660, 0.3, { type: 'sine', vol: 0.2, delay: 0.08 }); break;
      case 'enter': this.tone(520 * pitch, 0.14, { type: 'sine', vol: 0.15, slide: 300 }); break;
      case 'exit': this.tone(700 * pitch, 0.14, { type: 'sine', vol: 0.12, slide: -300 }); break;
      case 'plate': this.tone(300, 0.1, { type: 'square', vol: 0.08 }); this.tone(450, 0.12, { type: 'square', vol: 0.08, delay: 0.06 }); break;
      case 'blockStart': this.noise(0.25, 0.15); break;
      case 'death': this.tone(300, 0.5, { type: 'sawtooth', vol: 0.15, slide: -240 }); this.noise(0.2, 0.2); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.18, delay: i * 0.1 })); break;
      case 'join': this.tone(660 * pitch, 0.12, { type: 'triangle', vol: 0.15, slide: 200 }); break;
      default: break;
    }
  }
}
