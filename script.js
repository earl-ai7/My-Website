const $ = s => document.querySelector(s);
const ring = $('#ring'), bar = $('#bar');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== Loading intro: real progress (3D library, 3D scene, fonts, page), then a smooth reveal ===== */
const intro = $('#intro');
let target = 6, shown = 0, built = false, pageDone = false, fontsDone = false, finished = false;
const t0 = performance.now(), MIN = calm ? 500 : 2600;          // keep the intro up long enough to be seen
const setTarget = v => { target = Math.max(target, v); };
const check = () => { if (built && pageDone && fontsDone) setTarget(100); };
function reveal() {
  if (finished) return; finished = true;
  if (calm) {
    setTimeout(() => { introAt = performance.now(); introGo = true; }, 0);
    holdRender = false; document.body.classList.remove('loading'); intro.style.transition = 'opacity .3s'; intro.style.opacity = 0; setTimeout(() => intro.remove(), 350); return;
  }
  // The camera travels into the loading rose and goes through its center:
  // every petal layer rushes past (outer layers fastest), the dark heart grows until it fills the screen, then the portfolio scene appears.
  // The header and hero text wait until the trip is finished.
  document.body.classList.add('revealing');
  const bloom = $('.bloom'), lays = [...document.querySelectorAll('.bloom .lay')];   // outer petals, middle petals, inner petals, heart
  bloom.style.overflow = 'visible'; bloom.style.filter = 'none';
  lays.forEach(l => { l.style.animation = 'none'; });
  const speed = [1.35, 1.2, 1.05, .9], swirl = [28, -40, 55, 0], DUR = 3200, MAXZ = 500, T0 = performance.now();
  setTimeout(() => { introAt = performance.now(); introGo = true; }, DUR - 300);   // the camera stays at the top view while the heart fades away, then glides to the normal view
  (function step(now) {
    const t = Math.min(1, (now - T0) / DUR), e = t * t * t * (t * (6 * t - 15) + 10), z = Math.pow(MAXZ, e);   // z = how close the camera is to the center
    lays.forEach((l, i) => { l.style.transform = `scale(${Math.pow(z, speed[i])}) rotate(${swirl[i] * e}deg)`; });
    if (holdRender && t > .5) holdRender = false;                     // wake the 3D scene only when it starts to appear
    intro.style.opacity = 1 - sstep(.6, 1, t);                       // the dark heart fades into the scene
    if (t < 1) requestAnimationFrame(step);
    else { intro.remove(); document.body.classList.remove('loading', 'revealing'); }
  })(T0);
}
function introTick(now) {
  if (finished) return;
  const goal = Math.min(target, calm ? 100 : (now - t0) / MIN * 100);   // bar fills steadily, never ahead of real loading
  shown += (goal - shown) * .1; if (goal - shown < .4) shown = goal;
  if (shown >= 100 && now - t0 >= MIN) return reveal();
  requestAnimationFrame(introTick);
}
requestAnimationFrame(introTick);
setTarget(30);
requestAnimationFrame(() => setTimeout(() => { build3D(); built = true; setTarget(75); check(); }, 60));   // build after the intro has painted
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsDone = true; setTarget(85); check(); });
if (document.readyState === 'complete') { pageDone = true; check(); } else addEventListener('load', () => { pageDone = true; check(); });
setTimeout(() => setTarget(100), 9000);                          // never trap anyone on the intro

/* ===== Three.js: 3D flower + flower field, camera travels with scroll ===== */
let mx = 0, my = 0, slow = 1, ringSpin = 0, last = 0, gl = null, pollen = null, spinner = null, introGo = false, introAt = 0, flightT0 = null, smx = 0, smy = 0, fc = 0, holdRender = true;   // holdRender: the 3D scene is not redrawn while the intro plays (keeps the dive smooth)
const FLIGHT = 3800;   // ms the camera takes to fly through the rose center
const roses = [];
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
ring.addEventListener('pointerenter', () => slow = .25);
ring.addEventListener('pointerleave', () => slow = 1);
const lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

