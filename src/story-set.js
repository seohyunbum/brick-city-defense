/* =========================================================================
 * story-set.js — 단편 「여든여섯 번째 새벽」의 세트·소품·배우 동작 (순수 팩토리)
 *
 * 만들기만 하고 시간을 굴리지 않는다. 언제 무엇이 움직이는지는 story86.js 가 정한다.
 * 색은 bricks.js 팔레트만 쓰고, 형상은 전부 코드로 생성한다(외부 자산 없음).
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const Cel = L.Cel;

  const TOWER_COLORS = [C.sandBlue, C.lightGray, C.darkBlue, C.cineSteel, C.tan, C.azure, C.white, C.darkGray];
  const BRICK_COLORS = [C.red, C.yellow, C.blue, C.brightGreen, C.orange, C.white, C.azure, C.lime];

  // ---------------------------------------------------------------- 세트
  function ground(scene) {
    const plain = new THREE.Mesh(L.box(1200, 2, 1200), Cel.toon(C.darkTan));
    plain.position.y = -1;
    plain.receiveShadow = true;
    plain.matrixAutoUpdate = false;
    plain.updateMatrix();
    scene.add(plain);

    const plaza = new THREE.Mesh(L.box(96, 0.5, 86), Cel.toon(C.lightGray));
    plaza.position.set(0, 0.15, -6);
    plaza.receiveShadow = true;
    plaza.matrixAutoUpdate = false;
    plaza.updateMatrix();
    scene.add(plaza);

    for (const spec of [[0, -6, 12, 200], [0, -6, 200, 12]]) {
      const road = new THREE.Mesh(L.box(spec[2], 0.4, spec[3]), Cel.toon(C.darkGray));
      road.position.set(spec[0], 0.2, spec[1]);
      road.receiveShadow = true;
      road.matrixAutoUpdate = false;
      road.updateMatrix();
      scene.add(road);
    }
  }

  /** 미래 도시 스카이라인 — 인스턴스 한 번으로 탑 전체를 그린다(드로우콜 1) */
  function skyline(scene, rng) {
    const count = 30;
    const geo = L.roundedBox(1, 1, 1, 0.06, 1);
    const towers = new THREE.InstancedMesh(geo, Cel.toon(C.white), count);
    towers.castShadow = false;
    towers.receiveShadow = false;
    const bandGeo = L.box(1, 1, 1);
    const bands = new THREE.InstancedMesh(bandGeo, Cel.glow(C.cineRim, 0.85), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = -118 + rng() * 236;
      const z = -18 - rng() * 82;
      const w = 6 + rng() * 9;
      const h = 16 + rng() * 54;
      pos.set(x, h / 2, z);
      scl.set(w, h, w * (0.7 + rng() * 0.6));
      m.compose(pos, q, scl);
      towers.setMatrixAt(i, m);
      color.setHex(TOWER_COLORS[(rng() * TOWER_COLORS.length) | 0]);
      towers.setColorAt(i, color);
      // 창문 띠: 탑 위쪽에 얇게 한 줄. 새벽에 켜진 불빛이다.
      pos.set(x, h * 0.72, z);
      scl.set(w * 1.02, 0.7, scl.z * 1.02);
      m.compose(pos, q, scl);
      bands.setMatrixAt(i, m);
    }
    towers.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    bands.instanceMatrix.needsUpdate = true;
    scene.add(towers, bands);
    return { towers, bands };
  }

  /** 도시를 감싼 성벽과 문 — 2장의 카메라가 올라서는 자리 */
  function wall(scene) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(320, 10, 4), Cel.toon(C.cineSteel));
    body.position.set(0, 5, -120);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const cap = new THREE.Mesh(L.box(320, 0.8, 5.6), Cel.toon(C.darkGray));
    cap.position.set(0, 10.4, -120);
    g.add(cap);
    for (let i = -5; i <= 5; i++) {
      const pylon = new THREE.Mesh(L.box(4.5, 13, 6), Cel.toon(C.lightGray));
      pylon.position.set(i * 30, 6.5, -120);
      pylon.castShadow = true;
      g.add(pylon);
      const lamp = new THREE.Mesh(L.sph(0.5, 8), Cel.glow(C.cineRim));
      lamp.position.set(i * 30, 13.4, -120);
      lamp.userData.noOutline = true;
      g.add(lamp);
    }
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    scene.add(g);
    return g;
  }

  /** 격납고 — 3장의 무대 */
  function hangar(scene) {
    const g = new THREE.Group();
    g.position.set(-46, 0, 12);
    const floor = new THREE.Mesh(L.box(30, 0.6, 26), Cel.toon(C.darkGray));
    floor.position.y = 0.3;
    floor.receiveShadow = true;
    g.add(floor);
    const back = new THREE.Mesh(L.box(30, 14, 1), Cel.toon(C.sandBlue));
    back.position.set(0, 7, -13);
    back.castShadow = true;
    g.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(L.box(1, 14, 26), Cel.toon(C.sandBlue));
      side.position.set(sx * 15, 7, 0);
      side.castShadow = true;
      g.add(side);
    }
    const roof = new THREE.Mesh(L.box(31, 1, 27), Cel.toon(C.darkBlue));
    roof.position.set(0, 14.4, 0);
    g.add(roof);
    // 격납고 안은 키 라이트가 닿지 않는다 — 천장등이 켜질 때 같이 켜지는 실내광
    const inner = new THREE.PointLight(C.lookWarm, 0, 70, 1.4);
    inner.position.set(0, 11, 2);
    g.add(inner);
    const lamps = [];
    for (let i = -1; i <= 1; i++) {
      const lamp = new THREE.Mesh(L.box(6, 0.4, 1.2), Cel.glow(C.lookWarm, 0.9));
      lamp.position.set(i * 8, 13.6, 2);
      lamp.userData.noOutline = true;
      lamp.visible = false;
      g.add(lamp);
      lamps.push(lamp);
    }
    // 바닥 경고선과 정비 상자 — 격납고처럼 보이게 하는 최소한의 소품
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(L.box(0.6, 0.1, 22), Cel.toon(C.yellow));
      stripe.position.set(sx * 7.5, 0.62, 0);
      g.add(stripe);
    }
    for (const spec of [[-10, 6, 2.6], [-11.5, 2.5, 1.8], [10.5, -6, 2.2]]) {
      const crate = new THREE.Mesh(L.roundedBox(spec[2], spec[2] * 0.8, spec[2], 0.1, 1), Cel.toon(C.darkTan));
      crate.position.set(spec[0], 0.6 + spec[2] * 0.4, spec[1]);
      crate.castShadow = true;
      g.add(crate);
    }
    const gantry = new THREE.Mesh(L.box(28, 0.7, 0.9), Cel.toon(C.cineSteel));
    gantry.position.set(0, 11.6, -4);
    g.add(gantry);

    // 조종석으로 오르는 사다리
    const ladder = new THREE.Group();
    ladder.position.set(2.6, 0, 3.4);
    for (const sx of [-0.6, 0.6]) {
      const rail = new THREE.Mesh(L.cyl(0.14, 0.14, 7.4, 6), Cel.toon(C.cineSteel));
      rail.position.set(sx, 3.7, 0);
      ladder.add(rail);
    }
    for (let i = 0; i < 8; i++) {
      const rung = new THREE.Mesh(L.box(1.4, 0.16, 0.3), Cel.toon(C.cineSteel));
      rung.position.set(0, 0.6 + i * 0.85, 0);
      ladder.add(rung);
    }
    g.add(ladder);
    scene.add(g);
    return { group: g, lamps, ladder, inner };
  }

  /**
   * 성벽 바깥 벌판의 바위·브릭 더미. 평평한 벌판에서 "내가 움직이고 있다"를
   * 알려 주는 시차(parallax) 재료다. 인스턴스 하나로 전부 그린다(드로우콜 1).
   */
  function plainProps(scene, rng) {
    const count = 54;
    const geo = L.roundedBox(1, 1, 1, 0.12, 1);
    const mesh = new THREE.InstancedMesh(geo, Cel.toon(C.white), count);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    const tints = [C.darkTan, C.tan, C.cineScrapDark, C.reddishBrown, C.cineScrap];
    for (let i = 0; i < count; i++) {
      const x = -150 + rng() * 300;
      const z = -132 - rng() * 118;
      const w = 2.4 + rng() * 5.5;
      const h = 0.7 + rng() * 2.2;
      pos.set(x, h * 0.45, z);
      e.set(0, rng() * Math.PI, 0);
      q.setFromEuler(e);
      scl.set(w, h, w * (0.6 + rng() * 0.7));
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      color.setHex(tints[(rng() * tints.length) | 0]);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  /** 스크랩 기계 — 사람도 동물도 아닌 낡은 3각 기계 */
  function scrapWalker(rng) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(L.roundedBox(3.0, 1.7, 3.4, 0.2, 2), Cel.toon(C.cineScrap));
    hull.position.y = 3.2;
    hull.castShadow = true;
    g.add(hull);
    const cap = new THREE.Mesh(L.roundedBox(2.0, 0.7, 2.2, 0.18, 2), Cel.toon(C.cineScrapDark));
    cap.position.y = 4.2;
    g.add(cap);
    const lens = new THREE.Mesh(L.sph(0.42, 10), Cel.glow(C.cineEye));
    lens.position.set(0, 3.4, -1.6);
    lens.userData.noOutline = true;
    g.add(lens);
    const legs = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const leg = new THREE.Group();
      leg.position.set(Math.sin(a) * 1.1, 3.0, Math.cos(a) * 1.1);
      leg.rotation.z = -Math.sin(a) * 0.5;
      leg.rotation.x = Math.cos(a) * 0.5;
      const shin = new THREE.Mesh(L.cyl(0.2, 0.28, 3.4, 6), Cel.toon(C.cineScrapDark));
      shin.position.y = -1.7;
      shin.castShadow = true;
      leg.add(shin);
      g.add(leg);
      legs.push({ group: leg, base: leg.rotation.x, phase: rng() });
    }
    Cel.outline(g, 0.045);
    g.userData.legs = legs;
    g.userData.bobSeed = rng() * 6.3;
    return g;
  }

  // ---------------------------------------------------------------- 브릭 팝
  /** 쓰러진 기계는 브릭이 되어 흩어진다 — 풀링, 프레임 할당 없음 */
  function BrickBurst(scene, count) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(L.roundedBox(0.9, 0.55, 0.9, 0.08, 1), Cel.toon(C.white), count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.setHex(BRICK_COLORS[i % BRICK_COLORS.length]);
      this.mesh.setColorAt(i, color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.cursor = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._zero = new THREE.Vector3(0, 0, 0);
    this.hideAll();
  }
  BrickBurst.prototype.hideAll = function () {
    for (let i = 0; i < this.count; i++) this.life[i] = 0;
    this._writeAll();
  };
  BrickBurst.prototype.pop = function (x, y, z, amount, power) {
    for (let n = 0; n < amount; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const k = i * 3;
      this.pos[k] = x + (Math.random() - 0.5) * 1.6;
      this.pos[k + 1] = y + Math.random() * 2.2;
      this.pos[k + 2] = z + (Math.random() - 0.5) * 1.6;
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.5 + Math.random() * 0.8);
      this.vel[k] = Math.cos(a) * s;
      this.vel[k + 1] = 4.5 + Math.random() * 5.5;
      this.vel[k + 2] = Math.sin(a) * s;
      this.spin[k] = (Math.random() - 0.5) * 9;
      this.spin[k + 1] = (Math.random() - 0.5) * 9;
      this.spin[k + 2] = (Math.random() - 0.5) * 9;
      this.life[i] = 2.6 + Math.random() * 1.2;
    }
  };
  BrickBurst.prototype.update = function (dt) {
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      alive++;
      const k = i * 3;
      this.life[i] -= dt;
      this.vel[k + 1] -= 22 * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      // 바닥에서 한 번 튀고 구른다 — 브릭이 흩어지는 느낌
      if (this.pos[k + 1] < 0.3) {
        this.pos[k + 1] = 0.3;
        this.vel[k + 1] *= -0.34;
        this.vel[k] *= 0.72;
        this.vel[k + 2] *= 0.72;
        this.spin[k] *= 0.5; this.spin[k + 1] *= 0.5; this.spin[k + 2] *= 0.5;
      }
      this.rot[k] += this.spin[k] * dt;
      this.rot[k + 1] += this.spin[k + 1] * dt;
      this.rot[k + 2] += this.spin[k + 2] * dt;
    }
    if (alive || this._dirty) this._writeAll();
    this._dirty = alive > 0;
  };
  BrickBurst.prototype._writeAll = function () {
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) {
        this._m.compose(this._zero, this._q.identity(), this._zero);
      } else {
        this._p.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
        this._e.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
        this._q.setFromEuler(this._e);
        this._m.compose(this._p, this._q, this._s);
      }
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  };

  // ---------------------------------------------------------------- 배우: 미니피그
  const RUN = { hip: 0.95, arm: 0.8, lean: 0.24 };
  /** 달리기: 팔다리가 서로 반대로 크게, 몸은 앞으로 기울고 위아래로 튄다 */
  function runCycle(fig, phase, intensity) {
    const j = fig.userData.joints;
    if (!j) return;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    j.hipL.rotation.x = s * RUN.hip * intensity;
    j.hipR.rotation.x = -s * RUN.hip * intensity;
    j.armL.rotation.x = -s * RUN.arm * intensity;
    j.armR.rotation.x = s * RUN.arm * intensity;
    j.armL.rotation.z = 0.12 * intensity;
    j.armR.rotation.z = -0.12 * intensity;
    j.body.rotation.x = RUN.lean * intensity;
    j.body.position.y = Math.abs(c) * 0.34 * intensity;
    j.head.rotation.x = -RUN.lean * intensity * 0.7;
  }
  /** 사다리 오르기: 대각선으로 손발이 번갈아 올라간다 */
  function climbCycle(fig, phase) {
    const j = fig.userData.joints;
    if (!j) return;
    const s = Math.sin(phase);
    j.armL.rotation.x = -2.1 - s * 0.5;
    j.armR.rotation.x = -2.1 + s * 0.5;
    j.hipL.rotation.x = 0.5 - s * 0.45;
    j.hipR.rotation.x = 0.5 + s * 0.45;
    j.body.rotation.x = 0.1;
    j.body.position.y = 0;
  }
  /** 가만히 서 있기: 숨 쉬는 정도의 미세한 움직임(완전 정지는 인형처럼 보인다) */
  function idleCycle(fig, t, seed) {
    const j = fig.userData.joints;
    if (!j) return;
    const b = Math.sin(t * 1.5 + seed) * 0.5 + 0.5;
    j.body.position.y = b * 0.06;
    j.armL.rotation.x = -0.06 - b * 0.05;
    j.armR.rotation.x = -0.06 - b * 0.05;
    j.armL.rotation.z = 0.05;
    j.armR.rotation.z = -0.05;
    j.hipL.rotation.x = 0;
    j.hipR.rotation.x = 0;
    j.head.rotation.y = Math.sin(t * 0.6 + seed * 2) * 0.22;
    j.body.rotation.x = 0;
  }

  L.StorySet = {
    TOWER_COLORS, BRICK_COLORS,
    ground, skyline, wall, hangar, plainProps, scrapWalker, BrickBurst,
    runCycle, climbCycle, idleCycle,
  };
})(window.LEGO = window.LEGO || {});
