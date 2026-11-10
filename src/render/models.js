// 3D modeller: oyuncak figür karakterler, anahtar, kapı, sandık, plaka, kapı parmaklığı, dekor.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterial, worldBox, labelTexture } from './textures.js';

const DEPTH = 3; // oynanış düzleminin kalınlığı (z)

// ------------------------------------------------------------ karakter (GS-04)
const bodyGeo = new RoundedBoxGeometry(0.8, 0.9, 0.72, 5, 0.24);
const eyeGeo = new THREE.SphereGeometry(0.075, 16, 12);
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.15, clearcoat: 1 });
const shineGeo = new THREE.SphereGeometry(0.022, 8, 6);
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export function createCharacter(color, number) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();          // ezilme-esneme için alt merkezden ölçeklenir
  root.add(pivot);
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35,
    sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).multiplyScalar(0.6),
  });
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.45;
  body.castShadow = true; body.receiveShadow = true;
  pivot.add(body);

  const face = new THREE.Group();
  face.position.set(0, 0.6, 0.355);
  for (const sx of [-0.15, 0.15]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.scale.set(1, 1.25, 0.6);
    e.position.x = sx;
    const s = new THREE.Mesh(shineGeo, shineMat);
    s.position.set(0.025, 0.035, 0.04);
    e.add(s);
    face.add(e);
  }
  pivot.add(face);

  // numara rozeti (GS-01: renk körlüğü için)
  const tex = labelTexture(String(number), { bg: color, font: 'bold 78px system-ui, sans-serif' });
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  badge.scale.set(0.38, 0.38, 1);
  badge.position.y = 1.32;
  root.add(badge);

  // işaretleşme balonu
  const etex = labelTexture('!', { fg: '#1c1c1c', bg: '#ffffff', font: 'bold 96px system-ui, sans-serif' });
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: etex, depthWrite: false }));
  bubble.scale.set(0.55, 0.55, 1);
  bubble.position.y = 1.85;
  bubble.visible = false;
  root.add(bubble);

  root.userData = { pivot, face, body, badge, bubble };
  return root;
}

// ------------------------------------------------------------ anahtar
export function createKey() {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.22, clearcoat: 0.3 });
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.055, 16, 32), gold);
  ring.position.x = -0.22;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 16), gold);
  shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.15;
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), gold);
  t1.position.set(0.3, -0.08, 0);
  const t2 = t1.clone(); t2.position.x = 0.38; t2.scale.y = 0.7; t2.position.y = -0.06;
  g.add(ring, shaft, t1, t2);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const light = new THREE.PointLight(0xffd27a, 2.5, 3.5, 2);
  g.add(light);
  return g;
}

// ------------------------------------------------------------ kapı
export function createDoor(theme) {
  const g = new THREE.Group();
  const frameMat = theme === 'park' ? getMaterial('darkwood') : getMaterial('darkmetal');
  const W = 1.4, H = 2.0;
  const post = worldBox(0.14, H + 0.14, 0.3);
  const l = new THREE.Mesh(post, frameMat); l.position.set(0.07, (H + 0.14) / 2, 0);
  const r = l.clone(); r.position.x = W - 0.07;
  const top = new THREE.Mesh(worldBox(W, 0.14, 0.3), frameMat); top.position.set(W / 2, H + 0.07, 0);
  // içerisi: sıcak ışıklı oda
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.28, H),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffb45a, emissiveIntensity: 0 }));
  inside.position.set(W / 2, H / 2, -0.1);
  // kapı kanadı (menteşe solda)
  const hinge = new THREE.Group(); hinge.position.set(0.14, 0, 0.05);
  const panel = new THREE.Mesh(worldBox(W - 0.28, H, 0.08), getMaterial('wood', { seed: 4 }));
  panel.position.set((W - 0.28) / 2, H / 2, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.25 }));
  knob.position.set(W - 0.45, H * 0.5, 0.07);
  // kilit
  const lock = new THREE.Group();
  const lockBody = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.22, 0.1, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xb8892e, metalness: 1, roughness: 0.3 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 10, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.2 }));
  shackle.position.y = 0.11;
  lock.add(lockBody, shackle);
  lock.position.set((W - 0.28) / 2, H * 0.62, 0.1);
  panel.add(knob); hinge.add(panel); hinge.add(lock);
  lock.position.x += 0; // kanatla birlikte döner
  g.add(l, r, top, inside, hinge);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const light = new THREE.PointLight(0xffb45a, 0, 5, 2);
  light.position.set(W / 2, 1.2, 0.6);
  g.add(light);
  g.userData = { hinge, inside, lock, light };
  return g;
}