function build3D() { try {
  const YG = 0x9acd32, rnd = Math.random;
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x000000, .035);
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, .4));
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.5); sun.position.set(4, 8, 6); scene.add(sun);
  const glow = new THREE.PointLight(0xff6a5a, 1.2, 30); glow.position.set(0, 2, 3); scene.add(glow);

  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x04200a, .5));
  const o = new THREE.Object3D(), UP = new THREE.Vector3(0, 1, 0);

  // Leaf surface (tapered, veined, green gradient)
  function shape(len, wid, cup, curl, c0, c1, c2, su, sv, start, serr) {
    const g = new THREE.PlaneGeometry(1, 1, su, sv), ps = g.attributes.position, cols = [], C0 = new THREE.Color(c0), C1 = new THREE.Color(c1), C2 = new THREE.Color(c2), c = new THREE.Color();
    for (let i = 0; i < ps.count; i++) {
      const u = ps.getX(i) * 2, v = ps.getY(i) + .5, prof = Math.pow(Math.sin(Math.PI * Math.pow(v, .7)), .75) * (1 - .15 * v) * (1 + (serr || 0) * ((v * 14) % 1 - .5));
      ps.setXYZ(i, u * wid * .5 * prof, cup * u * u * prof * wid - curl * v * v * len * .5, start + v * len);
      (v < .5 ? c.copy(C0).lerp(C1, v * 2) : c.copy(C1).lerp(C2, (v - .5) * 2)).multiplyScalar(1 + .22 * Math.exp(-u * u * 60));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
  }
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .42 });
  const roseMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .72, metalness: 0 });   // velvety red petals
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x1b6e36, roughness: .6 });

  // One hybrid-tea petal: wraps the axis, belly bulges out, pointed tip rolls back, side edges flare, bright velvet lip. lay = 0 (centre) .. 1 (outer)
  function petal(rho, len, tilt, span, curl, az, shade, su, sv, lay) {
    const g = new THREE.PlaneGeometry(1, 1, su, sv), ps = g.attributes.position, cols = [], c = new THREE.Color();
    const C0 = new THREE.Color(0x2a0308), C1 = new THREE.Color(0x7d0612), C2 = new THREE.Color(0xb30f1b), C3 = new THREE.Color(0xe23a30);
    for (let i = 0; i < ps.count; i++) {
      let u = ps.getX(i) * 2, v = ps.getY(i) + .5; const vr = v;
      u *= 1 - .3 * sstep(.7, 1, v);                                                       // narrow toward the point
      v *= 1 - .26 * Math.pow(Math.abs(u), 1.2) * sstep(.55, 1, v);                       // pointed top edge
      const au = Math.abs(u), tp = sstep(.5, 1, v), edge = Math.pow(au, 3) * sstep(.25, 1, v), ang = az + u * span / 2;
      const rr = rho + Math.sin(tilt) * v * len + .3 * len * (.25 + .75 * lay) * Math.sin(Math.PI * Math.min(1, v / .85))   // belly
        + curl * len * .32 * Math.pow(tp, 1.7) + lay * lay * edge * len * .2 + Math.sin(u * 5 + az * 3) * .02 * v * v * len;
      const yy = Math.cos(tilt) * v * len - curl * len * .2 * tp * tp - lay * edge * len * .08;
      ps.setXYZ(i, Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
      if (vr < .5) c.copy(C0).lerp(C1, vr * 2); else if (vr < .9) c.copy(C1).lerp(C2, (vr - .5) / .4); else c.copy(C2).lerp(C3, (vr - .9) * 5);
      c.lerp(C3, .45 * Math.max(sstep(.8, 1, au), sstep(.85, 1, vr)) * (.4 + .6 * lay));      // brighter lip on the edges
      c.multiplyScalar(shade * (1 - .12 * Math.pow(Math.sin(u * 4), 2)));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
  }
  function merge(gs) {
    const PA = [], NA = [], CA = [];
    gs.forEach(g => { const q = g.toNonIndexed(); PA.push(...q.attributes.position.array); NA.push(...q.attributes.normal.array); CA.push(...q.attributes.color.array); });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.Float32BufferAttribute(PA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(NA, 3)); m.setAttribute('color', new THREE.Float32BufferAttribute(CA, 3));
    return m;
  }
  // A full rose: petals spiral outward at the golden angle. Small tight wraps in the middle, big cupped petals with rolled tips outside.
  function roseGeo(n, su, sv) {
    const gs = [], r = k => (rnd() - .5) * k;
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      gs.push(petal(.04 + .26 * Math.pow(t, .9), (.7 + 1.25 * Math.pow(t, .75)) * (1 + r(.1)), .02 + .2 * Math.pow(t, 1.6) + r(.05), 3.3 - 1.7 * Math.pow(t, .8),
        .05 + Math.pow(t, 2.4), i * 2.39996 + r(.15), (.45 + .6 * t) * (1 + r(.12)), su, sv, t));
    }
    return merge(gs);
  }
  const variants = [roseGeo(40, 10, 12)];
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x4a0509, roughness: .8 }), calyxMat = new THREE.MeshStandardMaterial({ color: 0x1f7a3c, roughness: .6 });
  const bigMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .6, metalness: 0, sheen: new THREE.Color(0xff5040), clearcoat: .15, clearcoatRoughness: .5 });
  function rose(vi) {
    const g = new THREE.Group(), head = new THREE.Mesh(variants[vi], bigMat), core = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), coreMat), hip = new THREE.Mesh(new THREE.SphereGeometry(.38, 14, 10), calyxMat);
    core.position.y = .12; hip.position.y = -.2; hip.scale.y = .8;
    head.castShadow = head.receiveShadow = true; core.castShadow = true;
    const sepGeo = shape(1, .3, -.2, 1.1, 0x14501f, 0x1f7a3c, 0x3c9a52, 4, 8, 0);   // five sepals curling down from under the bloom
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * 6.283, sp = new THREE.Mesh(sepGeo, leafMat); sp.position.set(Math.sin(a) * .15, -.05, Math.cos(a) * .15); sp.rotation.y = a; sp.rotateX(.9); sp.castShadow = true; g.add(sp);
    }
    g.add(head, core, hip); return g;
  }

  // One single rose, centred: a big bloom on one stem with a few leaves
  const bouquet = new THREE.Group(), RP = new THREE.Vector3(0, .2, -1.6), F0 = new THREE.Vector3(0, -6, -2.4);
  {
    const inner = rose(0), g = new THREE.Group(), dir = new THREE.Vector3(0, 1, .4).normalize();
    g.add(inner); spinner = inner;
    g.position.copy(RP); g.quaternion.setFromUnitVectors(UP, dir); g.scale.setScalar(1.3); bouquet.add(g);
    const key = new THREE.DirectionalLight(0xfff2e6, 2.2); key.position.set(RP.x + 3, RP.y + 5, RP.z + 4); key.target.position.copy(RP);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02;
    Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 1, far: 16 }); key.shadow.camera.updateProjectionMatrix();
    scene.add(key, key.target);
    const rim = new THREE.PointLight(0xff7a66, 1.1, 14); rim.position.set(RP.x - 3, RP.y + 1.5, RP.z - 2.5); scene.add(rim);
    const d2 = F0.clone().sub(RP), L = d2.length(), st = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, L, 10), stemMat);
    st.position.copy(RP).addScaledVector(d2, .5); st.quaternion.setFromUnitVectors(UP, d2.normalize()); bouquet.add(st);
    roses.push({ g, k: 1.3, s: 0 });
    // Dark green serrated leaves in groups of three, alternating up the stem
    const leafletGeo = shape(1.5, .8, -.1, .35, 0x1e4a16, 0x3d7a28, 0x6f9f3e, 6, 28, .05, .09);
    const compound = sc => {
      const cg = new THREE.Group(), add = (x, ry, k, z) => { const m = new THREE.Mesh(leafletGeo, leafMat); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(k * sc); m.castShadow = true; cg.add(m); };
      add(0, 0, 1, .35); add(-.1, -.95, .72, .2); add(.1, .95, .72, .2); return cg;
    };
    [[-1.2, 0], [-2.7, Math.PI], [-4.0, .6]].forEach(([y, a], i) => {
      const l = compound(1.1), z = lerp(F0.z, RP.z, (y - F0.y) / (RP.y - F0.y));
      l.position.set(Math.cos(a) * .1, y, z + Math.sin(a) * .1); l.rotation.set(-.35 - i * .1, Math.PI / 2 - a, 0, 'YXZ'); bouquet.add(l);
    });
  }
  scene.add(bouquet);

  // Ground, a field of small roses (instanced), grass and pollen
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x06200d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -6; scene.add(ground);
  const headGeo = roseGeo(10, 2, 3); headGeo.scale(.15, .15, .15);
  const N = innerWidth < 860 ? 450 : 900, stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .035, 1, 5), stemMat, N);
  const heads = new THREE.InstancedMesh(headGeo, roseMat, N), F = [], gc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = 3 + Math.sqrt(rnd()) * 40, a = rnd() * 6.283;
    F.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: .8 + rnd() * 1, ph: rnd() * 6.28, tx: .3 + rnd() * .6, ry: rnd() * 6.28, sc: .8 + rnd() * .7 });
    heads.setColorAt(i, gc.setScalar(.65 + rnd() * .35));
  }
  scene.add(stems, heads);
  const GR = innerWidth < 860 ? 1800 : 4000, bg = new THREE.ConeGeometry(.045, 1, 3); bg.translate(0, .5, 0);
  const grass = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ roughness: .9 }), GR);
  for (let i = 0; i < GR; i++) {
    const r = 1.5 + Math.sqrt(rnd()) * 46, a = rnd() * 6.283;
    o.position.set(Math.cos(a) * r, -6, Math.sin(a) * r); o.rotation.set((rnd() - .5) * .4, rnd() * 6.28, (rnd() - .5) * .4); o.scale.set(1, .5 + rnd() * .9, 1); o.updateMatrix();
    grass.setMatrixAt(i, o.matrix); grass.setColorAt(i, gc.setHSL(.27 + rnd() * .08, .6, .15 + rnd() * .15));
  }
  scene.add(grass);
  const PN = 450, pa = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pa[i * 3] = (rnd() - .5) * 50; pa[i * 3 + 1] = -6 + rnd() * 14; pa[i * 3 + 2] = (rnd() - .5) * 50; }
  pollen = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pa, 3)), new THREE.PointsMaterial({ color: 0xffd9a0, size: .08, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pollen);

  // Drifting petals
  const P = 300, petals = new THREE.InstancedMesh(new THREE.SphereGeometry(.12, 6, 4), new THREE.MeshStandardMaterial({ color: 0x9b0f18, emissive: 0x330005 }), P), pd = [];
  for (let i = 0; i < P; i++) pd.push({ x: (rnd() - .5) * 30, y: -6 + rnd() * 18, z: (rnd() - .5) * 24, s: .4 + rnd(), r: rnd() * 6 });
  scene.add(petals);

  // Camera path: each stop matches a page section
  const K = [[0, [0, 1.2, 14], [0, .2, 0]], [.22, [8, 2.5, 9], [0, 0, 0]], [.45, [2, -3.2, 7], [0, -3.5, 0]], [.7, [-6, -4.6, 5], [0, -5.2, -3]], [1, [0, -1, 12], [0, -1, 0]]];
  // First phase: the camera starts at the TOP, right above the rose, looking straight down into the bloom
  const pos = calm ? new THREE.Vector3(0, 1.2, 14) : RP.clone().addScaledVector(new THREE.Vector3(0, 1, .4).normalize(), 5.5), look = calm ? new THREE.Vector3() : RP.clone(), tp = new THREE.Vector3(), tl = new THREE.Vector3(), d = new THREE.Object3D();
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ax = new THREE.Vector3(), pf = new THREE.Vector3(), lf = new THREE.Vector3();
  let glideT = null; const p0 = new THREE.Vector3(), l0 = new THREE.Vector3(), GLIDE = 3200, ease3 = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function path(p) {
    let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], s = sstep(0, 1, (p - a[0]) / (b[0] - a[0]));
    tp.set(lerp(a[1][0], b[1][0], s), lerp(a[1][1], b[1][1], s), lerp(a[1][2], b[1][2], s));
    tl.set(lerp(a[2][0], b[2][0], s), lerp(a[2][1], b[2][1], s), lerp(a[2][2], b[2][2], s));
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  gl = (t, p, dt) => {
    const kc = 1 - Math.exp(-dt * 4);   // frame-rate independent camera smoothing
    const calmK = calm ? 0 : 1;
    roses.forEach(r => r.g.scale.setScalar(r.k * (.55 + .45 * sstep(r.s, r.s + .18, p)) * (1 + Math.sin((t + r.s * 9000) / 900) * .012 * calmK)));   // buds open one by one
    bouquet.rotation.y = Math.sin(p * 5) * .25 + smx * .35 + Math.sin(t * .0003) * .08 * calmK;
    if (spinner) { spinner.rotation.y = t * .0003 * calmK + p * 6 + smx * .8; spinner.rotation.x = Math.sin(t * .0005) * .06 * calmK - smy * .25; }   // slow turntable so the bloom's depth shows
    if (pollen) { pollen.rotation.y = t * .00004 * calmK; pollen.position.y = Math.sin(t * .0004) * .3 * calmK; }
    path(p); const k = innerWidth < innerHeight ? 1 + (1 - innerWidth / innerHeight) * .7 : 1;   // pull back on phones
    tp.x *= k; tp.z *= k; tp.x += smx * 1.2; tp.y -= smy * .8;
    const u = flightT0 === null ? 1 : Math.min(1, (t - flightT0) / FLIGHT);
    if (u < 1) {
      // Intro flight: start above the bloom, dive along its axis, pass through the center, then blend into the normal scroll path
      const g = roses[0].g; g.getWorldPosition(wp); g.getWorldQuaternion(wq); ax.set(0, 1, 0).applyQuaternion(wq);   // bloom center + axis (world)
      const D = lerp(6, -1.8, u * u * (3 - 2 * u)), s = sstep(.72, 1, u);
      pf.copy(wp).addScaledVector(ax, D); lf.copy(wp).addScaledVector(ax, D - 3);
      pos.copy(pf).lerp(tp, s); look.copy(lf).lerp(tl, s);
    } else {
      if (introGo) {
        if (calm) { pos.lerp(tp, .06); look.lerp(tl, .06); }
        else {
          // glide from the top view to the normal view: time-based, eased at both ends
          if (glideT === null) { glideT = t; p0.copy(pos); l0.copy(look); }
          const gk = Math.min(1, (t - glideT) / GLIDE), k = ease3(gk);
          if (gk < 1) { pos.copy(p0).lerp(tp, k); look.copy(l0).lerp(tl, k); }
          else { pos.lerp(tp, kc); look.lerp(tl, kc); }   // afterwards follow the scroll smoothly
        }
      }
    }
    cam.position.copy(pos); cam.lookAt(look);
    glow.position.set(pos.x, pos.y + 1, pos.z - 3);
    for (let i = 0; i < N; i++) {
      const f = F[i], sw = Math.sin(t * .0012 * calmK + f.ph) * .12, s = Math.sin(sw), c = Math.cos(sw);
      d.rotation.set(0, 0, sw); d.scale.set(1, f.h, 1); d.position.set(f.x - s * f.h / 2, -6 + c * f.h / 2, f.z); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
      d.rotation.set(f.tx, f.ry, sw); d.scale.setScalar(f.sc); d.position.set(f.x - s * f.h, -6 + c * f.h, f.z); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
    }
    stems.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < P; i++) {
      const q = pd[i]; if (!calm) { q.y -= .008 * q.s; q.x += Math.sin(t * .0006 + q.r) * .004; if (q.y < -6.2) q.y = 12; }
      d.rotation.set(q.r + t * .001 * calmK, q.r, 0); d.scale.set(1, .25, .6); d.position.set(q.x, q.y, q.z); d.updateMatrix(); petals.setMatrixAt(i, d.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    renderer.render(scene, cam);
  };
  gl(performance.now(), 0, .016);   // warm-up frame: compiles shaders now, while the loading screen covers it
} catch (err) { console.warn('3D scene unavailable', err); } }

