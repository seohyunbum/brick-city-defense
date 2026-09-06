/* =========================================================================
 * mech86.js — 86호기: 브릭으로 조립한 4족 보행 작업기(순수 팩토리 + 리그 갱신)
 *
 * 아동안전(CLAUDE.md 5장): 사람·동물 형태가 아니다. 무기는 스터드 발사기이고
 * 상대는 무생물 기계뿐이다. 조종석에는 지켜야 할 시민 미니피그가 탄다.
 *
 * 움직임은 전부 절차적이다.
 *   - 발: 접지/유각 위상 → 2관절 IK (motion.js)
 *   - 몸통: 발이 땅을 짚을 때마다 무게가 실리는 상하·좌우 흔들림 + 스프링 잔진동
 *   - 안테나·배기 후드: 부모를 늦게 따라가는 2차 운동
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const M = L.Motion;
  const Cel = L.Cel;

  const FEMUR = 2.7;          // 허벅지 길이
  const TIBIA = 3.4;          // 정강이 길이
  const HIP_H = 5.0;          // 기본 엉덩이 높이(= 서 있을 때 몸통 바닥)
  const DUTY = 0.62;          // 한 걸음 주기 중 발이 땅에 붙어 있는 비율

  // 다리 배치: [좌우(x), 앞뒤(z), 보행 위상] — 대각선 두 짝이 번갈아 나가는 트롯
  const LEG_LAYOUT = [
    { id: 'FL', x: -2.3, z: -2.6, phase: 0.0 },
    { id: 'FR', x: 2.3, z: -2.6, phase: 0.5 },
    { id: 'BL', x: -2.3, z: 2.6, phase: 0.5 },
    { id: 'BR', x: 2.3, z: 2.6, phase: 0.0 },
  ];

  function panel(w, h, d, color) {
    const m = new THREE.Mesh(L.roundedBox(w, h, d, 0.14, 2), Cel.toon(color));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function buildLeg(layout, color, dark) {
    const coxa = new THREE.Group();
    coxa.position.set(layout.x, 0, layout.z);
    // 다리는 바깥으로 살짝 벌어져 있다. 벌린 각은 고정이고, 앞뒤·상하만 IK 로 푼다
    // (좌우까지 IK 로 풀면 발이 몸 밑으로 파고들며 다리가 꼬인다).
    coxa.rotation.z = layout.x < 0 ? -0.16 : 0.16;
    // 어깨 블록(다리가 몸통에 붙는 관절)
    const shoulder = new THREE.Mesh(L.sph(0.72, 12), Cel.toon(dark));
    shoulder.castShadow = true;
    coxa.add(shoulder);

    const femur = new THREE.Group();
    coxa.add(femur);
    const femurMesh = panel(0.82, FEMUR, 0.96, color);
    femurMesh.position.y = -FEMUR / 2;
    femur.add(femurMesh);
    // 유압 실린더 — 관절이 기계라는 걸 한눈에 보여주는 장식
    const piston = new THREE.Mesh(L.cyl(0.16, 0.16, FEMUR * 0.7, 8), Cel.toon(C.cineSteel));
    piston.position.set(0, -FEMUR * 0.45, 0.52);
    femur.add(piston);

    const tibia = new THREE.Group();
    tibia.position.y = -FEMUR;
    femur.add(tibia);
    const tibiaMesh = panel(0.6, TIBIA, 0.72, dark);
    tibiaMesh.position.y = -TIBIA / 2;
    tibia.add(tibiaMesh);

    const foot = new THREE.Group();
    foot.position.y = -TIBIA;
    tibia.add(foot);
    const pad = new THREE.Mesh(L.roundedBox(1.5, 0.42, 2.0, 0.16, 2), Cel.toon(C.cineScrapDark));
    pad.position.y = -0.18;
    pad.castShadow = true;
    foot.add(pad);

    return {
      id: layout.id, coxa, femur, tibia, foot,
      home: { x: layout.x * 1.16, z: layout.z * 1.1 },
      phase: layout.phase,
      contact: 1,
      lastContact: 1,
    };
  }

  /**
   * 86호기 한 대.
   * @param {object} opts { body, trim, pilot }
   */
  function build(opts) {
    const o = opts || {};
    const bodyColor = o.body === undefined ? C.sandBlue : o.body;
    const trimColor = o.trim === undefined ? C.cineSteel : o.trim;
    const darkColor = o.dark === undefined ? C.darkBlue : o.dark;

    const root = new THREE.Group();
    const chassis = new THREE.Group();     // 흔들림이 들어가는 몸통
    chassis.position.y = HIP_H;
    root.add(chassis);

    // ----- 몸통: 앞이 좁고 뒤가 두꺼운 선체. 옆에서 보면 쐐기꼴이라 진행 방향이 읽힌다.
    const hull = panel(4.6, 1.5, 5.4, bodyColor);
    hull.position.set(0, 0.6, 0.3);
    chassis.add(hull);
    const nose = panel(3.0, 1.0, 2.6, bodyColor);
    nose.position.set(0, 0.25, -3.1);
    nose.rotation.x = -0.16;
    chassis.add(nose);
    const deck = panel(3.6, 0.5, 4.4, darkColor);
    deck.position.set(0, 1.45, 0.4);
    chassis.add(deck);
    // 뒤쪽 동력 블록 + 배기구 두 개(발광). 무게 중심이 뒤에 있어 보인다.
    const engine = panel(3.4, 1.9, 1.8, darkColor);
    engine.position.set(0, 1.0, 3.2);
    chassis.add(engine);
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(L.cyl(0.34, 0.34, 1.2, 10), Cel.toon(C.cineSteel));
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx * 1.0, 1.6, 4.2);
      chassis.add(pipe);
      const heat = new THREE.Mesh(L.cyl(0.28, 0.28, 0.16, 10), Cel.glow(C.fire, 0.8));
      heat.rotation.x = Math.PI / 2;
      heat.position.set(sx * 1.0, 1.6, 4.75);
      heat.userData.noOutline = true;
      chassis.add(heat);
      // 다리가 붙는 어깨 포드 — 다리가 몸에서 툭 튀어나온 느낌을 없앤다
      for (const sz of [-1, 1]) {
        const pod = panel(1.3, 1.1, 1.6, darkColor);
        pod.position.set(sx * 2.15, 0.15, sz * 2.6);
        chassis.add(pod);
      }
      const skirt = panel(0.5, 1.1, 4.2, darkColor);
      skirt.position.set(sx * 2.5, -0.15, 0.4);
      chassis.add(skirt);
    }

    // 조종석: 앞이 낮은 캐노피. 파일럿이 앉는 자리다.
    const cockpit = new THREE.Group();
    cockpit.position.set(0, 1.7, -1.1);
    chassis.add(cockpit);
    const seatBack = panel(2.2, 2.1, 0.5, darkColor);
    seatBack.position.set(0, 1.05, 1.3);
    cockpit.add(seatBack);
    const canopy = new THREE.Mesh(L.roundedBox(3.0, 2.6, 3.4, 0.55, 3), new THREE.MeshToonMaterial({
      color: C.glass, gradientMap: Cel.toonGradient(), transparent: true, opacity: 0.42,
    }));
    canopy.position.set(0, 1.25, -0.3);
    canopy.userData.noOutline = true;
    cockpit.add(canopy);

    // ----- 포탑: 스터드 발사기 두 문 (총구는 몸통 앞쪽)
    const turret = new THREE.Group();
    turret.position.set(0, 1.9, 0.7);
    chassis.add(turret);
    const turretBase = panel(2.4, 0.9, 2.4, trimColor);
    turret.add(turretBase);
    const cannons = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 1.5, 0.2, 0);
      turret.add(arm);
      const barrel = new THREE.Mesh(L.cyl(0.34, 0.4, 3.4, 12), Cel.toon(trimColor));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = -1.4;
      barrel.castShadow = true;
      arm.add(barrel);
      const muzzle = new THREE.Mesh(L.cyl(0.46, 0.46, 0.5, 12), Cel.toon(darkColor));
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.z = -3.0;
      arm.add(muzzle);
      // 총구 섬광(평소엔 꺼둔다 — 반복 점멸 금지 규칙에 맞춰 짧게 한 번만 켠다)
      const flash = new THREE.Mesh(L.sph(0.75, 10), Cel.glow(C.yellow, 0.85));
      flash.position.z = -3.4;
      flash.visible = false;
      flash.userData.noOutline = true;
      arm.add(flash);
      cannons.push({ arm, flash, recoil: new M.Spring(0, 7, 0.42), flashTimer: 0, muzzleZ: -3.4 });
    }

    // ----- 안테나: 부모를 늦게 따라오는 2차 운동용 마디
    const antenna = [];
    let parent = chassis;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 1.6 : 0.9;
      if (i === 0) seg.position.set(-1.6, 1.6, 1.9);
      const rod = new THREE.Mesh(L.cyl(0.08, 0.09, 0.9, 6), Cel.toon(C.cineSteel));
      rod.position.y = 0.45;
      rod.userData.noOutline = true;
      seg.add(rod);
      parent.add(seg);
      parent = seg;
      antenna.push({ group: seg, vel: 0, angle: 0 });
    }
    const tip = new THREE.Mesh(L.sph(0.16, 8), Cel.glow(C.cineEye));
    tip.position.y = 0.95;
    tip.userData.noOutline = true;
    parent.add(tip);

    // ----- 다리 넷
    const legs = [];
    for (const layout of LEG_LAYOUT) {
      const leg = buildLeg(layout, bodyColor, darkColor);
      chassis.add(leg.coxa);
      legs.push(leg);
    }

    Cel.outline(root, 0.05);

    root.userData.rig = {
      chassis, cockpit, turret, cannons, antenna, legs,
      hipHeight: HIP_H,
      // 몸통 흔들림용 스프링(관성·잔진동). 목표값을 매 프레임 던져 준다.
      bob: new M.Spring(0, 3.4, 0.55),
      roll: new M.Spring(0, 3.0, 0.5),
      pitch: new M.Spring(0, 2.6, 0.55),
      turretYaw: new M.Spring(0, 1.6, 0.7),
      phase: 0,
      distance: 0,
      lastSpeed: 0,
      shake: 0,
      // 스크래치 (핫패스 할당 금지)
      _foot: { x: 0, y: 0, contact: 1 },
      _ik: { hip: 0, knee: 0 },
      _v: new THREE.Vector3(),
    };
    root.userData.isMech = true;
    return root;
  }

  /**
   * 한 프레임 갱신.
   * @param {THREE.Object3D} mech build() 결과
   * @param {number} dt
   * @param {object} p { speed(전진 속도, 유닛/초), cadence(초당 걸음), stride, groundY, turretYaw, crouch }
   */
  function update(mech, dt, p) {
    const r = mech.userData.rig;
    if (!r) return;
    const speed = p.speed || 0;
    const stride = p.stride === undefined ? 3.1 : p.stride;
    // 발 미끄러짐 0 의 조건: 접지 중 발이 몸 기준으로 뒤로 밀리는 속도 = 전진 속도.
    // 접지 구간에서 발은 stride 만큼 쓸리고 그 시간은 DUTY/cadence 이므로
    //   speed = stride * cadence / DUTY  →  cadence = speed * DUTY / stride
    // 이렇게 잡으면 속도가 변해도 한 걸음의 길이가 그대로다.
    const cadence = p.cadence === undefined ? Math.min(2.2, Math.abs(speed) * DUTY / stride) : p.cadence;
    r.phase += cadence * dt;
    if (r.phase > 1e6) r.phase -= 1e6;

    const foot = r._foot, ik = r._ik;
    let touchdown = 0;          // 이 프레임에 새로 닿은 다리 수(접지 충격)
    let rollTorque = 0;

    for (let i = 0; i < r.legs.length; i++) {
      const leg = r.legs[i];
      const phase = M.gaitPhase(r.phase, 1, leg.phase);
      M.footCycle(foot, phase, stride, 1.15, DUTY);
      // 서 있을 때는 발을 흔들지 않는다(보폭 0 → 제자리)
      leg.lastContact = leg.contact;
      leg.contact = speed > 0.05 ? foot.contact : 1;
      if (leg.contact && !leg.lastContact) touchdown++;

      // 발 목표(몸통 기준). 앞(-Z)으로 걸으므로 접지 중인 발은 몸 뒤(+Z)로 밀려난다.
      const tz = leg.home.z - foot.x;
      const ty = -r.hipHeight + foot.y + (p.groundY || 0);

      // 다리 평면(앞뒤 × 상하) 안에서 2관절 IK. 앞이 -Z 이므로 부호를 뒤집는다.
      const planeX = -(tz - leg.coxa.position.z);
      M.ik2(ik, planeX, ty, FEMUR, TIBIA);
      leg.femur.rotation.x = M.damp(leg.femur.rotation.x, ik.hip, 26, dt);
      leg.tibia.rotation.x = M.damp(leg.tibia.rotation.x, ik.knee, 26, dt);
      // 발바닥은 항상 땅과 평행하게(발끝이 하늘을 보지 않게)
      leg.foot.rotation.x = -(leg.femur.rotation.x + leg.tibia.rotation.x);

      if (leg.contact) rollTorque += leg.home.x > 0 ? 1 : -1;
    }

    // ----- 몸통: 짚은 다리 쪽으로 무게가 쏠리고, 새로 닿을 때마다 살짝 주저앉는다
    const walking = speed > 0.05 ? 1 : 0;
    const impact = touchdown > 0 ? -0.16 * touchdown : 0;
    const bobTarget = walking * (Math.sin(r.phase * Math.PI * 2 * 2) * 0.1) + impact - (p.crouch || 0) * 1.9;
    r.bob.update(bobTarget, dt);
    r.roll.update(walking * rollTorque * 0.022 + (p.bank || 0), dt);
    // 가속하면 앞으로 기울고 멈추면 뒤로 되돌아온다 — 관성이 보이는 부분
    const accel = (speed - r.lastSpeed) / Math.max(dt, 1e-4);
    r.lastSpeed = speed;
    r.pitch.update(M.clamp(accel * 0.012, -0.14, 0.14) + walking * 0.03, dt);

    r.chassis.position.y = r.hipHeight + r.bob.value;
    r.chassis.rotation.z = r.roll.value;
    r.chassis.rotation.x = r.pitch.value;

    // ----- 포탑: 목표 각을 늦게 따라간다(무거운 것은 즉시 돌지 않는다)
    r.turret.rotation.y = r.turretYaw.update(p.turretYaw || 0, dt);

    // ----- 반동 · 총구 섬광
    for (let i = 0; i < r.cannons.length; i++) {
      const c = r.cannons[i];
      // 반동은 목표 0 으로 되돌아오는 스프링 — 뒤로 튕겼다 천천히 제자리
      c.arm.position.z = -c.recoil.update(0, dt) * 0.9;
      if (c.flashTimer > 0) {
        c.flashTimer -= dt;
        c.flash.visible = c.flashTimer > 0;
      }
    }

    // ----- 안테나: 부모의 각속도를 늦게 따라오는 채찍 운동
    const drive = r.roll.velocity * 0.02 + r.bob.velocity * 0.05;
    for (let i = 0; i < r.antenna.length; i++) {
      const seg = r.antenna[i];
      const stiffness = 42 - i * 9;
      const damping = 7.5 - i * 1.2;
      const target = -drive * (i + 1) * 0.35;
      seg.vel += (target - seg.angle) * stiffness * dt - seg.vel * damping * dt;
      seg.angle += seg.vel * dt;
      seg.group.rotation.z = M.clamp(seg.angle, -0.5, 0.5);
    }
  }

  /** 발사: 반동을 걸고 총구 위치를 out 에 담아 준다(새 벡터 만들지 않음) */
  function fire(mech, index, out) {
    const r = mech.userData.rig;
    if (!r) return out;
    const c = r.cannons[index % r.cannons.length];
    c.recoil.value = 0.85;
    c.recoil.velocity = 0;
    c.flashTimer = 0.07;
    c.flash.visible = true;
    if (out) {
      out.set(0, 0, c.muzzleZ);
      c.arm.localToWorld(out);
    }
    return out;
  }

  L.Mech86 = { build, update, fire, FEMUR, TIBIA, HIP_H };
})(window.LEGO = window.LEGO || {});