// ------------------------------------------------------------ sayılı sandık (OY-07)
export function createCrate(w, h) {
  const g = new THREE.Group();
  const mat = getMaterial('crate');
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, Math.min(1.6, DEPTH * 0.55), 3, 0.04), mat);
  box.position.set(w / 2, h / 2, 0);
  box.castShadow = box.receiveShadow = true;
  const tex = labelTexture('0', { fg: '#fff8e6', font: 'bold 96px system-ui, sans-serif' });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.6),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 }));
  label.position.set(w / 2, h / 2, Math.min(1.6, DEPTH * 0.55) / 2 + 0.005);
  g.add(box, label);
  g.userData = { tex, last: null };
  return g;
}

// ------------------------------------------------------------ basınç plakası
export function createPlate(w) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(worldBox(w + 0.2, 0.08, 1.6), getMaterial('darkmetal'));
  base.position.set(w / 2, 0.04, 0);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0xc0392b, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.2 });
  const btn = new THREE.Mesh(new RoundedBoxGeometry(w, 0.14, 1.4, 2, 0.04), btnMat);
  btn.position.set(w / 2, 0.12, 0);
  const tex = labelTexture('0', { fg: '#fff', bg: 'rgba(20,20,20,0.75)', font: 'bold 72px system-ui, sans-serif' });
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sign.scale.set(0.55, 0.55, 1);
  sign.position.set(w / 2, 0.55, 0.9);
  g.add(base, btn, sign);
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  g.userData = { btn, btnMat, tex, last: null };
  return g;
}

// ------------------------------------------------------------ parmaklıklı kapı
export function createGate(w, h) {
  const g = new THREE.Group();
  const bars = new THREE.Group();
  const mat = getMaterial('darkmetal');
  const n = 4;
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 12), mat);
    b.position.set(0, h / 2, -0.9 + (1.8 * i) / (n - 1));
    b.castShadow = true;
    bars.add(b);
  }
  for (const y of [0.15, h / 2, h - 0.15]) {
    const r = new THREE.Mesh(worldBox(0.12, 0.12, 2), mat);
    r.position.set(0, y, 0); r.castShadow = true;
    bars.add(r);
  }
  bars.position.x = w / 2;
  g.add(bars);
  g.userData = { bars, h };
  return g;
}

// ------------------------------------------------------------ açılır köprü
export function createBridge(w, h) {
  const g = new THREE.Group();
  const geo = worldBox(w, h, DEPTH * 0.75);
  geo.translate(w / 2, h / 2, 0);                 // sol kenardan ölçeklenir
  const deck = new THREE.Mesh(geo, getMaterial('metal', { seed: 5 }));
  deck.castShadow = deck.receiveShadow = true;
  const housing = new THREE.Mesh(worldBox(0.5, 0.7, DEPTH * 0.85), getMaterial('hazard'));
  housing.position.set(-0.25, h / 2 - 0.15, 0);
  housing.castShadow = true;
  g.add(deck, housing);
  g.userData = { deck };
  return g;
}

