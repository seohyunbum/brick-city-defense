/* =========================================================================
 * story86.js — 단편 「여든여섯 번째 새벽」 (미래의 브릭 시티)
 *
 * 세트 · 배우 · 카메라 · 자막을 모두 시간 하나로 굴리는 연출 모듈이다.
 * story-app.js 가 렌더러를 들고 있고, 여기서는 "무엇이 언제 어떻게 움직이는가"만 다룬다.
 *
 * 아동안전: 상대는 사람도 동물도 아닌 무인 기계뿐이고, 부서질 때는 브릭이 팝 하고
 * 흩어진다. 유혈·반복 점멸·과한 흔들림 없음. 모션 줄이기 옵션을 지원한다.
 * 브랜드: 독립 블록 완구 미학. 특정 완구사의 상표·세트명·캐릭터를 쓰지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const M = L.Motion;
  const Cel = L.Cel;
  const E = M.Ease;
  const S = L.StorySet;

  // ---------------------------------------------------------------- 대본
  // cam: from/to = 카메라 위치, look/lookTo = 바라보는 점. 컷 사이는 잘라 붙인다.
  const SHOTS = [
    {
      id: 'dawn', dur: 10,
      cam: { from: [-34, 26, 92], to: [12, 40, 68], look: [0, 14, -44], lookTo: [0, 24, -76], fov: 46, fovTo: 40 },
      captions: [
        { at: 0.6, text: '2186년. 브릭 시티는 여든여섯 번째 봄을 맞았다.' },
        { at: 5.2, text: '도시는 벽 안쪽에서 조용히 아침을 준비한다.' },
      ],
    },
    {
      id: 'horizon', dur: 10,
      cam: { from: [-16, 12.8, -112], to: [11, 13.2, -115], look: [-4, 8, -176], lookTo: [6, 7, -190], fov: 40, fovTo: 33 },
      captions: [
        { at: 0.4, text: '그날 아침, 지평선에서 먼지가 일었다.' },
        { at: 4.6, text: '스크랩 군단 — 사람이 타지 않는 낡은 기계 무리다.' },
      ],
    },
    {
      id: 'hangar', dur: 12,
      cam: { from: [-29, 6.4, 33], to: [-37, 4.4, 24], look: [-45, 4.2, 13], lookTo: [-45.5, 6.0, 12], fov: 48, fovTo: 42 },
      captions: [
        { at: 0.5, text: '격납고의 불이 하나씩 켜진다.' },
        { at: 4.2, text: '정비반이 밤새 다리를 손봤다. 86호기, 출격 준비 완료.' },
        { at: 8.4, text: '조종석에 오르는 건 이 도시에 사는 평범한 시민이다.' },
      ],
    },
    {
      id: 'march', dur: 14, follow: 'mech',
      cam: { fov: 38, fovTo: 34 },
      captions: [
        { at: 0.6, text: '네 다리로 걷는 86호기는 길이 끊긴 곳도 넘어간다.' },
        { at: 6.0, text: '무기는 스터드 발사기 두 문. 상대는 기계뿐이다.' },
      ],
    },
    {
      id: 'clash', dur: 13,
      cam: { from: [20, 7.4, -122], to: [13, 5.6, -130], look: [2, 4.4, -152], lookTo: [1, 3.8, -166], fov: 44, fovTo: 37 },
      captions: [
        { at: 1.0, text: '스터드 한 발이면 낡은 관절은 버티지 못한다.' },
        { at: 5.4, text: '부서지는 건 브릭뿐 —' },
        { at: 8.6, text: '다치는 사람은 아무도 없다.' },
      ],
    },
    {
      id: 'sunrise', dur: 15,
      cam: { from: [13, 3.4, 34], to: [-9, 18, 54], look: [0, 4, 6], lookTo: [0, 9, -18], fov: 42, fovTo: 48 },
      captions: [
        { at: 0.8, text: '해가 벽을 넘어 광장으로 들어온다.' },
        { at: 5.0, text: '사람들이 다시 걸어 나온다. 86호기는 무릎을 접고 기다린다.' },
        { at: 10.0, text: '여든여섯 번째 새벽. 도시는 오늘도 무사하다.' },
      ],
    },
  ];

  // ---------------------------------------------------------------- 본체
  function Story(scene, opts) {
    const o = opts || {};
    this.scene = scene;
    this.reduceMotion = !!o.reduceMotion;
    this.time = 0;
    this.shotIndex = -1;
    this.shotStart = 0;
    this.caption = '';
    this.captionIndex = -1;
    this.finished = false;

    const rng = L.RNG.mulberry32(8686);   // 같은 씨앗 = 항상 같은 화면(스모크 재현성)
    this.duration = SHOTS.reduce((sum, s) => sum + s.dur, 0);

    // ----- 하늘 · 빛
    // 하늘·해는 카메라를 따라다니는 리그에 담는다 — 걸어가도 하늘이 밀리지 않는다
    this.skyRig = new THREE.Group();
    scene.add(this.skyRig);
    this.sky = Cel.skyDome(300);
    this.sky.setColors(C.cineNight, C.cineDawnHigh, C.cineDawnLow, C.cineDawnHaze);
    this.skyRig.add(this.sky.mesh);
    // 안개 색 = 지평선 하늘색. 멀어진 땅이 하늘로 녹아 들어가 경계선이 생기지 않는다.
    scene.fog = new THREE.Fog(C.cineDawnHaze, 130, 380);
    this.sun = Cel.sunDisc(11, C.cineSun);
    this.sun.position.set(46, 12, -262);
    this.skyRig.add(this.sun);
    this.lights = Cel.lightRig(scene, {});

    // ----- 세트
    S.ground(scene);
    this.city = S.skyline(scene, rng);
    S.wall(scene);
    this.hangar = S.hangar(scene);

    // ----- 86호기
    this.mech = L.Mech86.build({ body: C.sandBlue, dark: C.darkBlue, trim: C.cineSteel });
    scene.add(this.mech);

    // ----- 파일럿과 시민들
    this.pilot = Cel.celify(L.minifig({
      torso: C.orange, legs: C.darkBlue, helmet: C.white, face: 'smile', name: '파일럿',
    }));
    this.pilot.scale.setScalar(0.5);    // 미니피그 키 ≈ 2.5 유닛 — 86호기(≈7)의 3분의 1
    Cel.outline(this.pilot, 0.02);
    scene.add(this.pilot);

    this.citizens = [];
    for (let i = 0; i < 7; i++) {
      const fig = Cel.celify(L.minifig(L.OUTFITS[i % L.OUTFITS.length]));
      fig.scale.setScalar(0.5);
      Cel.outline(fig, 0.02);
      fig.userData.seed = rng() * 6.3;
      fig.userData.lane = -18 + i * 6;
      scene.add(fig);
      this.citizens.push(fig);
    }

    // ----- 스크랩 기계
    this.scraps = [];
    for (let i = 0; i < 5; i++) {
      const s = S.scrapWalker(rng);
      s.visible = false;
      scene.add(s);
      this.scraps.push(s);
    }

    // ----- 입자
    this.burst = new S.BrickBurst(scene, this.reduceMotion ? 48 : 96);
    this.dust = new Cel.DustField(this.reduceMotion ? 40 : 120,
      { x: 0, y: 0.5, z: -30, w: 160, h: 26, d: 120 }, C.cineHaze, 0.7);
    scene.add(this.dust.points);
    this.horizonDust = new Cel.DustField(this.reduceMotion ? 30 : 90,
      { x: 0, y: 1, z: -180, w: 170, h: 26, d: 40 }, C.darkTan, 6.5);
    scene.add(this.horizonDust.points);

    // ----- 카메라 상태(스프링 + 손떨림)
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camFov = 40;
    this.posSpring = new M.Spring3(2.6, 1);
    this.lookSpring = new M.Spring3(2.2, 1);
    this.handheld = new M.Noise1D(86);
    this.handheld2 = new M.Noise1D(4242);

    // ----- 스크래치
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._fireTimes = [2.2, 4.6, 6.9, 9.2];
    this._fired = 0;
    this._pendingHit = -1;      // 명중 예정 시각(컷 로컬)
    this._pendingTarget = null;
    this.reset();
  }

  Story.prototype.reset = function () {
    this.time = 0;
    this.shotIndex = -1;
    this.finished = false;
    this.caption = '';
    this.captionIndex = -1;
    this._fired = 0;
    this._pendingTarget = null;
    this.burst.hideAll();
    this.sky.setColors(C.cineNight, C.cineDawnHigh, C.cineDawnLow, C.cineDawnHaze);
    this.sun.position.set(46, 12, -262);
  };

  Story.prototype.shotAt = function (time) {
    let t = 0;
    for (let i = 0; i < SHOTS.length; i++) {
      if (time < t + SHOTS[i].dur) return { index: i, start: t };
      t += SHOTS[i].dur;
    }
    return { index: SHOTS.length - 1, start: t - SHOTS[SHOTS.length - 1].dur };
  };

  /** 컷이 바뀌는 순간: 배우를 자리에 세우고 카메라 스프링을 끊어 붙인다 */
  Story.prototype._enterShot = function (index) {
    this.shotIndex = index;
    const id = SHOTS[index].id;
    const mech = this.mech;
    const pilot = this.pilot;

    this.hangar.lamps.forEach((l) => { l.visible = id === 'hangar'; });
    this.hangar.inner.intensity = 0;
    for (let i = 0; i < this.scraps.length; i++) {
      const s = this.scraps[i];
      s.visible = id === 'horizon' || id === 'clash';
      if (id === 'horizon') {
        s.position.set(-42 + i * 20, 0, -182 - (i % 2) * 9);
        s.rotation.y = 0;
        s.scale.setScalar(1);
      } else if (id === 'clash') {
        s.position.set(-17 + i * 8.5, 0, -172 - (i % 3) * 8);
        s.rotation.y = Math.PI;
        s.scale.setScalar(1);
      }
    }

    if (id === 'hangar') {
      mech.position.set(-45.5, 0, 12);
      mech.rotation.y = Math.PI * 0.5;
      pilot.visible = true;
      pilot.position.set(-33, 0, 22);
      pilot.rotation.y = Math.PI * 0.75;
    } else if (id === 'march') {
      mech.position.set(-30, 0, -24);
      mech.rotation.y = -Math.PI * 0.5;   // 앞(-Z)이 +X 를 향하게
      pilot.visible = false;
    } else if (id === 'clash') {
      mech.position.set(-2, 0, -146);
      mech.rotation.y = 0;                // 앞(-Z) = 성벽 바깥쪽
      pilot.visible = false;
    } else if (id === 'sunrise') {
      mech.position.set(0, 0, 6);
      mech.rotation.y = Math.PI;          // 광장(=카메라) 쪽을 본다
      pilot.visible = false;
    } else {
      mech.position.set(-45.5, 0, 12);
      mech.rotation.y = Math.PI * 0.5;
      pilot.visible = false;
    }

    for (let i = 0; i < this.citizens.length; i++) {
      const fig = this.citizens[i];
      const inPlaza = id === 'dawn' || id === 'sunrise';
      fig.visible = inPlaza;
      if (id === 'sunrise') fig.position.set(fig.userData.lane, 0, -26 - (i % 3) * 6);
      else fig.position.set(fig.userData.lane * 0.8, 0, -2 + (i % 3) * 5);
      fig.rotation.y = id === 'sunrise' ? 0 : (i % 2 ? 0.6 : -0.9);
    }

    // 그림자 카메라는 좁다 — 그 컷의 주인공 쪽으로 키 라이트를 통째로 옮긴다
    const focus = (id === 'hangar') ? this.hangar.group.position : this.mech.position;
    this.lights.key.target.position.set(focus.x, 0, focus.z);
    this.lights.key.position.set(focus.x - 30, 44, focus.z + 26);
    this.lights.key.target.updateMatrixWorld();

    // 컷 직후 카메라가 미끄러져 들어오지 않게 스프링을 목표에 딱 붙인다
    this._evalCamera(SHOTS[index], 0);
    this.posSpring.set(this._p.x, this._p.y, this._p.z);
    this.lookSpring.set(this._l.x, this._l.y, this._l.z);
    this.camFov = SHOTS[index].cam.fov || 40;
  };

  /** 컷의 카메라 목표값을 _p(위치)·_l(주시점) 에 쓴다 */
  Story.prototype._evalCamera = function (shot, u) {
    const cam = shot.cam;
    if (shot.follow === 'mech') {
      // 트래킹 샷: 메크 옆을 나란히 달리며 조금씩 뒤로 빠진다
      const m = this.mech.position;
      const back = M.lerp(13, 22, E.inOutSine(u));
      const side = M.lerp(15, 10, E.inOutSine(u));
      this._p.set(m.x - back, M.lerp(3.0, 7.0, E.inOutCubic(u)), m.z + side);
      this._l.set(m.x + 4, 4.6, m.z - 0.5);
      return;
    }
    const k = E.inOutCubic(u);
    this._p.set(
      M.lerp(cam.from[0], cam.to[0], k),
      M.lerp(cam.from[1], cam.to[1], k),
      M.lerp(cam.from[2], cam.to[2], k)
    );
    this._l.set(
      M.lerp(cam.look[0], cam.lookTo[0], k),
      M.lerp(cam.look[1], cam.lookTo[1], k),
      M.lerp(cam.look[2], cam.lookTo[2], k)
    );
  };

  Story.prototype._updateCaption = function (shot, local) {
    let text = '';
    let index = -1;
    for (let i = 0; i < shot.captions.length; i++) {
      if (local >= shot.captions[i].at) { text = shot.captions[i].text; index = i; }
    }
    this.caption = text;
    this.captionIndex = index;
  };

  // ------------------------------------------------------------ 배우 갱신
  Story.prototype._actHangar = function (local, dt) {
    const pilot = this.pilot;
    // 0~4.4초: 격납고 바닥을 달려 사다리까지. 도착 직전에 속도를 줄인다.
    const runEnd = 4.4;
    if (local < runEnd) {
      const u = E.outQuad(M.clamp01(local / runEnd));
      pilot.position.set(M.lerp(-33, -43.3, u), 0, M.lerp(22, 16.4, u));
      pilot.rotation.y = M.dampAngle(pilot.rotation.y, Math.PI * 0.72, 6, dt);
      const speed = 1 - E.inQuad(M.clamp01((local - runEnd * 0.7) / (runEnd * 0.3)));
      S.runCycle(pilot, local * 13, 0.55 + speed * 0.45);
    } else if (local < 8.6) {
      // 사다리를 오른다 — 손발이 번갈아, 높이는 일정하게
      const u = M.clamp01((local - runEnd) / 4.2);
      pilot.position.set(-43.4, E.inOutSine(u) * 6.1, 16.1);
      pilot.rotation.y = Math.PI;
      S.climbCycle(pilot, local * 8);
    } else {
      // 조종석에 들어가 앉는다
      const u = M.clamp01((local - 8.6) / 1.1);
      pilot.position.set(M.lerp(-43.4, -45.4, u), M.lerp(6.1, 6.4, u), M.lerp(16.1, 12.6, u));
      pilot.rotation.y = M.lerp(Math.PI, Math.PI * 0.5, u);
      S.idleCycle(pilot, local, 0);
      pilot.visible = u < 0.92;
    }
    // 격납고 조명이 순서대로 켜진다(점멸 아님 — 한 번씩만 켜진다)
    let lit = 0;
    for (let i = 0; i < this.hangar.lamps.length; i++) {
      const on = local > 0.4 + i * 0.55;
      this.hangar.lamps[i].visible = on;
      if (on) lit++;
    }
    // 실내광은 등이 켜진 수만큼 부드럽게 올라온다(툭 켜지지 않게)
    this.hangar.inner.intensity = M.damp(this.hangar.inner.intensity, lit * 0.75, 3.5, dt);
    L.Mech86.update(this.mech, dt, { speed: 0, turretYaw: Math.sin(local * 0.4) * 0.12, crouch: local < 9.4 ? 0.22 : 0 });
  };

  Story.prototype._actMarch = function (local, dt) {
    const shot = SHOTS[this.shotIndex];
    // 출발은 천천히, 중간은 일정하게, 끝에서 다시 줄인다 — 무게가 느껴지는 가감속
    const speedCurve = Math.min(E.outCubic(M.clamp01(local / 3.2)), E.outCubic(M.clamp01((shot.dur - local) / 2.6)));
    const speed = 5.4 * speedCurve;
    this.mech.position.x += speed * dt;
    const key = this.lights.key;
    key.position.set(this.mech.position.x - 30, 44, this.mech.position.z + 26);
    key.target.position.set(this.mech.position.x, 0, this.mech.position.z);
    key.target.updateMatrixWorld();
    L.Mech86.update(this.mech, dt, {
      speed, stride: 3.2,
      turretYaw: Math.sin(local * 0.55) * 0.3,
      bank: Math.sin(local * 0.7) * 0.008,
    });
  };

  Story.prototype._actClash = function (local, dt) {
    // 기계들이 성벽 쪽으로 다가온다
    for (let i = 0; i < this.scraps.length; i++) {
      const s = this.scraps[i];
      if (!s.visible) continue;
      s.position.z += 2.4 * dt;
      const legs = s.userData.legs;
      for (let n = 0; n < legs.length; n++) {
        const leg = legs[n];
        leg.group.rotation.x = leg.base + Math.sin(local * 5.5 + leg.phase * 6.3) * 0.34;
      }
      s.position.y = Math.abs(Math.sin(local * 5.5 + s.userData.bobSeed)) * 0.22;
    }
    // 정해진 시각에 한 발씩. 맞은 기계는 브릭이 되어 흩어진다.
    while (this._fired < this._fireTimes.length && local >= this._fireTimes[this._fired]) {
      let target = null;
      for (let i = 0; i < this.scraps.length; i++) {
        const s = this.scraps[i];
        if (!s.visible) continue;
        if (!target || s.position.z > target.position.z) target = s;   // +Z 쪽 = 더 가까이 온 놈
      }
      L.Mech86.fire(this.mech, this._fired % 2, this._muzzle);
      this._pendingTarget = target || null;
      this._pendingHit = local + 0.22;      // 스터드가 날아가 닿는 시간
      this._fired++;
    }
    if (this._pendingTarget && local >= this._pendingHit) {
      const t = this._pendingTarget;
      this.burst.pop(t.position.x, 2.8, t.position.z, this.reduceMotion ? 9 : 18, 7);
      t.visible = false;
      this._pendingTarget = null;
    }
    let aim = null;
    for (let i = 0; i < this.scraps.length; i++) {
      const s = this.scraps[i];
      if (!s.visible) continue;
      if (!aim || s.position.z > aim.position.z) aim = s;
    }
    const yaw = aim ? Math.atan2(aim.position.x - this.mech.position.x, -(aim.position.z - this.mech.position.z)) : 0;
    L.Mech86.update(this.mech, dt, { speed: 0, turretYaw: yaw, crouch: 0.1 });
  };

  Story.prototype._actSunrise = function (local, dt) {
    // 해가 벽을 넘어 올라오고 하늘이 밝아진다
    const u = M.clamp01(local / 11);
    this.sun.position.y = M.lerp(12, 66, E.outCubic(u));
    this.lights.key.intensity = M.lerp(1.1, 1.9, u);
    this.lights.rim.intensity = M.lerp(1.6, 0.9, u);
    // 무릎을 접고 앉는다 — 마지막에 살짝 되돌아오는 오버슛이 무게를 준다
    const kneel = E.outBack(M.clamp01((local - 1.4) / 3.4));
    L.Mech86.update(this.mech, dt, { speed: 0, crouch: M.clamp01(kneel) * 0.62, turretYaw: 0 });
    // 시민들이 광장으로 걸어 들어온다
    for (let i = 0; i < this.citizens.length; i++) {
      const fig = this.citizens[i];
      const delay = i * 0.55;
      const w = M.clamp01((local - 2.2 - delay) / 7);
      fig.position.z = M.lerp(-26 - (i % 3) * 6, 10 + (i % 3) * 5, E.inOutSine(w));
      if (w > 0 && w < 1) L.animateWalk(fig, (local - delay) * 5.6, 0.8);
      else S.idleCycle(fig, local, fig.userData.seed);
    }
  };

  Story.prototype._actDawn = function (local, dt) {
    for (let i = 0; i < this.citizens.length; i++) S.idleCycle(this.citizens[i], local, this.citizens[i].userData.seed);
    L.Mech86.update(this.mech, dt, { speed: 0, crouch: 0.4 });
  };

  Story.prototype._actHorizon = function (local, dt) {
    for (let i = 0; i < this.scraps.length; i++) {
      const s = this.scraps[i];
      s.position.z += 1.1 * dt;
      s.position.y = Math.abs(Math.sin(local * 3.2 + s.userData.bobSeed)) * 0.3;
      const legs = s.userData.legs;
      for (let n = 0; n < legs.length; n++) {
        legs[n].group.rotation.x = legs[n].base + Math.sin(local * 3.2 + legs[n].phase * 6.3) * 0.3;
      }
    }
    L.Mech86.update(this.mech, dt, { speed: 0, crouch: 0.4 });
  };

  // ------------------------------------------------------------ 프레임
  Story.prototype.update = function (dt, camera) {
    if (this.finished) return;
    this.time += dt;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.finished = true;
    }
    this.skyRig.position.copy(camera.position);
    const at = this.shotAt(this.time);
    const shot = SHOTS[at.index];
    if (at.index !== this.shotIndex) {
      this.shotStart = at.start;
      this._enterShot(at.index);
    }
    const local = this.time - at.start;
    const u = M.clamp01(local / shot.dur);

    switch (shot.id) {
      case 'dawn': this._actDawn(local, dt); break;
      case 'horizon': this._actHorizon(local, dt); break;
      case 'hangar': this._actHangar(local, dt); break;
      case 'march': this._actMarch(local, dt); break;
      case 'clash': this._actClash(local, dt); break;
      case 'sunrise': this._actSunrise(local, dt); break;
      default: break;
    }

    this.burst.update(dt);
    this.dust.update(dt, 0.4);
    this.horizonDust.update(dt, shot.id === 'horizon' ? 1.8 : 0.6);
    this._updateCaption(shot, local);

    // ----- 카메라: 목표 → 스프링(무게) → 손떨림(생명감)
    this._evalCamera(shot, u);
    this.posSpring.update(this._p.x, this._p.y, this._p.z, dt);
    this.lookSpring.update(this._l.x, this._l.y, this._l.z, dt);
    const shake = this.reduceMotion ? 0 : (shot.id === 'clash' ? 0.28 : 0.12);
    const t = this.time;
    camera.position.set(
      this.posSpring.x.value + this.handheld.fbm(t * 0.9) * shake,
      this.posSpring.y.value + this.handheld.fbm(t * 0.7 + 40) * shake * 0.8,
      this.posSpring.z.value + this.handheld2.fbm(t * 0.8) * shake
    );
    this._l.set(this.lookSpring.x.value, this.lookSpring.y.value, this.lookSpring.z.value);
    camera.lookAt(this._l);
    const fov = M.lerp(shot.cam.fov || 40, shot.cam.fovTo || shot.cam.fov || 40, E.inOutSine(u));
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };

  Story.prototype.seek = function (time) {
    this.time = M.clamp(time, 0, this.duration);
    this.finished = false;
    this.shotIndex = -1;
  };

  Story.SHOTS = SHOTS;
  L.Story86 = Story;
})(window.LEGO = window.LEGO || {});
