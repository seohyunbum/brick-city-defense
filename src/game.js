/* =========================================================================
 * game.js — 지휘자: 씬 부팅 · 입력 배선 · 전투 규칙 · 루프 · 렌더
 *
 * 렌더는 2패스다.
 *   1) 도시(월드) 씬
 *   2) 깊이만 지우고 1인칭 두 팔(hands.scene)을 겹쳐 그린다  ← 팔이 벽에 안 잘린다
 * ========================================================================= */
(function (L) {
  'use strict';
  const P = L.PLAYER;

  function Game() {
    const canvas = document.getElementById('scene');
    this.canvas = canvas;

    // ---------------- 렌더러
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    L.LookDev.configureRenderer(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    // 그림자는 한 프레임 걸러 갱신한다(거의 안 움직이므로 눈에 안 띄고 비용은 절반)
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowTick = 0;

    // ---------------- 씬 · 카메라 · 빛
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.4, 900);
    this.camera.rotation.order = 'YXZ';

    this.lookdev = L.LookDev.install(this.scene, this.renderer);
    this.sun = this.lookdev.sun;

    // ---------------- 매크로 사진 느낌 후처리(심도 흐림·비네팅)
    this.post = new L.PostFX(this.renderer, this.camera);

    // ---------------- 오픈월드 (city.js 복도를 대체)
    this.world = L.World.create(this.scene, {
      seed: L.Storage.getNumber('brickcity-seed', null) || 20260821,
    });
    this.city = this.world;   // enemies/objectives 가 쓰는 호환 이름

    // ---------------- 이펙트 · 몬스터 · 손 · HUD · 입력 · 소리
    this.fx = new L.FX(this.scene);
    this.enemies = new L.Enemies(this.scene, this.fx, this.city);
    this.objectives = new L.Objectives(this.city);
    this.director = new L.Director(this.world, this.enemies);
    // 브릭 도감 — 싸우지 않고도 할 일. 기록은 판을 새로 시작해도 남는다.
    this.dex = new L.Dex();
    this.companions = new L.Companions(this.scene, this.world, this.dex);
    this.hands = new L.Hands(this.camera);
    this.hud = new L.HUD();
    this.input = new L.Input(canvas);
    this.sfx = new L.Sfx();

    // ---------------- 플레이어 상태
    const SPAWN = this.world.spawnPoint();
    this.player = {
      pos: new THREE.Vector3(SPAWN.x, P.eyeHeight + this.world.curbY, SPAWN.z),
      yaw: SPAWN.yaw, pitch: -0.04,
      hearts: P.maxHearts, mana: P.maxMana,
      ammo: { blaster: 24, bomb: 4 },
      score: 0, kills: 0, combo: 0, comboTimer: 0,
      invuln: 0, weaponCd: 0, channelTimer: 0, channelSkill: null,
      manaRegenBonus: 0,
      bob: 0,
    };
    this.progression = new L.Progression(this.player);
    this.skillCd = { dragonfire: 0, meteor: 0, fireball: 0 };
    this.state = 'start';        // start | playing | pause  (오픈월드: 승패 상태 없음)
    this.best = L.Storage.getNumber('brickcity-best', 'legocity-best');
    this.time = 0;

    // 스크래치 벡터 (핫패스 할당 금지)
    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._look = { yaw: 0, pitch: 0 };
    this._aim = new THREE.Vector3();
    this._fxContext = {
      enemies: this.enemies,
      objectives: this.objectives,
      playerPos: this.player.pos,
      collectStud: (kind) => this.collectStud(kind),
    };
    this._wire();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.hud.show(false);
    this.hud.screen('start');
    if (this.input.touchMode) this.hud.showTouch(false);

    // 느린 기기 자동 보호: 프레임이 낮으면 후처리 품질을 단계적으로 낮춘다
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._qualityStep = 0;
    this._slowWindows = 0;
    this.autoQuality = true;   // 테스트에서 끌 수 있게 열어둔다

    this._lastT = 0;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ------------------------------------------------------------------ 배선
  Game.prototype._wire = function () {
    const self = this;
    const h = this.input.hooks;
    h.selectWeapon = (i) => { if (self.state === 'playing') { self.hands.setWeapon(i); self.sfx.pop(); } };
    h.selectSkill = (i) => { if (self.state === 'playing') { self.hands.setSkill(i); self.sfx.pop(); } };
    h.swapWeapon = (d) => { if (self.state === 'playing') { self.hands.nextWeapon(d); self.sfx.pop(); } };
    h.swapSkill = (d) => { if (self.state === 'playing') { self.hands.nextSkill(d); self.sfx.pop(); } };
    h.pause = (fromUnlock) => {
      if (self.state === 'playing') {
        self.state = 'pause';
        self.hud.screen('pause');
      }
      void fromUnlock;
    };

    // 이펙트 → 게임 규칙 연결
    this.fx.hooks.damageArea = (pos, radius, dmg) => {
      const hits = self.enemies.damageArea(pos, radius, dmg);
      if (hits) self.hud.hitMark();
    };
    this.fx.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.fx.hooks.onImpact = () => self.sfx.boom();
    this.fx.hooks.collectReward = (kind) => self.collectStud(kind);

    this.enemies.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.enemies.hooks.onKill = (e) => self.onKill(e);
    this.objectives.hooks.onCitizenLost = () => self.hud.toast('시민이 다쳤다!', 1.2);
    this.director.hooks.onDistrict = (label, threat, safe) => {
      self.hud.toast((safe ? '🛡️ ' : '⚠️ ') + label + ' · ' + threat, 1.6);
      // 구역마다 사는 생물이 다르다 — 들어서면 두 마리 정도 바로 보여 준다
      self.companions.seed(self.player.pos, self.director, 2);
    };
    this.director.hooks.onLord = (name) => {
      self.hud.toast('👑 ' + name + ' 등장!\n조심해 — 아니면 그냥 지나가도 돼', 2.6);
      self.sfx.wave();
    };
    h.interact = () => { if (self.state === 'playing') self.companions.befriend(self.player); };
    h.toggleDex = () => {
      if (self.state === 'playing' || self.state === 'pause') self.hud.showDex(self.dex.toggle());
    };
    this.companions.hooks.onMeet = (sp) => {
      self.hud.toast('📖 #' + sp.dex + ' ' + sp.name + ' 을 도감에 적었다!\n' + sp.flavor, 2.6);
      self.sfx.pickup();
    };
    this.companions.hooks.onFriend = (sp, fresh) => {
      self.hud.toast(fresh ? ('💛 ' + sp.name + ' 와 친구가 됐다!\n같이 걸어 다닌다')
        : ('💛 ' + sp.name + ' 가 다시 따라온다'), 2.4);
      self.sfx.pop();
    };
    this.companions.hooks.onDeny = (why) => self.hud.toast(why, 1.6);
    this.dex.onClose = () => self.hud.showDex(false);
    document.getElementById('start-btn').addEventListener('click', () => self.start());
    document.getElementById('resume-btn').addEventListener('click', () => self.resume());
    this.canvas.addEventListener('click', () => {
      if (self.state === 'pause') self.resume();
      else if (self.state === 'playing') self.input.requestLock();
    });
  };

  Game.prototype.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 좁은 화면(폰 세로)에서는 시야를 넓혀 손이 화면을 덜 가리게
    this.camera.fov = w / h < 1 ? 82 : 70;
    this.camera.updateProjectionMatrix();
    this.hands.resize(w / h, this.camera.fov);
    this.post.resize(w, h, this.renderer.getPixelRatio());
  };

  // ------------------------------------------------------------------ 흐름
  Game.prototype.start = function () {
    const p = this.player;
    const sp = this.world.spawnPoint();
    p.pos.set(sp.x, P.eyeHeight + this.world.curbY, sp.z);
    p.yaw = sp.yaw; p.pitch = -0.04;   // 첫 화면이 광장을 향하게
    this.world.prime(p.pos.x, p.pos.z);   // 첫 화면에 빈 도시를 보이지 않는다
    p.hearts = P.maxHearts;
    p.mana = P.maxMana;
    p.ammo.blaster = 24;
    p.ammo.bomb = 4;
    p.score = 0; p.kills = 0; p.combo = 0; p.comboTimer = 0;
    p.invuln = 0; p.weaponCd = 0; p.channelTimer = 0; p.channelSkill = null;
    p.manaRegenBonus = 0;
    this.skillCd.dragonfire = this.skillCd.meteor = this.skillCd.fireball = 0;
    this.enemies.clear();
    this.companions.clear();
    this.director.reset();
    this.fx.clear();
    this.progression.reset();
    this.objectives.startRun();
    this.hands.setWeapon(0);
    this.hands.setSkill(2);
    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show(true);
    if (this.input.touchMode) this.hud.showTouch(true);
    this.sfx.resume();
    this.input.requestLock();
    // 오픈월드: 시작하자마자 웨이브를 걸지 않는다. 전투는 선택이다(GAME_DESIGN_SPEC 9장)
    this.hud.toast('브릭 시티에 온 걸 환영해!\n마음대로 돌아다녀 봐', 2.8);
  };

  Game.prototype.resume = function () {
    if (this.state !== 'pause') return;
    this.state = 'playing';
    this.hud.screen(null);
    this.input.requestLock();
  };

  Game.prototype.onKill = function (e) {
    const p = this.player;
    p.kills++;
    p.combo++;
    p.comboTimer = 2.6;
    const mult = 1 + Math.min(1.5, (p.combo - 1) * 0.1);
    p.score += Math.round(e.def.score * mult);
    this.hud.comboPop();
    this.sfx.pop();
    if (e.isLord) {
      this.hud.toast('👑 ' + (e.lordName || '구역의 주인') + ' 격파!\n' +
        this.progression.award(), 2.8);
    }
    this.recordBest();
  };

  Game.prototype.hurtPlayer = function (dmg) {
    const p = this.player;
    if (this.state !== 'playing' || p.invuln > 0) return;
    p.hearts -= dmg;
    p.invuln = P.hurtInvuln;
    p.combo = 0;
    this.hud.hurt();
    this.sfx.hurt();
    if (p.hearts <= 0) {
      // 오픈월드는 게임오버로 진행을 차단하지 않는다(GAME_DESIGN_SPEC 9장)
      p.hearts = P.maxHearts;
      p.invuln = 2.4;
      p.combo = 0;
      this.hud.toast('앗! 잠깐 쉬었다 가자', 1.8);
    }
  };

  /** 최고 기록 저장 — 오픈월드는 끝나지 않으므로 그때그때 갱신한다 */
  Game.prototype.recordBest = function () {
    if (this.player.score <= this.best) return false;
    this.best = this.player.score;
    L.Storage.setNumber('brickcity-best', this.best);
    return true;
  };

  // 전투 규칙은 combat.js 가, 브릭 생물은 companions.js 가 들고 있다.
  L.Combat.install(Game);

  // ------------------------------------------------------------------ 이동
  Game.prototype.updatePlayer = function (dt) {
    const p = this.player;
    const inp = this.input;
    inp.sample();
    const look = inp.consumeLook(this._look);
    p.yaw += look.yaw;
    p.pitch = Math.max(-1.15, Math.min(0.95, p.pitch + look.pitch));

    // 이동(카메라 기준)
    let mx = inp.moveX, mz = inp.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const speed = (inp.sprint ? P.sprintSpeed : P.walkSpeed) * (p.channelTimer > 0 ? 0.55 : 1);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    // yaw 0 일 때 앞 = -Z  (앞 = (-sin, -cos), 오른쪽 = (cos, -sin))
    const vx = (mx * cos - mz * sin) * speed * dt;
    const vz = (-mz * cos - mx * sin) * speed * dt;
    p.pos.x += vx;
    p.pos.z += vz;

    // 충돌은 주변 3x3 청크만 검사한다(전 월드 순회 금지). 경계는 해안선.
    L.resolveCollision(p.pos, 2.0, this.world.collidersNear(p.pos.x, p.pos.z));
    this.world.clamp(p.pos);

    // 걸을 때 시선 흔들림
    const moving = len > 0.05;
    p.bob += dt * (moving ? (inp.sprint ? 13 : 9) : 2.2);
    const bobY = moving ? Math.sin(p.bob) * (inp.sprint ? 0.22 : 0.14) : Math.sin(p.bob) * 0.04;
    p.pos.y = P.eyeHeight + this.world.curbY;

    this.camera.position.set(p.pos.x, p.pos.y + bobY, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, Math.sin(p.bob * 0.5) * (moving ? 0.012 : 0.003));

    // 쿨다운·마나·콤보
    if (p.weaponCd > 0) p.weaponCd -= dt;
    for (const k in this.skillCd) if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    p.mana = Math.min(P.maxMana, p.mana + (P.manaRegen + p.manaRegenBonus) * dt);
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.combo = 0;
    }

    // 공격 입력(누르고 있으면 연사)
    if (this.input.attackHeld) this.attack();
    if (this.input.castHeld) this.cast();

    return moving ? (inp.sprint ? 1 : 0.6) : 0;
  };

  // ------------------------------------------------------------------ 도시 연출
  Game.prototype.updateCity = function (dt) {
    const a = this.city.anim;
    this.time += dt;
    const t = this.time;

    // 헬리콥터: 도시 위를 크게 돈다
    if (a.heli) {
      const r = 78, sp = 0.12;
      a.heli.group.position.set(Math.cos(t * sp) * r, 58 + Math.sin(t * 0.4) * 3, -46 + Math.sin(t * sp) * r);
      a.heli.group.rotation.y = -t * sp + Math.PI / 2;
      a.heli.rotor.rotation.y += dt * 26;
      a.heli.tailRotor.rotation.x += dt * 30;
    }
    // 크레인 훅: 천천히 흔들린다
    if (a.crane) {
      a.crane.hook.rotation.z = Math.sin(t * 0.5) * 0.05;
      a.crane.group.rotation.y = Math.sin(t * 0.07) * 0.12;
    }
    // 경찰차 경광등 번쩍
    if (a.police) {
      const on = (t * 3) % 2 < 1;
      a.police.lights[0].material.color.setHex(on ? 0x63b3ff : 0x123a63);
      a.police.lights[1].material.color.setHex(on ? 0x123a63 : 0x63b3ff);
    }

    this.objectives.updateCitizens(dt, this.enemies);
  };


  // ------------------------------------------------------------------ 루프
  Game.prototype._loop = function (nowMs) {
    requestAnimationFrame(this._loop);
    const now = nowMs * 0.001;
    let dt = this._lastT ? now - this._lastT : 0.016;
    this._lastT = now;
    if (dt > 0.06) dt = 0.06;      // 탭 전환 후 튀는 것 방지
    this._checkQuality(dt);

    if (this.state === 'playing') {
      const speed01 = this.updatePlayer(dt);
      this.updateChannel(dt);
      // 프레임당 청크 생성 상한 2 — 이동 중 히칭 방지
      this.world.update(this.player.pos.x, this.player.pos.z, 2);
      this.updateCity(dt);

      // 그림자 카메라를 플레이어 주변으로 따라오게(멀리까지 2048 낭비 금지)
      this.sun.position.set(this.player.pos.x + 58, 96, this.player.pos.z + 62);
      this.sun.target.position.set(this.player.pos.x, 0, this.player.pos.z - 10);
      this.sun.target.updateMatrixWorld();

      this.enemies.update(dt, this.player.pos, this.camera, this.objectives);
      this.fx.update(dt, this._fxContext);
      this.hands.update(dt, speed01, false);

      // 오픈월드 진행 — 구역 정원 유지·주인 등장·먼 몬스터 회수
      this.director.update(dt, this.player.pos);
      this.companions.update(dt, this.player.pos, this.director);

      this.hud.update(dt, {
        score: this.player.score,
        combo: this.player.combo,
        hearts: this.player.hearts,
        mana: this.player.mana,
        ammo: this.player.ammo,
        weaponIndex: this.hands.weaponIndex,
        skillIndex: this.hands.skillIndex,
        weaponCd: this.player.weaponCd,
        skillCd: this.skillCd,
        boss: this.enemies.boss,
        yaw: this.player.yaw,
        district: this.director.label,
        prompt: this.companions.prompt(this.player),
        dexMet: this.dex.metCount(),
        dexTotal: L.Creatures.count,
        threat: this.director.threatLabel(),
        safe: this.director.safe,
      });
    } else {
      // 멈춘 동안에도 도시는 살아있게(시작 화면 배경)
      this.updateCity(dt * 0.6);
      this.hands.update(dt, 0, false);
      if (this.state === 'start') {
        // 시작 화면: 도시를 천천히 둘러본다
        const t = this.time * 0.06;
        const sp0 = this.world.spawnPoint();
        this.camera.position.set(sp0.x + Math.sin(t) * 4, P.eyeHeight + this.world.curbY + 1.2, sp0.z + Math.cos(t) * 3);
        this.camera.rotation.set(-0.05, Math.sin(t * 0.7) * 0.16, 0);
      }
    }

    // ---- 렌더: 도시(후처리) → 깊이만 지우고 두 팔(또렷하게)
    this._shadowTick = (this._shadowTick + 1) % 2;
    this.renderer.shadowMap.needsUpdate = this._shadowTick === 0;
    // 접사 초점: 조준한 몬스터가 있으면 거기, 없으면 길 저편(34)
    const aimD = this.state === 'playing' ? this.aimDistance() : 0;
    this.post.setFocus(aimD || 34, dt);
    this.post.renderWorld(this.scene);
    this.renderer.clearDepth();
    this.renderer.render(this.hands.scene, this.hands.camera);
  };

  /** 2초마다 평균 프레임을 보고 무거우면 품질을 내린다 */
  Game.prototype._checkQuality = function (dt) {
    if (!this.autoQuality || this._qualityStep >= 2 || dt <= 0) return;
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum < 2.2) return;
    const fps = this._fpsFrames / this._fpsAccum;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    if (fps >= 42) { this._slowWindows = 0; return; }
    // 두 번 연속 느릴 때만 내린다(로딩 직후 한 번 튀는 건 무시)
    this._slowWindows++;
    if (this._slowWindows < 2) return;
    this._slowWindows = 0;
    this._qualityStep++;
    if (this._qualityStep === 1) {
      this.post.setScale(0.7);
    } else {
      this.post.enabled = false;
      this.renderer.shadowMap.enabled = false;
    }
  };

  Game.prototype.collectStud = function (kind) {
    const p = this.player;
    if (kind === 'ammo') {
      p.ammo.blaster = Math.min(L.weaponById('blaster').ammoMax, p.ammo.blaster + L.weaponById('blaster').ammoPerPickup);
      p.ammo.bomb = Math.min(L.weaponById('bomb').ammoMax, p.ammo.bomb + L.weaponById('bomb').ammoPerPickup);
    } else if (kind === 'heart') {
      p.hearts = Math.min(P.maxHearts, p.hearts + 1);
      this.hud.toast('❤️ 하트 회복!', 0.9);
    } else {
      p.mana = Math.min(P.maxMana, p.mana + P.manaPerStud);
    }
    p.score += 5;
    this.sfx.pickup();
  };

  // 부팅
  window.addEventListener('DOMContentLoaded', () => {
    try {
      window.LEGO_GAME = new Game();
      window.BRICK_GAME = window.LEGO_GAME;
    } catch (err) {
      console.error(err);
      const s = document.getElementById('start-screen');
      if (s) {
        s.textContent = '';
        const sheet = document.createElement('div');
        sheet.className = 'sheet small';
        const title = document.createElement('h2');
        title.textContent = '게임을 시작할 수 없었다';
        const detail = document.createElement('p');
        detail.className = 'sub';
        detail.textContent = String(err && err.message ? err.message : err);
        sheet.append(title, detail);
        s.appendChild(sheet);
      }
    }
  });

  L.Game = Game;
})(window.LEGO);
