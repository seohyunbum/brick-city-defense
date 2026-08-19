/* =========================================================================
 * hands.js — 1인칭 미니피그 두 팔 (사진 맨 앞의 파란 소매 + 노란 C 손)
 *
 *  ✋ 오른손 = 무기: 폭탄 · 검 · 총
 *  📜 왼손  = 스킬 두루마리: 드래곤 파이어 · 메테오 · 파이어볼
 *
 * 팔은 월드와 부딪혀 잘리지 않도록 별도 씬(viewmodel scene)에 두고
 * 메인 렌더 뒤에 깊이만 지우고 겹쳐 그린다.
 * 무기가 실제로 탄/폭탄을 뱉는 위치(muzzle)는 월드 좌표로 변환해서 준다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  // 화면 안에 두 팔이 사진처럼 아래 두 귀퉁이에서 올라오도록 맞춘 기준값
  const ARM_SCALE = 0.30;
  const ITEM_SCALE = 1.0;    // 손에 쥔 물건 크기(팔 크기에 곱해진다)
  const RIGHT_BASE = { x: 1.46, y: -2.18, z: -3.20, rx: 0.26, ry: -0.30, rz: -0.40 };
  const LEFT_BASE = { x: -1.50, y: -2.14, z: -3.22, rx: 0.24, ry: 0.32, rz: 0.42 };

  /**
   * 팔이 기울어져 있어도 쥔 물건은 화면에서 원하는 각도로 보이게 만든다.
   * (부모 회전을 상쇄해서 최종 방향을 목표값으로 맞춘다)
   */
  const _pq = new THREE.Quaternion();
  const _tq = new THREE.Quaternion();
  const _e = new THREE.Euler();
  function orient(obj, base, tx, ty, tz) {
    _pq.setFromEuler(_e.set(base.rx, base.ry, base.rz));
    _tq.setFromEuler(_e.set(tx, ty, tz));
    obj.quaternion.copy(_pq.invert().multiply(_tq));
  }

  // ------------------------------------------------------------ 두루마리 문양
  function runeTexture(kind, label) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    // 양피지 바탕
    const grd = g.createLinearGradient(0, 0, 256, 256);
    grd.addColorStop(0, '#f3e0b6');
    grd.addColorStop(1, '#d8bd85');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(90,60,25,0.55)';
    g.lineWidth = 6;
    g.strokeRect(12, 12, 232, 232);

    g.save();
    g.translate(128, 108);
    if (kind === 'dragon') {
      // 드래곤 머리 실루엣 + 불
      g.fillStyle = '#8c1b0a';
      g.beginPath();
      g.moveTo(-58, 18); g.lineTo(-30, -32); g.lineTo(6, -44); g.lineTo(34, -22);
      g.lineTo(58, -30); g.lineTo(44, 2); g.lineTo(58, 20); g.lineTo(10, 32);
      g.lineTo(-16, 52); g.lineTo(-30, 26); g.closePath(); g.fill();
      g.fillStyle = '#f3e0b6';
      g.beginPath(); g.arc(16, -18, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8631a';
      g.beginPath();
      g.moveTo(56, 6); g.lineTo(104, -12); g.lineTo(80, 10); g.lineTo(108, 22);
      g.lineTo(60, 26); g.closePath(); g.fill();
    } else if (kind === 'meteor') {
      // 운석 + 꼬리
      g.fillStyle = '#5b3a1e';
      g.beginPath(); g.arc(22, 6, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8b5a2b';
      g.beginPath(); g.arc(10, -6, 12, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(36, 20, 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e8631a';
      g.lineWidth = 13; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-16 - i * 6, -34 + i * 30);
        g.lineTo(-92 - i * 12, -66 + i * 44);
        g.stroke();
      }
    } else {
      // 파이어볼
      g.fillStyle = '#e8631a';
      g.beginPath();
      g.moveTo(0, -62); g.bezierCurveTo(44, -26, 52, 12, 20, 44);
      g.bezierCurveTo(-2, 60, -44, 44, -44, 6);
      g.bezierCurveTo(-44, -20, -16, -26, 0, -62);
      g.fill();
      g.fillStyle = '#f7c04a';
      g.beginPath();
      g.moveTo(2, -26); g.bezierCurveTo(24, -6, 24, 18, 6, 32);
      g.bezierCurveTo(-14, 22, -20, 2, 2, -26);
      g.fill();
    }
    g.restore();

    // 한글 이름
    g.fillStyle = '#4a2c10';
    g.font = 'bold 30px "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(label, 128, 218);

    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ------------------------------------------------------------ 무기 모델
  function buildSword() {
    const g = new THREE.Group();
    const grip = new THREE.Mesh(L.cyl(0.16, 0.18, 0.85, 10), L.mat(C.reddishBrown, 'matte'));
    grip.position.y = 0.4;
    const pommel = new THREE.Mesh(L.sph(0.22, 10), L.mat(C.gold, 'metal'));
    const guard = new THREE.Mesh(L.box(1.35, 0.2, 0.34), L.mat(C.gold, 'metal'));
    guard.position.y = 0.9;
    const blade = new THREE.Mesh(L.box(0.34, 3.1, 0.13), L.mat(C.silver, 'metal'));
    blade.position.y = 2.5;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 4), L.mat(C.silver, 'metal'));
    tip.position.y = 4.35;
    tip.rotation.y = Math.PI / 4;
    const fuller = new THREE.Mesh(L.box(0.1, 2.9, 0.16), L.mat(C.lightGray, 'metal'));
    fuller.position.y = 2.5;
    g.add(grip, pommel, guard, blade, tip, fuller);
    g.traverse((o) => { o.castShadow = false; });
    g.userData.tip = new THREE.Vector3(0, 4.6, 0);
    return g;
  }

  function buildBlaster() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(0.9, 0.95, 2.6), L.mat(C.blue));
    body.position.set(0, 0.5, -0.7);
    const rail = L.plate(C.lightGray, 1, 3, { height: 0.28 });
    rail.scale.set(0.9, 1, 0.85);
    rail.position.set(0, 1.05, -0.7);
    const barrel = new THREE.Mesh(L.cyl(0.3, 0.34, 2.4, 12), L.mat(C.lightGray, 'metal'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.55, -2.6);
    const muzzle = new THREE.Mesh(L.cyl(0.42, 0.38, 0.45, 12), L.mat(C.orange));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.55, -3.9);
    const sight = new THREE.Mesh(L.box(0.3, 0.42, 0.3), L.mat(C.black, 'matte'));
    sight.position.set(0, 1.35, -1.9);
    const grip = new THREE.Mesh(L.box(0.62, 1.5, 0.75), L.mat(C.yellow));
    grip.position.set(0, -0.35, 0.25);
    grip.rotation.x = -0.22;
    const mag = new THREE.Mesh(L.box(0.7, 1.0, 0.8), L.mat(C.darkGray, 'matte'));
    mag.position.set(0, -0.1, -1.1);
    const trigger = new THREE.Mesh(L.box(0.16, 0.4, 0.18), L.mat(C.darkGray, 'matte'));
    trigger.position.set(0, 0.02, -0.42);
    // 총구 섬광(발사 때만 보임)
    const flash = new THREE.Mesh(L.sph(0.62, 10), new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.9,
    }));
    flash.position.set(0, 0.55, -4.3);
    flash.visible = false;
    g.add(body, rail, barrel, muzzle, sight, grip, mag, trigger, flash);
    g.userData.flash = flash;
    g.userData.muzzle = new THREE.Vector3(0, 0.55, -4.4);
    return g;
  }

  function buildBomb() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(L.sph(0.78, 16), L.mat(0x22303a));
    const shine = new THREE.Mesh(L.sph(0.79, 16), new THREE.MeshPhongMaterial({
      color: 0x0b1116, specular: 0xffffff, shininess: 220, transparent: true, opacity: 0.35,
    }));
    const neck = new THREE.Mesh(L.cyl(0.26, 0.3, 0.3, 10), L.mat(C.darkGray, 'metal'));
    neck.position.y = 0.78;
    const fuse = new THREE.Mesh(L.cyl(0.08, 0.09, 0.9, 8), L.mat(C.darkTan, 'matte'));
    fuse.position.set(0.14, 1.28, 0);
    fuse.rotation.z = -0.4;
    const spark = new THREE.Mesh(L.sph(0.26, 10), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
    spark.position.set(0.42, 1.68, 0);
    g.add(ball, shine, neck, fuse, spark);
    g.userData.spark = spark;
    return g;
  }

  // ------------------------------------------------------------ 두루마리 모델
  function buildScroll() {
    const g = new THREE.Group();
    // 감긴 양피지
    const roll = new THREE.Mesh(L.cyl(0.42, 0.42, 2.5, 16), L.mat(0xecd9a8, 'matte'));
    roll.rotation.z = Math.PI / 2;
    g.add(roll);
    // 양쪽 나무 봉 + 손잡이 알
    for (const side of [-1, 1]) {
      const rod = new THREE.Mesh(L.cyl(0.13, 0.13, 3.3, 10), L.mat(C.brown, 'matte'));
      rod.rotation.z = Math.PI / 2;
      g.add(rod);
      const knob = new THREE.Mesh(L.sph(0.24, 10), L.mat(C.gold, 'metal'));
      knob.position.x = side * 1.62;
      g.add(knob);
      const cap = new THREE.Mesh(L.cyl(0.46, 0.46, 0.2, 14), L.mat(C.reddishBrown, 'matte'));
      cap.rotation.z = Math.PI / 2;
      cap.position.x = side * 1.3;
      g.add(cap);
    }
    // 펼쳐지는 문양 면 (시전할 때 열린다)
    const panelMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 1, side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), panelMat);
    panel.position.set(0, -1.15, 0.02);
    panel.scale.y = 0.02;
    g.add(panel);
    // 마법 고리(스킬 색으로 빛난다)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.075, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.0 }));
    ring.position.set(0, -1.2, 0.35);
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.0 }));
    ring2.position.set(0, -1.2, 0.42);
    g.add(ring2);
    // 드래곤 파이어용 브릭 드래곤 머리(시전 중에만 보임)
    const dragon = new THREE.Group();
    const head = new THREE.Mesh(L.box(1.5, 1.2, 2.1), L.mat(C.red));
    const snout = new THREE.Mesh(L.box(1.0, 0.7, 1.1), L.mat(C.red));
    snout.position.set(0, -0.2, -1.5);
    const jaw = new THREE.Mesh(L.box(1.0, 0.35, 1.0), L.mat(0x8c1b0a));
    jaw.position.set(0, -0.62, -1.45);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 6), L.mat(C.gold, 'metal'));
      horn.position.set(side * 0.55, 0.9, 0.4);
      horn.rotation.z = side * 0.35;
      dragon.add(horn);
      const eye = new THREE.Mesh(L.sph(0.17, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      eye.position.set(side * 0.62, 0.22, -0.75);
      dragon.add(eye);
    }
    const maw = new THREE.Mesh(L.sph(0.5, 10), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
    maw.position.set(0, -0.25, -2.1);
    dragon.add(head, snout, jaw, maw);
    dragon.position.set(0, 0.9, -1.4);
    dragon.visible = false;
    g.add(dragon);

    g.userData = { panel, panelMat, ring, ring2, dragon, maw, roll };
    return g;
  }

  // ------------------------------------------------------------ 팔
  function buildArm(side, sleeveColor) {
    const g = new THREE.Group();
    // 파란 소매 (사진의 파란 팔)
    const sleeve = new THREE.Mesh(L.box(1.15, 2.9, 1.2), L.mat(sleeveColor));
    sleeve.position.y = 1.1;
    const cuff = new THREE.Mesh(L.box(1.2, 0.35, 1.25), L.mat(sleeveColor));
    cuff.position.y = 2.5;
    // 노란 C 자 손
    const hand = L.clawHand(C.yellow);
    hand.scale.setScalar(1.55);
    hand.position.set(0, 3.0, 0.2);
    hand.rotation.set(Math.PI / 2 - 0.25, 0, side > 0 ? 0.25 : -0.25);
    // 손에 쥔 물건이 붙는 자리
    const mount = new THREE.Group();
    mount.scale.setScalar(ITEM_SCALE);
    mount.position.set(0, 3.05, 0.25);
    g.add(sleeve, cuff, hand, mount);
    g.userData = { mount, hand, sleeve };
    return g;
  }

  // ------------------------------------------------------------ Hands
  function Hands(worldCamera) {
    this.worldCamera = worldCamera;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(worldCamera.fov, 1, 0.05, 60);

    // 손 전용 조명은 약하게 — 세게 주면 플라스틱 반사가 하얗게 날아간다
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7a86, 0.62);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4de, 0.7);
    key.position.set(2.5, 5, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.3);
    rim.position.set(-3, 1.5, -2);
    this.scene.add(rim);

    // ---- 오른팔(무기)
    this.right = buildArm(1, C.blue);
    this.right.scale.setScalar(ARM_SCALE);
    this.right.position.set(RIGHT_BASE.x, RIGHT_BASE.y, RIGHT_BASE.z);
    this.right.rotation.set(RIGHT_BASE.rx, RIGHT_BASE.ry, RIGHT_BASE.rz);
    this.scene.add(this.right);

    // ---- 왼팔(두루마리)
    this.left = buildArm(-1, C.blue);
    this.left.scale.setScalar(ARM_SCALE);
    this.left.position.set(LEFT_BASE.x, LEFT_BASE.y, LEFT_BASE.z);
    this.left.rotation.set(LEFT_BASE.rx, LEFT_BASE.ry, LEFT_BASE.rz);
    this.scene.add(this.left);

    // ---- 무기 3종을 오른손 mount 에 넣고 하나만 보이게
    this.weapons = {
      sword: buildSword(),
      blaster: buildBlaster(),
      bomb: buildBomb(),
    };
    this.weapons.sword.position.set(0.0, 0.15, 0.1);
    orient(this.weapons.sword, RIGHT_BASE, -0.30, 0.18, -0.16);
    this.weapons.blaster.position.set(0.05, 0.2, -0.45);
    orient(this.weapons.blaster, RIGHT_BASE, 0.05, 0.03, 0.0);
    this.weapons.bomb.position.set(0.0, 0.45, 0.1);
    orient(this.weapons.bomb, RIGHT_BASE, 0, 0, 0);
    for (const id in this.weapons) this.right.userData.mount.add(this.weapons[id]);

    // ---- 두루마리를 왼손 mount 에
    this.scroll = buildScroll();
    this.scroll.position.set(0.1, 0.6, 0.25);
    this.scroll.scale.setScalar(0.8);
    // 두루마리는 늘 문양이 보이도록 화면을 향하게 세운다
    orient(this.scroll, LEFT_BASE, -0.22, 0.24, 0.10);
    this.left.userData.mount.add(this.scroll);

    // 드래곤 머리는 두루마리보다 크게, 손 위쪽에서 정면을 보게 따로 붙인다
    const dragon = this.scroll.userData.dragon;
    this.left.userData.mount.add(dragon);
    dragon.scale.setScalar(1.05);
    dragon.position.set(1.5, 2.0, -3.0);
    // 살짝 비스듬히 세워서 주둥이 옆모습이 보이게(정면만 보면 빨간 상자로 보인다)
    orient(dragon, LEFT_BASE, -0.10, 0.42, 0.04);

    // 스킬별 문양 텍스처
    this.runes = {};
    for (let i = 0; i < L.SKILLS.length; i++) {
      const s = L.SKILLS[i];
      this.runes[s.id] = runeTexture(s.rune, s.name);
    }

    this.weaponIndex = 0;
    this.skillIndex = 2;   // 기본은 값싼 파이어볼
    this.time = 0;
    this.bob = 0;
    this.rightAnim = { name: null, t: 0, dur: 0 };
    this.leftAnim = { name: null, t: 0, dur: 0 };
    this.channel = 0;
    this.switchFlash = 0;

    // 스크래치(핫패스에서 새 객체 만들지 않기)
    this._v = new THREE.Vector3();

    this.setWeapon(0);
    this.setSkill(2);
  }

  Hands.prototype.currentWeapon = function () { return L.WEAPONS[this.weaponIndex]; };
  Hands.prototype.currentSkill = function () { return L.SKILLS[this.skillIndex]; };

  Hands.prototype.setWeapon = function (i) {
    this.weaponIndex = ((i % L.WEAPONS.length) + L.WEAPONS.length) % L.WEAPONS.length;
    const id = this.currentWeapon().id;
    for (const k in this.weapons) this.weapons[k].visible = (k === id);
    this.rightAnim.name = 'swap';
    this.rightAnim.t = 0;
    this.rightAnim.dur = 0.3;
    return this.currentWeapon();
  };

  Hands.prototype.setSkill = function (i) {
    this.skillIndex = ((i % L.SKILLS.length) + L.SKILLS.length) % L.SKILLS.length;
    const s = this.currentSkill();
    const ud = this.scroll.userData;
    ud.panelMat.map = this.runes[s.id];
    ud.panelMat.needsUpdate = true;
    ud.ring.material.color.setHex(s.color);
    ud.ring2.material.color.setHex(s.glow);
    this.leftAnim.name = 'swap';
    this.leftAnim.t = 0;
    this.leftAnim.dur = 0.3;
    return s;
  };

  Hands.prototype.nextWeapon = function (dir) { return this.setWeapon(this.weaponIndex + (dir || 1)); };
  Hands.prototype.nextSkill = function (dir) { return this.setSkill(this.skillIndex + (dir || 1)); };

  /** 오른손 공격 모션 시작 */
  Hands.prototype.playAttack = function () {
    const w = this.currentWeapon();
    this.rightAnim.name = w.id === 'sword' ? 'slash' : (w.id === 'bomb' ? 'throw' : 'shoot');
    this.rightAnim.t = 0;
    this.rightAnim.dur = w.id === 'sword' ? 0.36 : (w.id === 'bomb' ? 0.42 : 0.16);
    if (w.id === 'blaster') {
      const f = this.weapons.blaster.userData.flash;
      f.visible = true;
      f.scale.setScalar(0.8 + Math.random() * 0.5);
    }
  };

  /** 왼손 두루마리 시전 모션 시작. channelSeconds > 0 이면 유지 시전 */
  Hands.prototype.playCast = function (channelSeconds) {
    this.leftAnim.name = 'cast';
    this.leftAnim.t = 0;
    this.leftAnim.dur = 0.5;
    this.channel = channelSeconds || 0;
    if (this.currentSkill().id === 'dragonfire') this.scroll.userData.dragon.visible = true;
  };

  /** 총구/두루마리 끝의 월드 좌표 (out 에 채워 반환) */
  Hands.prototype.getMuzzleWorld = function (out) {
    const w = this.currentWeapon();
    const local = this._v;
    if (w.id === 'blaster') {
      local.copy(this.weapons.blaster.userData.muzzle);
      this.weapons.blaster.localToWorld(local);
    } else {
      local.set(0, 0.6, 0);
      this.weapons[w.id].localToWorld(local);
    }
    // 뷰 씬 좌표 = 카메라 로컬 좌표 → 월드로 옮긴다
    out.copy(local).applyMatrix4(this.worldCamera.matrixWorld);
    return out;
  };

  Hands.prototype.getScrollWorld = function (out) {
    const local = this._v.set(0, -1.2, 0.4);
    this.scroll.localToWorld(local);
    out.copy(local).applyMatrix4(this.worldCamera.matrixWorld);
    return out;
  };

  function easeOutBack(t) {
    const c = 2.2;
    const p = t - 1;
    return 1 + (c + 1) * p * p * p + c * p * p;
  }

  Hands.prototype.update = function (dt, speed01, aiming) {
    this.time += dt;
    this.bob += dt * (4.2 + speed01 * 7.5);
    const t = this.time;
    const sway = Math.sin(this.bob) * (0.045 + speed01 * 0.13);
    const heave = Math.abs(Math.cos(this.bob)) * (0.05 + speed01 * 0.2);
    const breathe = Math.sin(t * 1.6) * 0.03;

    // ---- 오른팔
    const R = this.right;
    const S = ARM_SCALE;
    let rx = RIGHT_BASE.rx + breathe, ry = RIGHT_BASE.ry, rz = RIGHT_BASE.rz;
    let px = RIGHT_BASE.x, py = RIGHT_BASE.y + heave * S, pz = RIGHT_BASE.z;
    const ra = this.rightAnim;
    if (ra.name) {
      ra.t += dt;
      const k = Math.min(1, ra.t / ra.dur);
      if (ra.name === 'slash') {
        // 크게 내리치는 호
        const s = Math.sin(k * Math.PI);
        rx += -1.55 * s;
        rz += 1.5 * s;
        ry += -0.7 * s;
        px -= 1.1 * s * S;
        py += 1.5 * s * S;
      } else if (ra.name === 'shoot') {
        const s = Math.sin(k * Math.PI);
        rx += 0.38 * s;
        pz += 0.6 * s * S;
        py += 0.25 * s * S;
        if (k > 0.45) this.weapons.blaster.userData.flash.visible = false;
      } else if (ra.name === 'throw') {
        const s = k < 0.4 ? (k / 0.4) : (1 - (k - 0.4) / 0.6);
        rx += (k < 0.4 ? 0.9 : -1.25) * s;
        py += 1.1 * s * S;
        this.weapons.bomb.visible = k < 0.45;
      } else if (ra.name === 'swap') {
        const s = 1 - easeOutBack(k);
        py += -3.4 * S * Math.max(0, s);
        rx += 0.7 * Math.max(0, s);
      }
      if (k >= 1) {
        ra.name = null;
        this.weapons.bomb.visible = this.currentWeapon().id === 'bomb';
        this.weapons.blaster.userData.flash.visible = false;
      }
    }
    R.rotation.set(rx, ry + sway * 0.25, rz);
    R.position.set(px + sway * 0.35 * S, py, pz + (aiming ? 0.3 : 0));

    // 폭탄 불꽃 반짝임
    if (this.currentWeapon().id === 'bomb') {
      const sp = this.weapons.bomb.userData.spark;
      const f = 0.75 + Math.sin(t * 26) * 0.2 + Math.random() * 0.14;
      sp.scale.setScalar(f);
    }

    // ---- 왼팔(두루마리)
    const Lm = this.left;
    let lx = LEFT_BASE.rx - breathe, ly = LEFT_BASE.ry, lz = LEFT_BASE.rz;
    let lpx = LEFT_BASE.x, lpy = LEFT_BASE.y + heave * 0.9 * S, lpz = LEFT_BASE.z;
    const ud = this.scroll.userData;
    let open = 0, ringA = 0;
    const la = this.leftAnim;
    if (this.channel > 0) {
      this.channel = Math.max(0, this.channel - dt);
      open = 1;
      ringA = 0.85;
      lx -= 0.55; lpy += 1.0 * S; lpz += 0.5 * S;
      ud.dragon.visible = this.currentSkill().id === 'dragonfire';
      if (ud.dragon.visible) {
        const pulse = 1 + Math.sin(t * 30) * 0.16;
        ud.maw.scale.setScalar(pulse);
        ud.dragon.position.y = 2.0 + Math.sin(t * 6) * 0.14;
      }
      if (this.channel === 0) ud.dragon.visible = false;
    } else if (la.name) {
      la.t += dt;
      const k = Math.min(1, la.t / la.dur);
      if (la.name === 'cast') {
        const s = Math.sin(k * Math.PI);
        lx += -0.85 * s;
        lpy += 1.25 * s * S;
        lpz += 0.85 * s * S;
        open = Math.min(1, s * 1.6);
        ringA = s;
      } else if (la.name === 'swap') {
        const s = 1 - easeOutBack(k);
        lpy += -3.4 * S * Math.max(0, s);
        lx += 0.7 * Math.max(0, s);
      }
      if (k >= 1) { la.name = null; ud.dragon.visible = false; }
    } else {
      ud.dragon.visible = false;
    }
    // 두루마리는 살짝 떠서 흔들린다(각도는 orient 로 맞춰둔 값 유지 — 위치만 흔든다)
    this.scroll.position.y = 0.6 + Math.sin(t * 2.3) * 0.07;
    this.scroll.position.x = 0.1 + Math.sin(t * 1.7) * 0.05;
    // 평소에도 문양이 조금 보이고, 시전할 때 활짝 펴진다
    ud.panel.scale.y = 0.5 + open * 0.5;
    ud.panelMat.opacity = 0.8 + open * 0.2;
    ud.ring.material.opacity = ringA * 0.9;
    ud.ring2.material.opacity = ringA * 0.8;
    ud.ring.rotation.z += dt * 2.4;
    ud.ring2.rotation.z -= dt * 3.6;
    const rs = 0.6 + ringA * 0.5;
    ud.ring.scale.setScalar(rs);
    ud.ring2.scale.setScalar(rs * 1.05);

    Lm.rotation.set(lx, ly - sway * 0.25, lz);
    Lm.position.set(lpx + sway * 0.35 * S, lpy, lpz);
  };

  Hands.prototype.resize = function (aspect, fov) {
    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  };

  L.Hands = Hands;
})(window.LEGO);
