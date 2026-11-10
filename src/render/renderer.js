// Three.js sahne: PBR malzemeler, yumuşak gölgeler, ortam yansımaları, temaya göre diorama dekoru.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getMaterial, worldBox } from './textures.js';
import {
  createCharacter, createKey, createDoor, createCrate, createPlate, createGate, createBridge, createSpikes, createMover,
  createTree, createBush, createBench, createLamp, createGear, createCone, createBeamTower,
} from './models.js';
import { PLAYER_COLORS } from '../config.js';

const DEPTH = 3;
const FOV = 36;

const THEMES = {
  park: {
    skyTop: '#7fb6e8', skyBottom: '#e9f1f2', fog: 0xdfe9ec, fogNear: 30, fogFar: 85,
    sun: 0xfff1d6, sunI: 3.0, sunDir: [-8, 18, 12], hemiSky: 0xcfe6ff, hemiGround: 0x5a4a35, hemiI: 0.9, env: 0.45,
    ground: 'soil', top: 'grass', platform: 'wood', elevated: 'darkwood', floor: 'grass', exposure: 1.0,
  },
  workshop: {
    skyTop: '#3b3f46', skyBottom: '#8a8178', fog: 0x6d665f, fogNear: 22, fogFar: 60,
    sun: 0xffe2b8, sunI: 2.4, sunDir: [6, 16, 10], hemiSky: 0xfff0dd, hemiGround: 0x3a332c, hemiI: 0.8, env: 0.6,
    ground: 'concrete', top: null, platform: 'metal', elevated: 'darkmetal', floor: 'wood', exposure: 1.05,
  },
  construction: {
    skyTop: '#41528a', skyBottom: '#f3a76a', fog: 0xd99a72, fogNear: 28, fogFar: 85,
    sun: 0xffb57a, sunI: 3.2, sunDir: [-14, 9, 10], hemiSky: 0xa9b8ff, hemiGround: 0x6a4630, hemiI: 0.7, env: 0.4,
    ground: 'concrete', top: null, platform: 'rust', floor: 'asphalt', exposure: 1.0,
  },
};

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