// ------------------------------------------------------------ renkli kapı (yalnızca o oyuncu geçer)
export function createColorGate(w, h, color, number) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH * 0.8),
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.42, clearcoat: 1, emissive: color, emissiveIntensity: 0.25, depthWrite: false }));
  glass.position.set(w / 2, h / 2, 0);
  const frameMat = getMaterial('darkmetal');
  const top = new THREE.Mesh(worldBox(w + 0.1, 0.12, DEPTH * 0.85), frameMat);
  top.position.set(w / 2, h, 0);
  const tex = labelTexture(String(number), { bg: color, font: 'bold 78px system-ui, sans-serif' });
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  badge.scale.set(0.45, 0.45, 1);
  badge.position.set(w / 2, h + 0.45, DEPTH * 0.45);
  g.add(glass, top, badge);
  return g;
}

// ------------------------------------------------------------ buz ve yürüyen bant yüzeyleri
export function iceMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xbfe2f5, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 });
}
export function conveyorMaterial(w) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#2b2e33'; x.fillRect(0, 0, 128, 32);
  x.strokeStyle = '#f5c518'; x.lineWidth = 5;
  for (let i = -1; i < 5; i++) { x.beginPath(); x.moveTo(i * 32 + 6, 4); x.lineTo(i * 32 + 18, 16); x.lineTo(i * 32 + 6, 28); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.1 });
}

// ------------------------------------------------------------ kış dekoru
export function createPine(rnd) {
  const g = new THREE.Group();
  const h = 2.5 + rnd() * 3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h * 0.35, 8), getMaterial('bark'));
  trunk.position.y = h * 0.17; trunk.castShadow = true;
  g.add(trunk);
  const green = new THREE.MeshStandardMaterial({ color: 0x24452f, roughness: 0.9 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf2f6fb, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const r = (1.3 - i * 0.25) * (h / 4.5), y = h * 0.3 + i * h * 0.18;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.32, 10), green);
    cone.position.y = y; cone.castShadow = true; g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.72, h * 0.12, 10), snow);
    cap.position.y = y + h * 0.1; g.add(cap);
  }
  return g;
}

export function createSnowman() {
  const g = new THREE.Group();
  const snow = getMaterial('snow');
  [[0.5, 0.45], [0.36, 1.15], [0.25, 1.65]].forEach(([r, y]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), snow); b.position.y = y; b.castShadow = true; g.add(b);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xf07b1d }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.65, 0.3); g.add(nose);
  return g;
}

// ------------------------------------------------------------ dikenler
export function createSpikes(w, h) {
  const count = Math.max(1, Math.round(w / 0.5));
  const geo = new THREE.ConeGeometry(0.2, h, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 0.9, roughness: 0.3 });
  const rows = 4;
  const inst = new THREE.InstancedMesh(geo, mat, count * rows);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < count; i++) {
    m.makeTranslation((i + 0.5) * (w / count) + (r % 2) * 0.12, h / 2, -1.1 + r * 0.75);
    inst.setMatrixAt(k++, m);
  }
  inst.castShadow = true;
  return inst;
}

// ------------------------------------------------------------ hareketli platform / asansör
export function createMover(w, h, label) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(worldBox(w, h, DEPTH * 0.8), getMaterial('metal', { seed: 3 }));
  top.position.set(w / 2, h / 2, 0);
  const stripe = new THREE.Mesh(worldBox(w, h * 0.7, 0.02, 1), getMaterial('hazard'));
  stripe.position.set(w / 2, h / 2, DEPTH * 0.4 + 0.012);
  g.add(top, stripe);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (label) {
    const tex = labelTexture(label, { fg: '#fff', bg: 'rgba(25,25,25,0.8)', w: 256, font: 'bold 56px system-ui, sans-serif' });
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sign.scale.set(1.3, 0.65, 1);
    sign.position.set(w / 2, -0.6, 1.3);
    g.add(sign);
    g.userData.tex = tex;
  }
  // asansör halatları
  return g;
}

