/* =========================================================================
 * enemies.js — 브릭 몬스터 & 웨이브
 *
 * 사람·동물 모양 상대는 쓰지 않는다. 도시를 습격한 "브릭 덩어리 몬스터"만.
 *   · 브릭 슬라임  : 초록 스터드 뭉치, 통통 뛰어 다가온다
 *   · 브릭 골렘    : 회색 거대 블록, 느리지만 단단하다
 *   · 브릭 배트    : 보라 날개, 낮게 날아온다
 *   · 브릭 드래곤  : 5웨이브마다 나오는 보스. 불덩이를 뱉는다
 * 쓰러지면 피가 아니라 브릭 조각으로 팝 하고 흩어지며 스터드를 떨어뜨린다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  const TYPES = {
    slime: {
      name: '브릭 슬라임', hp: 46, speed: 13.5, radius: 2.4, damage: 1, color: C.brightGreen,
      attackRange: 4.6, attackCd: 1.4, flying: false, score: 60, studs: 1, pool: 26,
    },
    golem: {
      name: '브릭 골렘', hp: 190, speed: 8.2, radius: 3.6, damage: 1, color: C.darkGray,
      attackRange: 6.2, attackCd: 1.9, flying: false, score: 180, studs: 2, pool: 10, bar: true,
    },
    bat: {
      name: '브릭 배트', hp: 58, speed: 19, radius: 2.2, damage: 1, color: C.purple,
      attackRange: 5.4, attackCd: 1.5, flying: true, hover: 11.5, score: 110, studs: 1, pool: 14,
    },
    dragon: {
      name: '브릭 드래곤', hp: 1100, speed: 11, radius: 6.5, damage: 2, color: C.red,
      attackRange: 46, attackCd: 1.25, flying: true, hover: 15, score: 1500, studs: 8,
      pool: 2, boss: true, bar: true, ranged: true,
    },
  };

  // ------------------------------------------------------------------ 모델
  function buildSlime() {
    const g = new THREE.Group();
    const base = L.plate(C.green, 4, 4, { height: 1.6 });
    base.position.y = 0.9;
    const mid = L.plate(C.brightGreen, 3, 3, { height: 1.5 });
    mid.position.y = 2.5;
    const top = L.plate(C.lime, 2, 2, { height: 1.2 });
    top.position.y = 3.8;
    base.castShadow = mid.castShadow = top.castShadow = true;
    g.add(base, mid, top);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.44, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(side * 0.85, 3.1, 1.5);
      const pupil = new THREE.Mesh(L.sph(0.22, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pupil.position.set(side * 0.85, 3.1, 1.85);
      g.add(eye, pupil);
      const arm = new THREE.Mesh(L.box(0.6, 1.4, 0.6), L.mat(C.green));
      arm.position.set(side * 2.4, 2.2, 0);
      arm.rotation.z = side * 0.4;
      g.add(arm);
    }
    const mouth = new THREE.Mesh(L.box(1.5, 0.35, 0.2), L.mat(0x123f22, 'matte'));
    mouth.position.set(0, 2.1, 1.6);
    g.add(mouth);
    return { group: g, parts: { body: g } };
  }

  function buildGolem() {
    const g = new THREE.Group();
    const legs = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(L.box(1.9, 3.2, 2.0), L.mat(C.darkGray));
      leg.position.set(side * 1.5, 1.7, 0);
      leg.castShadow = true;
      legs.add(leg);
    }
    const torso = L.plate(C.darkGray, 7, 5, { height: 5.2 });
    torso.position.y = 6.0;
    torso.castShadow = true;
    const chest = L.plate(C.lightGray, 5, 4, { height: 1.4 });
    chest.position.y = 8.9;
    const head = new THREE.Mesh(L.box(3.4, 2.8, 3.0), L.mat(C.darkGray));
    head.position.y = 10.6;
    head.castShadow = true;
    const arms = new THREE.Group();
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(L.box(1.7, 5.6, 1.9), L.mat(C.lightGray));
      arm.position.set(side * 4.6, 6.4, 0);
      arm.castShadow = true;
      arms.add(arm);
      const fist = new THREE.Mesh(L.box(2.4, 2.2, 2.4), L.mat(C.darkGray));
      fist.position.set(side * 4.6, 3.4, 0);
      arms.add(fist);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.box(0.9, 0.55, 0.2), new THREE.MeshBasicMaterial({ color: 0xff7a18 }));
      eye.position.set(side * 0.85, 10.9, 1.55);
      g.add(eye);
    }
    g.add(legs, torso, chest, head, arms);
    return { group: g, parts: { legs, arms, head } };
  }

  function buildBat() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(2.2, 2.0, 3.0), L.mat(C.purple));
    body.castShadow = true;
    const head = new THREE.Mesh(L.box(1.7, 1.5, 1.6), L.mat(C.magenta));
    head.position.set(0, 0.5, 1.9);
    const wings = new THREE.Group();
    const wingL = new THREE.Mesh(L.box(4.2, 0.32, 2.4), L.mat(C.purple));
    wingL.position.set(-2.8, 0.6, 0);
    const wingR = wingL.clone();
    wingR.position.x = 2.8;
    wings.add(wingL, wingR);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      eye.position.set(side * 0.55, 0.7, 2.6);
      g.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 5), L.mat(C.magenta));
      ear.position.set(side * 0.7, 1.7, 1.7);
      g.add(ear);
    }
    const tail = new THREE.Mesh(L.box(0.5, 0.5, 2.2), L.mat(C.purple));
    tail.position.set(0, 0, -2.2);
    g.add(body, head, wings, tail);
    return { group: g, parts: { wings, wingL, wingR } };
  }

  function buildDragon() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(6.0, 5.0, 11.0), L.mat(C.red));
    body.castShadow = true;
    const belly = L.plate(C.orange, 4, 8, { height: 1.2 });
    belly.position.y = -2.4;
    const neck = new THREE.Mesh(L.box(3.2, 3.0, 5.0), L.mat(C.red));
    neck.position.set(0, 2.4, 6.4);
    neck.rotation.x = 0.35;
    const head = new THREE.Group();
    const skull = new THREE.Mesh(L.box(3.4, 2.8, 4.6), L.mat(C.red));
    const snout = new THREE.Mesh(L.box(2.2, 1.6, 2.4), L.mat(C.darkRed));
    snout.position.set(0, -0.5, 3.2);
    const maw = new THREE.Mesh(L.sph(1.1, 10), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
    maw.position.set(0, -0.5, 4.6);
    head.add(skull, snout, maw);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), L.mat(C.gold, 'metal'));
      horn.position.set(side * 1.2, 2.0, -0.8);
      horn.rotation.set(-0.5, 0, side * 0.4);
      head.add(horn);
      const eye = new THREE.Mesh(L.sph(0.42, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
      eye.position.set(side * 1.3, 0.6, 1.9);
      head.add(eye);
    }
    head.position.set(0, 4.3, 10.6);
    const wings = new THREE.Group();
    const wingGeo = L.box(13.0, 0.5, 7.0);
    const wingL = new THREE.Mesh(wingGeo, L.mat(C.darkRed));
    wingL.position.set(-9.0, 2.4, -0.5);
    const wingR = new THREE.Mesh(wingGeo, L.mat(C.darkRed));
    wingR.position.set(9.0, 2.4, -0.5);
    wingL.castShadow = wingR.castShadow = true;
    wings.add(wingL, wingR);
    const tail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(L.box(3.0 - i * 0.6, 2.4 - i * 0.45, 3.4), L.mat(i % 2 ? C.darkRed : C.red));
      seg.position.set(0, -i * 0.5, -6.5 - i * 3.1);
      tail.add(seg);
    }
    const spikes = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 5), L.mat(C.gold, 'metal'));
      sp.position.set(0, 2.8 - i * 0.15, 3.0 - i * 2.6);
      spikes.add(sp);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(L.box(1.8, 3.0, 2.0), L.mat(C.darkRed));
      leg.position.set(side * 2.4, -3.4, 2.6);
      g.add(leg);
      const claw = new THREE.Mesh(L.box(2.2, 0.8, 2.6), L.mat(C.gold, 'metal'));
      claw.position.set(side * 2.4, -4.8, 3.2);
      g.add(claw);
    }
    g.add(body, belly, neck, head, wings, tail, spikes);
    return { group: g, parts: { wings, wingL, wingR, head, maw, tail } };
  }

  const BUILDERS = { slime: buildSlime, golem: buildGolem, bat: buildBat, dragon: buildDragon };

  // ------------------------------------------------------------------ 체력바
  function hpBar() {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.16), new THREE.MeshBasicMaterial({
      color: 0x1b2a34, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({
      color: 0x4bd44b, side: THREE.DoubleSide,
    }));
    fill.position.z = 0.02;
    g.add(back, fill);
    g.userData.fill = fill;
    return g;
  }

  // ------------------------------------------------------------------ 관리자
  function Enemies(scene, fx, city) {
    this.scene = scene;
    this.fx = fx;
    this.city = city;
    this.list = [];
    this.hooks = { hitPlayer: null, onKill: null, onWaveClear: null };
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.spawnGap = 1.1;
    this.waveActive = false;
    this.boss = null;
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();

    for (const id in TYPES) {
      const t = TYPES[id];
      for (let i = 0; i < t.pool; i++) {
        const built = BUILDERS[id]();
        built.group.visible = false;
        scene.add(built.group);
        let bar = null;
        if (t.bar) {
          bar = hpBar();
          bar.visible = false;
          bar.scale.set(t.radius * 2.2, t.radius * 2.2, 1);
          scene.add(bar);
        }
        this.list.push({
          alive: false, type: id, def: t, group: built.group, parts: built.parts, bar,
          hp: t.hp, maxHp: t.hp, pos: new THREE.Vector3(), speed: t.speed, radius: t.radius,
          color: t.color, phase: Math.random() * 6.28, attackTimer: 0, hurt: 0, stagger: 0,
          y0: 0, scaleBase: 1,
        });
      }
    }
  }

  Enemies.prototype.aliveCount = function () {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].alive) n++;
    return n;
  };

  Enemies.prototype.remaining = function () {
    return this.aliveCount() + this.queue.length;
  };

  /** 웨이브 구성 — 갈수록 많아지고 5웨이브마다 보스 */
  Enemies.prototype.startWave = function (n) {
    this.wave = n;
    this.queue.length = 0;
    const slimes = Math.min(20, 4 + n * 2);
    const bats = n >= 2 ? Math.min(10, Math.floor(n * 0.9)) : 0;
    const golems = n >= 3 ? Math.min(7, Math.floor((n - 1) / 2)) : 0;
    for (let i = 0; i < slimes; i++) this.queue.push('slime');
    for (let i = 0; i < bats; i++) this.queue.push('bat');
    for (let i = 0; i < golems; i++) this.queue.push('golem');
    // 섞기(항상 같은 순서로 나오면 심심하다)
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.queue[i]; this.queue[i] = this.queue[j]; this.queue[j] = tmp;
    }
    if (n % 5 === 0) this.queue.unshift('dragon');
    this.spawnGap = Math.max(0.42, 1.15 - n * 0.05);
    this.spawnTimer = 0.9;
    this.waveActive = true;
    return { wave: n, count: this.queue.length, boss: n % 5 === 0 };
  };

  Enemies.prototype._free = function (type) {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive && e.type === type) return e;
    }
    return null;
  };

  Enemies.prototype.spawn = function (type) {
    const e = this._free(type);
    if (!e) return null;
    const t = e.def;
    const hpScale = 1 + (this.wave - 1) * 0.14;
    e.alive = true;
    e.maxHp = Math.round(t.hp * hpScale);
    e.hp = e.maxHp;
    e.attackTimer = 0.6;
    e.hurt = 0;
    e.stagger = 0;
    e.phase = Math.random() * 6.28;
    // 도로 저편에서 등장
    const lane = (Math.random() - 0.5) * 22;
    e.pos.set(lane, t.flying ? t.hover : this.city.curbY, -46 - Math.random() * 30);
    e.y0 = t.flying ? t.hover : this.city.curbY;
    e.group.position.copy(e.pos);
    e.group.visible = true;
    e.group.scale.setScalar(1);
    if (e.bar) e.bar.visible = true;
    if (t.boss) this.boss = e;
    return e;
  };

  /** 한 점 근처의 몬스터 하나 찾기(발사체 명중용) */
  Enemies.prototype.hitTest = function (pos, r) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const dy = (e.pos.y + e.radius * 0.7) - pos.y;
      const d = Math.sqrt(dx * dx + dy * dy * 0.7 + dz * dz);
      if (d < e.radius + r && d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  /** 범위 피해 */
  Enemies.prototype.damageArea = function (pos, radius, dmg) {
    let hits = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, dy = e.pos.y - pos.y;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < radius + e.radius) {
        const falloff = 1 - Math.min(0.65, d / (radius + e.radius) * 0.65);
        this.damage(e, dmg * falloff, pos);
        hits++;
      }
    }
    return hits;
  };

  /** 부채꼴 피해(검·드래곤 파이어) */
  Enemies.prototype.damageCone = function (origin, dir, range, cosLimit, dmg) {
    let hits = 0;
    const v = this._v;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      v.set(e.pos.x - origin.x, (e.pos.y + e.radius * 0.5) - origin.y, e.pos.z - origin.z);
      const d = v.length();
      if (d > range + e.radius) continue;
      v.divideScalar(d || 1);
      if (v.dot(dir) >= cosLimit) {
        this.damage(e, dmg, e.pos);
        hits++;
      }
    }
    return hits;
  };

  Enemies.prototype.damage = function (e, dmg, from) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.hurt = 0.16;
    if (from) {
      // 살짝 밀린다
      this._v2.set(e.pos.x - from.x, 0, e.pos.z - from.z);
      if (this._v2.lengthSq() > 0.001) {
        this._v2.normalize().multiplyScalar(e.def.boss ? 0.25 : 1.1);
        e.pos.add(this._v2);
      }
      e.stagger = e.def.boss ? 0.05 : 0.18;
    }
    if (e.hp <= 0) this.kill(e);
  };

  Enemies.prototype.kill = function (e) {
    e.alive = false;
    e.group.visible = false;
    if (e.bar) e.bar.visible = false;
    if (this.boss === e) this.boss = null;
    // 브릭이 팝 하고 흩어진다
    this.fx.debrisBurst(e.pos, e.color, e.def.boss ? 40 : 10, e.def.boss ? 40 : 16);
    this.fx.explode(e.pos, e.def.boss ? 22 : e.radius * 2.2, 0xffd166, 0);
    for (let i = 0; i < e.def.studs; i++) {
      this.fx.dropStud(e.pos, i % 3 === 2 ? 'ammo' : 'mana');
    }
    if (e.def.boss || Math.random() < 0.07) this.fx.dropStud(e.pos, 'heart');
    if (this.hooks.onKill) this.hooks.onKill(e);
  };

  Enemies.prototype.update = function (dt, playerPos, camera) {
    // ---- 등장 대기열
    if (this.waveActive && this.queue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn(this.queue.shift());
        this.spawnTimer = this.spawnGap;
      }
    } else if (this.waveActive && this.aliveCount() === 0) {
      this.waveActive = false;
      if (this.hooks.onWaveClear) this.hooks.onWaveClear(this.wave);
    }

    const v = this._v;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const t = e.def;
      e.phase += dt;
      if (e.hurt > 0) e.hurt -= dt;
      if (e.stagger > 0) e.stagger -= dt;

      // ---- 플레이어를 향해 이동
      v.set(playerPos.x - e.pos.x, 0, playerPos.z - e.pos.z);
      const dist = v.length();
      v.divideScalar(dist || 1);
      const inRange = dist < t.attackRange + 1;
      if (!inRange && e.stagger <= 0) {
        const sp = e.speed * (t.boss ? (0.7 + Math.sin(e.phase * 0.6) * 0.25) : 1);
        e.pos.x += v.x * sp * dt;
        e.pos.z += v.z * sp * dt;
      }
      // 보스는 일정 거리를 유지하며 선회
      if (t.ranged && dist < 26) {
        e.pos.x -= v.x * e.speed * 0.6 * dt;
        e.pos.z -= v.z * e.speed * 0.6 * dt;
        e.pos.x += -v.z * e.speed * 0.5 * dt;
        e.pos.z += v.x * e.speed * 0.5 * dt;
      }
      // 도로 밖으로 새지 않게
      const lim = e.pos.z > 20 ? 17 : 19;
      if (e.pos.x < -lim) e.pos.x = -lim;
      if (e.pos.x > lim) e.pos.x = lim;
      if (e.pos.z > 34) e.pos.z = 34;

      // ---- 종류별 몸짓
      if (t.flying) {
        e.pos.y = e.y0 + Math.sin(e.phase * (t.boss ? 1.2 : 3.4)) * (t.boss ? 2.2 : 1.3);
        const w = e.parts.wingL, w2 = e.parts.wingR;
        if (w && w2) {
          const flap = Math.sin(e.phase * (t.boss ? 3.2 : 12)) * (t.boss ? 0.5 : 0.8);
          w.rotation.z = flap;
          w2.rotation.z = -flap;
        }
        if (t.boss && e.parts.maw) {
          e.parts.maw.scale.setScalar(1 + Math.sin(e.phase * 9) * 0.12);
        }
      } else if (e.type === 'slime') {
        const hop = Math.abs(Math.sin(e.phase * 4.6));
        e.pos.y = this.city.curbY + hop * 2.1;
        e.group.scale.set(1 + hop * 0.12, 1 - hop * 0.18, 1 + hop * 0.12);
      } else if (e.type === 'golem') {
        e.pos.y = this.city.curbY;
        const sw = Math.sin(e.phase * 3.4);
        if (e.parts.legs) e.parts.legs.rotation.x = sw * 0.12;
        if (e.parts.arms) e.parts.arms.rotation.x = -sw * 0.35;
        if (e.parts.head) e.parts.head.rotation.y = sw * 0.16;
      }

      e.group.position.copy(e.pos);
      // 플레이어를 바라본다
      e.group.rotation.y = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      // 맞으면 잠깐 커진다(레고 티 나는 반응)
      const hurtScale = e.hurt > 0 ? 1 + e.hurt * 1.2 : 1;
      if (e.type !== 'slime') e.group.scale.setScalar(hurtScale);

      // ---- 공격
      e.attackTimer -= dt;
      if (dist < t.attackRange && e.attackTimer <= 0) {
        e.attackTimer = t.attackCd;
        if (t.ranged) {
          // 보스: 불덩이를 뱉는다
          v.set(playerPos.x - e.pos.x, (playerPos.y - 1) - (e.pos.y + 4), playerPos.z - e.pos.z).normalize();
          this._v2.copy(e.pos);
          this._v2.y += 4;
          this.fx.shoot('enemyfire', this._v2, v, {
            speed: 52, dmg: t.damage, owner: 'enemy', life: 4,
          });
        } else if (this.hooks.hitPlayer) {
          this.hooks.hitPlayer(t.damage, e.pos);
        }
      }

      // ---- 체력바
      if (e.bar) {
        e.bar.position.set(e.pos.x, e.pos.y + e.radius * (t.boss ? 2.6 : 2.4) + 2, e.pos.z);
        e.bar.lookAt(camera.position);
        const r = Math.max(0, e.hp / e.maxHp);
        e.bar.userData.fill.scale.x = r;
        e.bar.userData.fill.position.x = -(1 - r) * 0.5;
        e.bar.userData.fill.material.color.setHex(r > 0.5 ? 0x4bd44b : (r > 0.25 ? 0xf2cd37 : 0xc91a09));
      }
    }
  };

  Enemies.prototype.clear = function () {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      e.alive = false;
      e.group.visible = false;
      if (e.bar) e.bar.visible = false;
    }
    this.queue.length = 0;
    this.waveActive = false;
    this.boss = null;
  };

  L.ENEMY_TYPES = TYPES;
  L.Enemies = Enemies;
})(window.LEGO);