export class GameRenderer {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 250);
    this.camDist = 16;
    this.quality = 'high';

    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 16; sc.bottom = -10; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.particles = [];
    this.time = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.quality = q;
    const low = q === 'low';
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !low;
    this.sun.castShadow = !low;
    this.resize();
  }

  halfWidthAt(dist) {
    return dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.camera.aspect;
  }

  // ------------------------------------------------------------ bölüm kurulumu
  buildLevel(level, world) {
    this.levelGroup.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    this.scene.remove(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.particles = [];
    const T = THEMES[level.theme] || THEMES.park;
    this.theme = T;
    this.level = level;

    this.scene.background = gradientTexture(T.skyTop, T.skyBottom);
    this.scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.scene.environmentIntensity = T.env;
    this.renderer.toneMappingExposure = T.exposure;
    this.hemi.color.set(T.hemiSky); this.hemi.groundColor.set(T.hemiGround); this.hemi.intensity = T.hemiI;
    this.sun.color.set(T.sun); this.sun.intensity = T.sunI;

    const G = this.levelGroup;
    const add = (m) => { G.add(m); return m; };

    // zemin / platformlar
    for (const s of world.statics) {
      if (s.invisible) continue;
      const thin = s.h <= 0.6;
      const kind = thin ? T.platform : (s.y > 0.5 && T.elevated) ? T.elevated : T.ground;
      const mesh = new THREE.Mesh(worldBox(s.w, s.h, DEPTH, thin ? 0.5 : 0.35), getMaterial(kind));
      mesh.position.set(s.x + s.w / 2, s.y + s.h / 2, 0);
      mesh.castShadow = true; mesh.receiveShadow = true;
      add(mesh);
      const elevated = s.y > 0.5 && T.elevated;
      if (T.top && !thin && !elevated) {
        const top = new THREE.Mesh(worldBox(s.w + 0.06, 0.16, DEPTH + 0.06, 0.4), getMaterial(T.top));
        top.position.set(s.x + s.w / 2, s.y + s.h - 0.05, 0);
        top.receiveShadow = true; top.castShadow = true;
        add(top);
        this.addGrassTufts(s, G);
      }
      if (!T.top && !thin && level.theme === 'workshop' && s.y <= 0.5) {
        const edge = new THREE.Mesh(worldBox(s.w, 0.08, 0.06, 1), getMaterial('hazard'));
        edge.position.set(s.x + s.w / 2, s.y + s.h - 0.06, DEPTH / 2 + 0.03);
        add(edge);
      }
    }

    // geniş zemin düzlemi (diorama masası)
    const floorMat = getMaterial(T.floor, { seed: 6 }).clone();
    floorMat.map = floorMat.map.clone(); floorMat.map.repeat.set(40, 30); floorMat.map.needsUpdate = true;
    floorMat.bumpMap = floorMat.map;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(level.width + 160, 120), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(level.width / 2, -0.02, -60 - DEPTH / 2 - 0.05);
    floor.receiveShadow = true;
    add(floor);
    const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(level.width + 160, 40), getMaterial(T.ground === 'soil' ? 'soil' : 'concrete'));
    pitFloor.rotation.x = -Math.PI / 2;
    pitFloor.position.set(level.width / 2, -3, 0);
    pitFloor.receiveShadow = true;
    add(pitFloor);

    for (const s of world.spikes) {
      const sp = createSpikes(s.w, s.h);
      sp.position.set(s.x, s.y, 0);
      add(sp);
    }

    this.decor(level, G);

    // dinamik nesneler
    this.dyn = {
      blocks: world.blocks.map((b) => add(createCrate(b.w, b.h))),
      plates: world.plates.map((p) => { const m = add(createPlate(p.w)); m.position.set(p.x, p.y, 0.3); return m; }),
      gates: world.gates.map((g) => {
        const m = add(g.axis === 'x' ? createBridge(g.w, g.h) : createGate(g.w, g.h));
        m.position.set(g.x, g.y, 0); return m;
      }),
      movers: world.movers.map((m) => add(createMover(m.w, m.h, m.mode === 'loop' ? null : 'lift'))),
      key: add(createKey()),
      door: add(createDoor(level.theme)),
      players: [],
    };
    this.dyn.door.position.set(world.door.x, world.door.y, -0.6);
    this.syncPlayers(world);
    this.camX = world.cam.x; this.camY = 2.5; this.camDist = 16;
  }

  syncPlayers(world) {
    for (const m of this.dyn.players) this.levelGroup.remove(m);
    this.dyn.players = world.players.map((p) => {
      const c = PLAYER_COLORS[p.slot.color];
      const m = createCharacter(c.hex, p.slot.color + 1);
      m.userData.anim = { scale: 1, squash: 0, walk: 0, yaw: 0 };
      this.levelGroup.add(m);
      return m;
    });
  }

  addGrassTufts(s, G) {
    const n = Math.floor(s.w * 9);
    if (!n) return;
    const geo = new THREE.ConeGeometry(0.035, 0.22, 3);
    geo.translate(0, 0.11, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4f8a34, roughness: 0.85 });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const r = rng(Math.floor(s.x * 100 + 7));
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const front = r() < 0.6;
      pos.set(s.x + r() * s.w, s.y + s.h + 0.02, front ? DEPTH / 2 - r() * 0.25 : -DEPTH / 2 + r() * 0.3);
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5));
      const k = 0.6 + r() * 0.9;
      sc.set(k, k, k);
      m.compose(pos, q, sc);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHSL(0.26 + r() * 0.06, 0.45, 0.25 + r() * 0.12));
    }
    G.add(inst);
  }

  decor(level, G) {
    const r = rng(level.width * 13 + level.theme.length);
    const W = level.width;
    if (level.theme === 'park') {
      for (let x = -12; x < W + 14; x += 4 + r() * 4) {
        const t = createTree(r); t.position.set(x, 0, -5 - r() * 12); G.add(t);
      }
      for (let x = -4; x < W + 4; x += 5 + r() * 6) {
        const b = createBush(r); b.position.set(x, 0, -2.4 - r() * 1.5); G.add(b);
      }
      for (let x = 6; x < W; x += 16 + r() * 8) {
        const b = createBench(); b.position.set(x, 0, -3.6); G.add(b);
      }
      for (let x = 10; x < W; x += 18) {
        const l = createLamp(); l.position.set(x, 0, -2.6); G.add(l);
      }
    } else if (level.theme === 'workshop') {
      const wall = new THREE.Mesh(worldBox(W + 60, 16, 0.3, 0.25), getMaterial('pegboard'));
      wall.position.set(W / 2, 8, -9); wall.receiveShadow = true; G.add(wall);
      for (let x = -6; x < W + 6; x += 9 + r() * 5) {
        const shelfY = 2.5 + r() * 3;
        const shelf = new THREE.Mesh(worldBox(5, 0.15, 1.3), getMaterial('wood', { seed: 2 }));
        shelf.position.set(x, shelfY, -8.2); shelf.castShadow = shelf.receiveShadow = true; G.add(shelf);
        for (let i = 0; i < 4; i++) {
          if (r() < 0.5) {
            const can = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 20),
              new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(r(), 0.5, 0.45), metalness: 0.7, roughness: 0.35 }));
            can.position.set(x - 2 + i * 1.2, shelfY + 0.38, -8.2); can.castShadow = true; G.add(can);
          } else {
            const box = new THREE.Mesh(worldBox(0.8, 0.6, 0.8), getMaterial('crate'));
            box.position.set(x - 2 + i * 1.2, shelfY + 0.38, -8.2); box.castShadow = true; G.add(box);
          }
        }
      }
      this.gears = [];
      for (let x = 4; x < W; x += 14 + r() * 6) {
        const gr = createGear(1 + r() * 1.4, r); gr.position.set(x, 4 + r() * 4, -6.5); G.add(gr);
        this.gears.push(gr);
      }
      for (let x = 0; x < W; x += 20) {
        const lamp = new THREE.PointLight(0xffc888, 18, 14, 2);
        lamp.position.set(x + 8, 7, 1);
        G.add(lamp);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8),
          new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffc888, emissiveIntensity: 3 }));
        bulb.position.copy(lamp.position); G.add(bulb);
      }
    } else {
      for (let x = -10; x < W + 10; x += 10 + r() * 8) {
        const t = createBeamTower(5 + r() * 8); t.position.set(x, 0, -8 - r() * 10); G.add(t);
      }
      const crane = createBeamTower(22); crane.position.set(W * 0.55, 0, -26); G.add(crane);
      const jib = new THREE.Mesh(worldBox(26, 0.6, 0.6), getMaterial('rust', { seed: 4 }));
      jib.position.set(W * 0.55 + 8, 22.3, -26); jib.castShadow = true; G.add(jib);
      for (let x = 3; x < W; x += 7 + r() * 6) {
        const c = createCone(); c.position.set(x, 0, -2.2 - r() * 0.8); G.add(c);
      }
      for (let x = 0; x < W; x += 12 + r() * 6) {
        const pile = new THREE.Mesh(worldBox(2.4, 0.5 + r() * 0.5, 1.2), getMaterial('concrete', { seed: 3 }));
        pile.position.set(x, 0.4, -4 - r() * 2); pile.castShadow = pile.receiveShadow = true; G.add(pile);
      }
      // asansör halat direkleri
      for (const m of this.level.movers || []) {
        if (m.mode === 'loop') continue;
        const h = m.path[1][1] + 1.5;
        for (const dz of [-1.3, 1.3]) {
          const rail = new THREE.Mesh(worldBox(0.15, h, 0.15), getMaterial('rust'));
          rail.position.set(m.path[0][0] - 0.2, h / 2, dz); rail.castShadow = true; G.add(rail);
        }
      }
    }
  }

  // ------------------------------------------------------------ olay efektleri
  dust(x, y, color = 0xcbb79a, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 8, 6),
        new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.8 }));
      m.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.05, (Math.random() - 0.5) * 0.8);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5));
      m.userData.life = 0.6;
      this.levelGroup.add(m);
      this.particles.push(m);
    }
  }

  onEvent(e, world) {
    if (e.type === 'land' || e.type === 'jump') {
      const p = world.players[e.id];
      const col = this.level.theme === 'park' ? 0x9c8a6a : 0xbdb6aa;
      this.dust(p.x + p.w / 2, p.y, col, e.type === 'land' ? 10 : 4);
      if (e.type === 'land') this.dyn.players[e.id].userData.anim.squash = 0.28 * (p.landImpact || 0.6) + 0.08;
    }
    if (e.type === 'jump') this.dyn.players[e.id].userData.anim.squash = -0.18;
  }

  // ------------------------------------------------------------ her kare
  update(world, dt) {
    this.time += dt;
    const D = this.dyn;
    if (!D) return;

    // kamera
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const needDist = ((world.cam.spreadY || 0) + 2.6) / tanHalf;
    // fizikteki sabit görüş genişliği (+ küçük pay) her ekranda görünsün
    const widthDist = (world.cam.halfW + 0.4) / (tanHalf * this.camera.aspect);
    const targetDist = Math.min(40, Math.max(15.5, widthDist, Math.min(26, needDist)));
    this.camDist += (targetDist - this.camDist) * Math.min(1, dt * 2);
    this.camX += (world.cam.x - this.camX) * Math.min(1, dt * 10);
    const ty = Math.max(2.6, world.cam.y + 1.2);
    this.camY += (ty - this.camY) * Math.min(1, dt * 3);
    this.camera.position.set(this.camX, this.camY + 2.2, this.camDist);
    this.camera.lookAt(this.camX, this.camY - 0.2, 0);
    const sd = this.theme ? this.theme.sunDir : [-8, 18, 12];
    this.sun.position.set(this.camX + sd[0], this.camY + sd[1], sd[2]);
    this.sun.target.position.set(this.camX, this.camY - 2, 0);

    // oyuncular
    world.players.forEach((p, i) => {
      const m = D.players[i]; if (!m) return;
      const a = m.userData.anim;
      const targetScale = p.entered ? 0.001 : 1;
      a.scale += (targetScale - a.scale) * Math.min(1, dt * 12);
      m.visible = a.scale > 0.02;
      m.position.set(p.x + p.w / 2, p.y, p.entered ? -0.6 : 0);
      a.squash += (0 - a.squash) * Math.min(1, dt * 10);
      if (!p.grounded && p.vy > 2 && a.squash > -0.1) a.squash -= dt * 0.4;
      const moving = p.grounded && Math.abs(p.vx) > 0.5;
      a.walk += dt * (moving ? 14 : 0);
      const wob = moving ? Math.sin(a.walk) * 0.07 : 0;
      a.yaw += (p.facing * 0.38 - a.yaw) * Math.min(1, dt * 10);
      const { pivot, face } = m.userData;
      const s = a.squash;
      pivot.scale.set((1 + s * 0.6) * a.scale, (1 - s) * a.scale, (1 + s * 0.6) * a.scale);
      pivot.rotation.set(0, a.yaw, wob);
      face.position.x = p.facing * 0.06;
      m.userData.badge.visible = !p.entered;
    });

    // anahtar
    const k = world.key;
    D.key.visible = !k.used;
    D.key.position.set(k.x, k.y + (k.holder ? 0 : Math.sin(this.time * 2.5) * 0.12), 0.2);
    D.key.rotation.y = this.time * (k.holder ? 4 : 1.6);

    // kapı
    const dd = D.door.userData;
    const open = world.door.unlocked ? 1 : 0;
    dd.hinge.rotation.y += (-1.75 * open - dd.hinge.rotation.y) * Math.min(1, dt * 4);
    dd.lock.visible = !world.door.unlocked;
    dd.inside.material.emissiveIntensity += (open * 1.6 - dd.inside.material.emissiveIntensity) * Math.min(1, dt * 3);
    dd.light.intensity = dd.inside.material.emissiveIntensity * 6;

    // sandıklar
    world.blocks.forEach((b, i) => {
      const m = D.blocks[i];
      m.position.set(b.x, b.y, 0);
      const remain = Math.max(0, b.req - b.pushers);
      const ud = m.userData;
      if (ud.last !== remain) { ud.tex.userData.draw(String(remain), remain === 0 ? '#9cff8a' : '#fff8e6'); ud.last = remain; }
    });

    // plakalar
    world.plates.forEach((p, i) => {
      const ud = D.plates[i].userData;
      const remain = Math.max(0, p.req - p.count);
      if (ud.last !== remain) {
        ud.tex.userData.draw(String(remain), p.pressed ? '#9cff8a' : '#ffffff', 'rgba(20,20,20,0.75)');
        ud.last = remain;
        ud.btnMat.color.set(p.pressed ? 0x2ecc71 : 0xc0392b);
        ud.btnMat.emissive.set(p.pressed ? 0x2ecc71 : 0xc0392b);
      }
      ud.btn.position.y += ((p.pressed ? 0.06 : 0.12) - ud.btn.position.y) * Math.min(1, dt * 12);
    });

    // parmaklıklar
    world.gates.forEach((g, i) => {
      const ud = D.gates[i].userData;
      if (g.axis === 'x') { ud.deck.scale.x = Math.max(0.001, g.open); ud.deck.visible = g.open > 0.01; }
      else ud.bars.position.y = g.h * g.open;
    });

    // platformlar
    world.movers.forEach((mv, i) => {
      const m = D.movers[i];
      m.position.set(mv.x, mv.y, 0);
      if (m.userData.tex) {
        const txt = `${mv.req >= world.n ? 'HEPSİ ' : ''}${mv.aboard}/${mv.need}`;
        if (m.userData.last !== txt) { m.userData.tex.userData.draw(txt, mv.aboard >= mv.need && mv.need > 0 ? '#9cff8a' : '#fff', 'rgba(25,25,25,0.8)'); m.userData.last = txt; }
      }
    });

    if (this.gears) this.gears.forEach((g, i) => { g.rotation.z += dt * (i % 2 ? 0.3 : -0.3); });

    // parçacıklar
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pm = this.particles[i];
      pm.userData.life -= dt;
      pm.userData.v.y -= dt * 3;
      pm.position.addScaledVector(pm.userData.v, dt);
      pm.material.opacity = Math.max(0, pm.userData.life / 0.6) * 0.8;
      if (pm.userData.life <= 0) { this.levelGroup.remove(pm); pm.geometry.dispose(); pm.material.dispose(); this.particles.splice(i, 1); }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