// ------------------------------------------------------------ dekor yardımcıları
// Organik, yumuşak gölgeli yaprak kümeleri: köşeler birleştirilir, konuma göre bozulur.
function organic(r, amt, seed = 0) {
  let geo = new THREE.IcosahedronGeometry(r, 3);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 + seed * 1.3) * Math.sin(z * 3.7 + seed * 0.7);
    const n2 = Math.sin(x * 9.3 + y * 7.1 + z * 8.7 + seed) * 0.35;
    const k = 1 + (n + n2) * amt;
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createTree(rnd) {
  const g = new THREE.Group();
  const h = 2.5 + rnd() * 2.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 10), getMaterial('bark'));
  trunk.position.y = h / 2;
  g.add(trunk);
  const leafMat = getMaterial('foliage', { seed: 2 + Math.floor(rnd() * 3) });
  const blobs = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < blobs; i++) {
    const r = 0.9 + rnd() * 0.9;
    const geo = organic(r, 0.22, rnd() * 10);
    const b = new THREE.Mesh(geo, leafMat);
    b.position.set((rnd() - 0.5) * 1.8, h + (rnd() - 0.2) * 1.4, (rnd() - 0.5) * 1.6);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  trunk.castShadow = true;
  return g;
}

export function createBush(rnd) {
  const g = new THREE.Group();
  const mat = getMaterial('foliage', { seed: 5 });
  for (let i = 0; i < 3; i++) {
    const r = 0.45 + rnd() * 0.4;
    const b = new THREE.Mesh(organic(r, 0.2, rnd() * 10), mat);
    b.position.set(i * 0.6 - 0.6, r * 0.6, (rnd() - 0.5) * 0.4);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  }
  return g;
}

export function createBench() {
  const g = new THREE.Group();
  const wood = getMaterial('wood', { seed: 7 });
  const iron = getMaterial('darkmetal');
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(worldBox(2, 0.08, 0.14), wood);
    s.position.set(0, 0.5, i * 0.17); g.add(s);
  }
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(worldBox(2, 0.08, 0.14), wood);
    s.position.set(0, 0.75 + i * 0.18, -0.08); s.rotation.x = -0.15; g.add(s);
  }
  for (const x of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(worldBox(0.08, 0.5, 0.5), iron);
    leg.position.set(x, 0.25, 0.15); g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createLamp(warm = 0xffd9a0) {
  const g = new THREE.Group();
  const iron = getMaterial('darkmetal');
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 10), iron);
  pole.position.y = 1.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: warm, emissive: warm, emissiveIntensity: 1.5 }));
  head.position.y = 3.3;
  g.add(pole, head);
  pole.castShadow = true;
  return g;
}

export function createGear(r, rnd) {
  const g = new THREE.Group();
  const mat = getMaterial(rnd() > 0.5 ? 'metal' : 'rust', { seed: 9 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 40), mat);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const teeth = Math.round(r * 10);
  for (let i = 0; i < teeth; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.25), mat);
    const a = (i / teeth) * Math.PI * 2;
    t.position.set(Math.cos(a) * (r + 0.1), Math.sin(a) * (r + 0.1), 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.4, 20), getMaterial('darkmetal'));
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createCone() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xf06a1d, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const base = new THREE.Mesh(worldBox(0.6, 0.05, 0.6), orange);
  base.position.y = 0.025;
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.25, 0.3, 20), orange); c1.position.y = 0.2;
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.15, 20), white); c2.position.y = 0.42;
  const c3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 0.25, 20), orange); c3.position.y = 0.62;
  g.add(base, c1, c2, c3);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createBeamTower(h) {
  const g = new THREE.Group();
  const mat = getMaterial('rust', { seed: 4 });
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const p = new THREE.Mesh(worldBox(0.14, h, 0.14), mat);
    p.position.set(x, h / 2, z); g.add(p);
  }
  for (let y = 1; y < h; y += 1.4) {
    for (const [x, z, w, d] of [[0, -0.6, 1.3, 0.1], [0, 0.6, 1.3, 0.1], [-0.6, 0, 0.1, 1.3], [0.6, 0, 0.1, 1.3]]) {
      const b = new THREE.Mesh(worldBox(w, 0.1, d), mat);
      b.position.set(x, y, z); g.add(b);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
