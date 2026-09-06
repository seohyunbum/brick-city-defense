/* =========================================================================
 * pilot.js — 86호기 조종 모드: 1인칭 조종석 · 칼 · 기관총 · 웨이브
 *
 * 단편(story86.js)이 지은 무대를 그대로 쓰고, 배우 대신 플레이어가 86호기를 몬다.
 * 카메라는 조종석 안이라 몸통이 흔들리는 만큼 화면도 함께 흔들린다(라이드 감각).
 *
 * 아동안전(CLAUDE.md 5장): 상대는 무인 기계뿐, 유혈 없음, 쓰러지면 브릭이 흩어진다.
 * 하트가 0 이어도 게임오버가 아니라 "긴급 수리" 후 계속한다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const M = L.Motion;
  const W = L.MechWeapons;

  const MAX_HEARTS = 5;
  const WALK = 6.4;
  const SPRINT = 9.2;
  const BACK = 3.6;
  const TURN_KEY = 1.5;          // A/D 로 도는 속도(라디안/초)
  const STRIDE = 3.2;
  const GUN_INTERVAL = 0.1;
  const GUN_RANGE = 88;
  const GUN_HEAT = 0.038;        // 한 발당 오르는 열
  const COOL_RATE = 0.3;         // 초당 식는 양
  const SWORD_RANGE = 15;
  const SWORD_COS = 0.30;        // 부채꼴 반각 ≈ 72°
  const ARENA = { x: 0, z: -170, r: 128, zMax: -128 };

  function Pilot(story, camera, canvas) {
    this.story = story;
    this.camera = camera;
    this.mech = story.mech;
    this.input = new L.Input(canvas);
    this.sfx = new L.Sfx();
    this.weapons = W.attach(this.mech, story.scene, {});
    this.legion = new L.Legion(story.scene, story.burst, { cap: 10, rng: L.RNG.mulberry32(4386) });
    this.hud = new L.PilotHUD();

    this.active = false;
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 0;
    this.hearts = MAX_HEARTS;
    this.heat = 0;
    this.overheated = false;
    this.kills = 0;
    this.wave = 0;
    this.invuln = 0;
    this.repair = 0;
    this.gunTimer = 0;
    this.restTimer = 0;
    this.best = L.Storage.getNumber('brick86-best', null) || 0;
    this._swingSpent = true;
    this._gunSide = false;        // 두 문을 번갈아 쏜다

    // 스크래치 (핫패스 할당 금지)
    this._fwd = new THREE.Vector3();
    this._flat = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._hit = new THREE.Vector3();
    this._anchor = new THREE.Vector3();
    this._look = { yaw: 0, pitch: 0 };
    this._camSpring = new M.Spring3(9, 1);

    this.hooks = { onPause: null };
    const self = this;
    this.legion.hooks.onHitPlayer = (dmg) => self.hurt(dmg);
    this.legion.hooks.onDown = () => self.onDown();
    this.input.hooks.pause = () => { if (self.active && self.hooks.onPause) self.hooks.onPause(); };
  }

  /** 무대를 전투용으로 정리하고 조종석에 앉는다 */
  Pilot.prototype.enter = function () {
    const s = this.story;
    s.pilot.visible = false;
    for (let i = 0; i < s.citizens.length; i++) s.citizens[i].visible = false;
    for (let i = 0; i < s.scraps.length; i++) s.scraps[i].visible = false;
    s.hangar.lamps.forEach((l) => { l.visible = false; });
    s.hangar.inner.intensity = 0;
    s.burst.hideAll();
    // 성벽 바깥 벌판 한가운데에서 시작한다. 새벽은 지났고 해가 높다 — 맑은 낮 하늘.
    s.sky.setColors(L.COLORS.cineDawnHigh, L.COLORS.lookSkySoft, L.COLORS.cineHaze, L.COLORS.cineHaze);
    if (s.scene.fog) s.scene.fog.color.setHex(L.COLORS.cineHaze);
    // 먼지 스프라이트는 조종석 렌즈에 달라붙어 화면을 뿌옇게 만든다 — 조종 중에는 끈다.
    s.horizonDust.points.visible = false;
    s.dust.points.visible = false;
    s.sun.position.set(46, 58, -262);
    s.lights.key.intensity = 1.85;
    s.lights.rim.intensity = 0.85;
    s.lights.key.position.set(ARENA.x - 30, 60, ARENA.z + 26);
    s.lights.key.target.position.set(ARENA.x, 0, ARENA.z);
    s.lights.key.target.updateMatrixWorld();

    this.mech.position.set(ARENA.x, 0, ARENA.z);
    this.camera.rotation.order = 'YXZ';
    this.mech.rotation.y = 0;            // 도시(성벽)를 등지고 벌판 쪽(-Z)을 본다
    this.yaw = 0;
    this.pitch = -0.02;
    this.speed = 0;
    this.hearts = MAX_HEARTS;
    this.heat = 0;
    this.overheated = false;
    this.kills = 0;
    this.invuln = 0;
    this.repair = 0;
    this.gunTimer = 0;
    this.restTimer = 1.6;
    this.legion.reset();
    W.reset(this.weapons);
    this.weapons.shoulder.visible = true;      // 칼은 조종 모드에서만 매단다
    this.active = true;
    this._camSpring.set(this.mech.position.x, 8, this.mech.position.z);
    this.hud.show(true);
    this.hud.toast('86호기 시동. 벌판으로 나간다', 2.2);
    this.sfx.resume();
    this.input.requestLock();
  };

  Pilot.prototype.exit = function () {
    this.active = false;
    this.weapons.shoulder.visible = false;
    this.hud.show(false);
    W.reset(this.weapons);
    this.legion.reset();
  };

  Pilot.prototype.hurt = function (dmg) {
    if (!this.active || this.invuln > 0 || this.repair > 0) return;
    this.hearts -= dmg;
    this.invuln = 1.1;
    this.hud.hurt();
    this.sfx.hurt();
    if (this.hearts <= 0) {
      // 게임오버 없음 — 잠깐 멈춰 수리하고 계속한다(GAME_DESIGN_SPEC 9장)
      this.hearts = 0;
      this.repair = 3.0;
      this.hud.toast('🔧 긴급 수리 중… 잠깐만 기다려!', 2.6);
    }
  };

  Pilot.prototype.onDown = function () {
    this.kills++;
    this.sfx.pop();
    if (this.kills > this.best) {
      this.best = this.kills;
      L.Storage.setNumber('brick86-best', this.best);
    }
  };

  // ------------------------------------------------------------------ 조작
  Pilot.prototype._drive = function (dt) {
    const inp = this.input;
    inp.sample();
    const look = inp.consumeLook(this._look);
    this.yaw += look.yaw - inp.moveX * TURN_KEY * dt;
    this.pitch = M.clamp(this.pitch + look.pitch, -0.85, 0.5);

    // 수리 중에는 멈춘다 — 무적이지만 걸을 수 없다
    const want = this.repair > 0 ? 0
      : inp.moveZ > 0 ? (inp.sprint ? SPRINT : WALK)
        : inp.moveZ < 0 ? -BACK : 0;
    this.speed = M.damp(this.speed, want, 3.2, dt);

    // 몸통은 조종간(시선)을 늦게 따라간다 — 무거운 기체가 도는 느낌
    this.mech.rotation.y = M.dampAngle(this.mech.rotation.y, this.yaw, 3.4, dt);
    const my = this.mech.rotation.y;
    const dir = this.speed >= 0 ? 1 : -1;
    this.mech.position.x += -Math.sin(my) * this.speed * dt;
    this.mech.position.z += -Math.cos(my) * this.speed * dt;

    // 벌판 밖(성벽 안쪽·바다 쪽)으로는 나가지 않는다
    const dx = this.mech.position.x - ARENA.x;
    const dz = this.mech.position.z - ARENA.z;
    const d = Math.hypot(dx, dz);
    if (d > ARENA.r) {
      this.mech.position.x = ARENA.x + dx / d * ARENA.r;
      this.mech.position.z = ARENA.z + dz / d * ARENA.r;
    }
    if (this.mech.position.z > ARENA.zMax) this.mech.position.z = ARENA.zMax;

    // 포탑은 몸통과 시선의 차이만큼 돌아 조준을 따라간다
    let turret = this.yaw - my;
    while (turret > Math.PI) turret -= Math.PI * 2;
    while (turret < -Math.PI) turret += Math.PI * 2;
    L.Mech86.update(this.mech, dt, {
      speed: Math.abs(this.speed),
      stride: STRIDE * dir,
      turretYaw: M.clamp(turret, -0.9, 0.9),
      crouch: this.repair > 0 ? 0.45 : 0,
    });
  };

  Pilot.prototype._shoot = function (dt) {
    const inp = this.input;
    this.gunTimer -= dt;
    // 열 관리: 계속 쏘면 과열되어 잠깐 식혀야 한다(탄약을 주우러 다니지 않아도 된다)
    this.heat = Math.max(0, this.heat - COOL_RATE * dt);
    if (this.overheated && this.heat < 0.45) this.overheated = false;

    const canShoot = inp.attackHeld && !this.overheated && this.repair <= 0 && this.gunTimer <= 0;
    if (canShoot) {
      this.gunTimer = GUN_INTERVAL;
      this.heat += GUN_HEAT;
      if (this.heat >= 1) {
        this.heat = 1;
        this.overheated = true;
        this.hud.toast('🌡️ 총열이 뜨겁다 — 잠깐 식히자', 1.6);
      }
      this.camera.getWorldDirection(this._fwd);
      L.Mech86.fire(this.mech, this._gunSide ? 1 : 0, this._muzzle);
      this._gunSide = !this._gunSide;
      const hit = this.legion.raycast(this._muzzle, this._fwd, GUN_RANGE, 3.2);
      const dist = hit ? hit.distance : GUN_RANGE;
      this._hit.copy(this._fwd).multiplyScalar(dist).add(this._muzzle);
      W.addTracer(this.weapons, this._muzzle, this._hit);
      this.sfx.shoot();
      if (hit) this.legion.hurt(hit.unit, 1);
    }

    // ----- 칼: 한 번 휘두르는 동안 딱 한 번만 벤다
    if (inp.castHeld && this.repair <= 0 && W.startSwing(this.weapons)) {
      this._swingSpent = false;
      this.sfx.sword();
    }
    if (!this._swingSpent && W.swingHits(this.weapons)) {
      this._swingSpent = true;
      this._flat.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const downed = this.legion.sweep(this.mech.position, this._flat, SWORD_RANGE, SWORD_COS, 9);
      if (downed) {
        this.sfx.boom();
        this.hud.hitMark();
      }
    }
    W.update(this.weapons, dt);
  };

  Pilot.prototype._waves = function (dt) {
    if (this.legion.spawnLeft > 0 || this.legion.aliveCount() > 0) return;
    this.restTimer -= dt;
    if (this.restTimer > 0) return;
    this.restTimer = 5.0;
    const n = this.legion.startWave(this.mech.position);
    this.hud.toast('⚙️ ' + n + '번째 무리가 온다', 2.2);
    this.sfx.wave();
  };

  /** 조종석 카메라 — 몸통을 따라 흔들리되 아주 살짝 늦게 따라온다 */
  Pilot.prototype._ride = function (dt) {
    const rig = this.mech.userData.rig;
    // 조종석 눈높이: 등받이 앞, 캐노피 안. 앞에는 캐노피 유리와 두 포신, 왼쪽에는 칼이 보인다.
    this._anchor.set(0, 3.55, -0.7);
    rig.chassis.localToWorld(this._anchor);
    const lag = this.story.reduceMotion ? 16 : 9;
    this._camSpring.x.freq = this._camSpring.y.freq = this._camSpring.z.freq = lag;
    this._camSpring.update(this._anchor.x, this._anchor.y, this._anchor.z, dt);
    this.camera.position.set(this._camSpring.x.value, this._camSpring.y.value, this._camSpring.z.value);
    const roll = this.story.reduceMotion ? 0 : rig.chassis.rotation.z * 0.5;
    this.camera.rotation.set(this.pitch, this.yaw, roll);
    this.story.skyRig.position.copy(this.camera.position);

    // 태양(그림자 카메라)도 따라다닌다 — 벌판 어디서든 그림자가 진다
    const key = this.story.lights.key;
    key.position.set(this.mech.position.x - 30, 60, this.mech.position.z + 26);
    key.target.position.set(this.mech.position.x, 0, this.mech.position.z);
    key.target.updateMatrixWorld();
  };

  Pilot.prototype.update = function (dt) {
    if (!this.active) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.repair > 0) {
      this.repair -= dt;
      if (this.repair <= 0) {
        this.hearts = MAX_HEARTS;
        this.invuln = 1.5;
        this.hud.toast('🔧 수리 완료! 다시 나가자', 1.8);
      }
    }
    this._drive(dt);
    this._shoot(dt);
    this.legion.update(dt, this.mech.position);
    this._waves(dt);
    this.story.burst.update(dt);
    this._ride(dt);

    this.hud.update(dt, {
      hearts: this.hearts,
      maxHearts: MAX_HEARTS,
      heat: this.heat,
      overheated: this.overheated,
      wave: this.legion.wave,
      kills: this.kills,
      best: this.best,
      enemies: this.legion.aliveCount() + this.legion.spawnLeft,
      repair: this.repair,
      speed: Math.abs(this.speed),
    });
  };

  L.Pilot = Pilot;
})(window.LEGO = window.LEGO || {});