let sp = 0, lt = 0;   // sp = smoothed scroll progress
function frame(t) {
  const dt = Math.min(.05, Math.max(.001, (t - lt) / 1000)); lt = t; fc++;
  const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight), kd = 1 - Math.exp(-dt * 5);
  sp += (y / max - sp) * kd;                                 // scroll progress eases toward the real scroll, so the camera never jumps
  smx += (mx - smx) * (1 - Math.exp(-dt * 4)); smy += (my - smy) * (1 - Math.exp(-dt * 4));   // pointer eased too
  if (!calm) ringSpin += Math.min(t - last, 50) * .02 * slow; last = t;
  if (gl && !holdRender) gl(t, sp, dt);
  ring.style.transform = `rotateY(${ringSpin + sp * max * .15}deg)`;
  bar.style.transform = `scaleX(${sp})`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ===== Reveal on scroll + current menu link ===== */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); } }), { threshold: .15 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));
const links = [...document.querySelectorAll('nav a')];
const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.hash === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section').forEach(s => so.observe(s));

/* ===== 3D tilt on cards (mouse only) ===== */
document.querySelectorAll('.tilt').forEach(c => {
  c.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || calm) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transition = 'transform .15s ease-out, border-color .3s, box-shadow .3s';
    c.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg)`;
  });
  c.addEventListener('pointerleave', () => { c.style.transition = 'transform .7s cubic-bezier(.2,.7,.2,1), border-color .3s, box-shadow .3s'; c.style.transform = ''; });
});

/* ===== Social media links: set YOUR links here. Clicking a card opens the link you set. ===== */
const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/earllaurence.caseva',
  instagram: 'https://www.instagram.com/earlllh/',
  tiktok: 'https://www.tiktok.com/@earlh',
  telegram: 'https://t.me/earlllh',
  github: 'https://github.com/earl-ai7',
  linkedin: 'https://www.linkedin.com/in/earl-basas-8a763744a/',
  email: 'mailto:' + ['earllaurencecaseva143', 'gmail.com'].join('@')   // built in pieces so spam bots can't scrape it from the file
};
document.querySelectorAll('[data-social]').forEach(a => {
  const url = SOCIAL_LINKS[a.dataset.social];
  if (!url) { a.parentElement.remove(); return; }                      // no link set = card hidden
  a.href = url;
  if (url.startsWith('mailto:')) a.removeAttribute('target');          // email opens the mail app, not a new tab
  a.querySelector('p').textContent = url.replace(/^(https?:\/\/(www\.)?|mailto:)/, '');   // show the link under the name
});

/* ===== Contact form: sends the message to your email through Web3Forms (free) =====
   1. Go to https://web3forms.com, enter your email, and they send you an Access Key.
   2. Paste that key below. Messages from this form then arrive in your inbox. */
const WEB3FORMS_KEY = 'd5ae9121-a7e3-476c-94c0-6b0180a49d0f';
const COOLDOWN_MS = 30000;   // a visitor must wait 30 seconds between messages (stops spam floods)
$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const n = $('#n').value.trim(), e = $('#e').value.trim(), m = $('#m').value.trim(), okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  $('#en').textContent = n ? '' : 'Enter your name.';
  $('#ee').textContent = okMail ? '' : 'Enter a valid email, like name@example.com.';
  $('#em').textContent = m.length >= 10 ? '' : 'Write a message of at least 10 characters.';
  const ok = n && n.length <= 80 && okMail && e.length <= 120 && m.length >= 10 && m.length <= 2000, out = $('#ok'), btn = $('#send');
  out.style.color = '';
  if (!ok) { out.textContent = ''; return; }
  if ($('#bot').checked) return;                                       // a bot filled the hidden box: ignore silently
  if (!WEB3FORMS_KEY || WEB3FORMS_KEY.startsWith('PASTE')) { out.style.color = '#ff8a8a'; out.textContent = 'Form not connected yet. Add your Web3Forms access key in the script.'; return; }
  let last = 0; try { last = +localStorage.getItem('lastSent') || 0; } catch (_) {}
  if (Date.now() - last < COOLDOWN_MS) { out.style.color = '#ff8a8a'; out.textContent = 'Please wait a little before sending another message.'; return; }
  btn.disabled = true; btn.style.opacity = .6; out.textContent = 'Sending...';
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'New portfolio message from ' + n, from_name: 'Portfolio contact form', name: n, email: e, message: m })
    });
    const data = await res.json();
    if (res.ok && data.success) { out.textContent = 'Message sent. Thank you, ' + n + '!'; ev.target.reset(); try { localStorage.setItem('lastSent', Date.now()); } catch (_) {} }
    else throw new Error(data.message || 'Request failed');
  } catch (err) {
    out.style.color = '#ff8a8a'; out.textContent = 'Could not send your message. Please try again, or email me directly.';
  } finally { btn.disabled = false; btn.style.opacity = ''; }
});
