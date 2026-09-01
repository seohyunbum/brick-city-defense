/* =========================================================================
 * game.js — 지휘자: 씬 부팅 · 입력 배선 · 흐름 전이 · 루프 · 렌더
 * 이동은 player.js, 조준·공격·시전은 combat.js 가 prototype mixin 으로 붙는다.
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
    this.renderer.outputEncoding = THREE.sRGBEncoding;
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

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x54703f, 0.70);
    this.scene.add(hemi);
    // 사진의 맑은 햇빛: 약간 따뜻하고, 그림자 경계는 살짝 부드럽게
    const sun = new THREE.DirectionalLight(0xffeec8, 1.5);
    sun.position.set(58, 96, 62);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58;
    sc.near = 20; sc.far = 240;
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.sun = sun;
    this.scene.add(new THREE.AmbientLight(0xfff4e6, 0.13));

    // ---------------- 매크로 사진 느낌 후처리(심도 흐림·비네팅)
    this.post = new L.PostFX(this.renderer, this.camera);

    // ---------------- 도시
    this.city = L.buildCity(this.scene);

    // ---------------- 이펙트 · 몬스터 · 손 · HUD · 입력 · 소리
    this.fx = new L.FX(this.scene);
    this.enemies = new L.Enemies(this.scene, this.fx, this.city);
    this.hands = new L.Hands(this.camera);
    this.hud = new L.HUD();
    this.input = new L.Input(canvas);
    this.sfx = new L.Sfx();

    // ---------------- 플레이어 상태
    this.player = {
      pos: new THREE.Vector3(0, P.eyeHeight + this.city.curbY, 30),
      yaw: 0, pitch: -0.04,
      hearts: P.maxHearts, mana: P.maxMana,
      ammo: { blaster: 24, bomb: 4 },
      score: 0, kills: 0, combo: 0, comboTimer: 0,
      invuln: 0, weaponCd: 0, channelTimer: 0, channelSkill: null,
      bob: 0,
    };
    this.skillCd = { dragonfire: 0, meteor: 0, fireball: 0 };
    this.state = 'start';        // start | playing | pause | over
    this.wave = 1;
    this.waveBreak = 0;
    this.best = L.Storage.getNumber('brickcity-best', 'legocity-best');
    this.time = 0;

    // 스크래치 벡터 (핫패스 할당 금지)
    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._look = { yaw: 0, pitch: 0 };
    this._aim = new THREE.Vector3();

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

  // 이동·전투 규칙은 별도 파일에서 붙인다(같은 Game 인스턴스를 this 로 받는다)
  Object.assign(Game.prototype, L.PlayerController, L.Combat);

  // ------------------------------------------------------------------ 배선
  Game.prototype._wire = function () {
    const self = this;
    const h = this.input.hooks;
    h.selectWeapon = (i) => { if (self.state === 'playing') { self.hands.setWeapon(i); self.sfx.pop(); } };
    h.selectSkill = (i) => { if (self.state === 'playing') { self.hands.setSkill(i); self.sfx.pop(); } };
    h.swapWeapon = (d) => { if (self.state === 'playing') { self.hands.nextWeapon(d); self.sfx.pop(); } };
    h.swapSkill = (d) => { if (self.state === 'playing') { self.hands.nextSkill(d); self.sfx.pop(); } };
    // Escape(인자 없음)는 멈춤↔재개 토글. 포인터락 해제·창 이탈은 강제 멈춤만 한다.
    h.pause = (fromUnlock) => {
      if (self.state === 'playing') {
        self.state = 'pause';
        self.hud.screen('pause');
      } else if (self.state === 'pause' && !fromUnlock) {
        self.resume();
      }
    };

    // 이펙트 → 게임 규칙 연결
    this.fx.hooks.damageArea = (pos, radius, dmg) => {
      const hits = self.enemies.damageArea(pos, radius, dmg);
      if (hits) self.hud.hitMark();
    };
    this.fx.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.fx.hooks.onImpact = () => self.sfx.boom();

    this.enemies.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.enemies.hooks.onKill = (e) => self.onKill(e);
    this.enemies.hooks.onWaveClear = (n) => self.onWaveClear(n);

    document.getElementById('start-btn').addEventListener('click', () => self.start());
    document.getElementById('again-btn').addEventListener('click', () => self.start());
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
    // 설정 FOV 를 쓰고, 좁은 화면(폰 세로)에서는 손이 덜 가리게 조금 넓힌다
    this.camera.fov = L.Settings.fovFor(w / h);
    this.camera.updateProjectionMatrix();
    this.hands.resize(w / h, this.camera.fov);
    this.post.resize(w, h, this.renderer.getPixelRatio());
  };

  // ------------------------------------------------------------------ 흐름
  Game.prototype.start = function () {
    const p = this.player;
    p.pos.set(0, P.eyeHeight + this.city.curbY, 30);
    p.yaw = 0; p.pitch = -0.04;
    p.hearts = P.maxHearts;
    p.mana = P.maxMana;
    p.ammo.blaster = 24;
    p.ammo.bomb = 4;
    p.score = 0; p.kills = 0; p.combo = 0; p.comboTimer = 0;
    p.invuln = 0; p.weaponCd = 0; p.channelTimer = 0; p.channelSkill = null;
    this.skillCd.dragonfire = this.skillCd.meteor = this.skillCd.fireball = 0;
    this.wave = 1;
    this.waveBreak = 0;
    this.enemies.clear();
    this.fx.clear();
    this.hands.setWeapon(0);
    this.hands.setSkill(2);
    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show(true);
    if (this.input.touchMode) this.hud.showTouch(true);
    this.sfx.resume();
    this.input.requestLock();
    this.enemies.startWave(this.wave);
    this.hud.toast('웨이브 1\n브릭 몬스터가 온다!', 2.2);
    this.sfx.wave();
  };

  Game.prototype.resume = function () {
    if (this.state !== 'pause') return;
    this.state = 'playing';
    this.hud.screen(null);
    this.input.requestLock();
  };

  Game.prototype.onWaveClear = function (n) {
    this.player.score += n * 120;
    if (n >= 10) {
      this.gameOver(true);
      return;
    }
    this.wave = n + 1;
    this.waveBreak = L.Settings.difficulty().waveBreak;
    this.hud.toast('웨이브 ' + n + ' 클리어! 🎉\n다음 웨이브 준비', 2.6);
    this.sfx.wave();
    // 보상: 탄약·폭탄·마나 조금
    this.player.ammo.blaster = Math.min(L.weaponById('blaster').ammoMax, this.player.ammo.blaster + 14);
    this.player.ammo.bomb = Math.min(L.weaponById('bomb').ammoMax, this.player.ammo.bomb + 2);
    this.player.mana = Math.min(P.maxMana, this.player.mana + 40);
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
    if (e.def.boss) this.hud.toast('보스 격파! 🐲', 2.0);
  };

  Game.prototype.hurtPlayer = function (dmg) {
    const p = this.player;
    if (this.state !== 'playing' || p.invuln > 0) return;
    p.hearts -= dmg;
    p.invuln = P.hurtInvuln * L.Settings.difficulty().invulnScale;
    p.combo = 0;
    this.hud.hurt();
    this.sfx.hurt();
    if (p.hearts <= 0) {
      p.hearts = 0;
      this.gameOver(false);
    }
  };

  Game.prototype.gameOver = function (win) {
    this.state = 'over';
    this.player.channelTimer = 0;
    if (this.player.score > this.best) {
      this.best = this.player.score;
      L.Storage.setNumber('brickcity-best', this.best);
    }
    if (document.exitPointerLock) document.exitPointerLock();
    this.hud.show(false);
    this.hud.showTouch(false);
    this.hud.gameOver({
      wave: this.wave, score: this.player.score, kills: this.player.kills,
      best: this.best, win: !!win,
    });
    if (win) this.sfx.wave(); else this.sfx.gameOver();
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

    // 시민: 인도를 오가고, 몬스터가 가까우면 도망친다
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      n.phase += dt * 2.4;
      const near = this.enemies.hitTest(n.fig.position, 16);
      if (near) n.scared = 1.6;
      if (n.scared > 0) {
        n.scared -= dt;
        // 몬스터 반대쪽으로 종종걸음
        this._tmp.set(n.fig.position.x - (near ? near.pos.x : 0), 0, n.fig.position.z - (near ? near.pos.z : -1));
        if (this._tmp.lengthSq() < 0.01) this._tmp.set(0, 0, 1);
        this._tmp.normalize();
        n.fig.position.x += this._tmp.x * 15 * dt;
        n.fig.position.z += this._tmp.z * 15 * dt;
        n.fig.rotation.y = Math.atan2(this._tmp.x, this._tmp.z);
        L.animateWalk(n.fig, n.phase * 2.2, 1);
      } else if (n.patrol) {
        // 제자리 근처를 왕복
        n.fig.position.z += n.dir * 5.2 * dt;
        if (Math.abs(n.fig.position.z - n.home.y) > 7) n.dir *= -1;
        n.fig.position.x += (n.home.x - n.fig.position.x) * dt * 1.6;
        n.fig.rotation.y = n.dir > 0 ? 0 : Math.PI;
        L.animateWalk(n.fig, n.phase, 0.5);
      } else {
        L.animateWalk(n.fig, n.phase * 0.35, 0.06);
      }
      // 인도 밖으로 너무 나가지 않게
      const px = n.fig.position.x;
      if (Math.abs(px) < 14) n.fig.position.x = px < 0 ? -14 : 14;
      if (Math.abs(px) > 30) n.fig.position.x = px < 0 ? -30 : 30;
      if (n.fig.position.z > 38) n.fig.position.z = 38;
      if (n.fig.position.z < -60) n.fig.position.z = -60;
    }
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
      this.updateCity(dt);

      // 그림자 카메라를 플레이어 주변으로 따라오게(멀리까지 2048 낭비 금지)
      this.sun.position.set(this.player.pos.x + 58, 96, this.player.pos.z + 62);
      this.sun.target.position.set(this.player.pos.x, 0, this.player.pos.z - 10);
      this.sun.target.updateMatrixWorld();

      this.enemies.update(dt, this.player.pos, this.camera);
      this.fx.update(dt, {
        enemies: this.enemies,
        playerPos: this.player.pos,
        collectStud: (kind) => this.collectStud(kind),
      });
      this.hands.update(dt, speed01, false);

      // 웨이브 사이 쉬는 시간
      if (!this.enemies.waveActive && this.waveBreak > 0) {
        this.waveBreak -= dt;
        if (this.waveBreak <= 0) {
          this.enemies.startWave(this.wave);
          this.hud.toast('웨이브 ' + this.wave + (this.wave % 5 === 0 ? '\n🐲 보스가 온다!' : ''), 2.0);
          this.sfx.wave();
        }
      }

      this.hud.update(dt, {
        wave: this.wave,
        remaining: this.enemies.remaining(),
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
      });
    } else {
      // 멈춘 동안에도 도시는 살아있게(시작 화면 배경)
      this.updateCity(dt * 0.6);
      this.hands.update(dt, 0, false);
      if (this.state === 'start') {
        // 시작 화면: 도시를 천천히 둘러본다
        const t = this.time * 0.06;
        this.camera.position.set(Math.sin(t) * 4, P.eyeHeight + this.city.curbY + 1.2, 30 + Math.cos(t) * 3);
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

  L.Game = Game;
})(window.LEGO);
