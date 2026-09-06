/* =========================================================================
 * mech-weapons.js — 86호기에 붙는 무장: 브릭 칼 · 기관총 예광탄 (순수 팩토리 + 갱신)
 *
 * 칼은 몸통 왼쪽 어깨의 팔에 매달린 큰 브릭 검이다. 휘두르기는 세 박자로 나뉜다.
 *   준비(뒤로 젖힘) → 베기(빠르게) → 회수(천천히)
 * 애니메이션에서 무게를 만드는 것은 이 "준비"와 "회수"의 시간 차다.
 *
 * 기관총은 mech86 의 스터드 발사기 두 문을 그대로 쓰고, 여기서는 눈에 보이는
 * 예광탄만 풀링해 그린다. 프레임마다 새 객체를 만들지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const M = L.Motion;
  const Cel = L.Cel;

  const IDLE = -2.05;         // 접어 둔 칼의 어깨 각(몸 옆으로 붙는다)
  const READY = -2.6;         // 뒤로 젖힌 각(머리 위로 들어올린다)
  const SLASH = 1.45;         // 베어 낸 각 — 팔이 앞으로 뻗어 칼이 시야를 가로지른다
  const SWING_TIME = 0.72;    // 한 번 휘두르는 데 걸리는 시간
  const HIT_FROM = 0.20;      // 실제로 맞는 구간(초)
  const HIT_TO = 0.34;

  /**
   * 무장을 붙인다. mech 는 mech86.build() 결과.
   * @returns {object} rig
   */
  function attach(mech, scene, opts) {
    const o = opts || {};
    const chassis = mech.userData.rig.chassis;

    // ----- 왼쪽 어깨 팔 + 브릭 칼
    // 어깨는 조종석 눈높이 근처에 둔다 — 1인칭에서 칼이 시야를 가로지르며 지나가야
    // "내가 휘둘렀다"가 읽힌다(몸통 아래에 달면 화면 밖에서만 움직인다).
    const shoulder = new THREE.Group();
    shoulder.position.set(-2.15, 4.1, -2.1);
    chassis.add(shoulder);
    const upper = new THREE.Mesh(L.roundedBox(1.0, 1.9, 1.0, 0.16, 2), Cel.toon(C.darkBlue));
    upper.position.y = -0.8;
    upper.castShadow = true;
    shoulder.add(upper);

    const hand = new THREE.Group();
    hand.position.y = -1.7;
    shoulder.add(hand);
    const grip = new THREE.Mesh(L.cyl(0.34, 0.34, 1.1, 10), Cel.toon(C.cineScrapDark));
    grip.rotation.z = Math.PI / 2;
    hand.add(grip);
    // 칼: 손잡이 → 가드 → 길게 뻗은 날. 날 끝을 살짝 좁혀 방향이 읽히게.
    const guard = new THREE.Mesh(L.box(0.5, 0.4, 2.2), Cel.toon(C.gold));
    guard.position.y = -0.5;
    hand.add(guard);
    const blade = new THREE.Mesh(L.roundedBox(0.46, 5.6, 1.6, 0.12, 1), Cel.toon(C.silver));
    blade.position.y = -3.3;
    blade.castShadow = true;
    hand.add(blade);
    const tip = new THREE.Mesh(L.cyl(0.05, 0.78, 1.5, 4), Cel.toon(C.silver));
    tip.position.y = -6.85;
    tip.rotation.y = Math.PI / 4;
    tip.scale.z = 0.28;
    hand.add(tip);
    // 베는 순간에만 켜지는 칼날 빛(반복 점멸 아님 — 휘두를 때 한 번)
    const edge = new THREE.Mesh(L.box(0.18, 5.6, 1.8), Cel.glow(C.cineRim, 0.75));
    edge.position.y = -3.3;
    edge.visible = false;
    edge.userData.noOutline = true;
    hand.add(edge);

    Cel.outline(shoulder, 0.05);
    shoulder.rotation.x = IDLE;

    // ----- 예광탄 풀 (기관총)
    const tracerCount = o.tracers === undefined ? 14 : o.tracers;
    const tracers = new THREE.InstancedMesh(L.cyl(0.16, 0.16, 1.9, 6), Cel.glow(C.yellow), tracerCount);
    tracers.frustumCulled = false;
    scene.add(tracers);

    const rig = {
      shoulder, hand, blade, edge,
      swing: -1,                       // <0 = 쉬는 중, 아니면 진행 시간(초)
      swingAngle: new M.Spring(IDLE, 5.5, 0.8),
      hitOpen: false,
      tracers,
      tracerCount,
      _from: new Float32Array(tracerCount * 3),
      _to: new Float32Array(tracerCount * 3),
      _life: new Float32Array(tracerCount),
      _cursor: 0,
      _m: new THREE.Matrix4(),
      _q: new THREE.Quaternion(),
      _p: new THREE.Vector3(),
      _d: new THREE.Vector3(),
      _s: new THREE.Vector3(1, 1, 1),
      _zero: new THREE.Vector3(),
      _up: new THREE.Vector3(0, 1, 0),
    };
    hideTracers(rig);
    return rig;
  }

  function hideTracers(rig) {
    for (let i = 0; i < rig.tracerCount; i++) {
      rig._life[i] = 0;
      rig._m.compose(rig._zero, rig._q.identity(), rig._zero);
      rig.tracers.setMatrixAt(i, rig._m);
    }
    rig.tracers.instanceMatrix.needsUpdate = true;
  }

  /** 칼 휘두르기 시작. 이미 휘두르는 중이면 무시한다. */
  function startSwing(rig) {
    if (rig.swing >= 0) return false;
    rig.swing = 0;
    rig.hitOpen = false;
    return true;
  }

  /** 지금이 칼이 실제로 닿는 구간인가 */
  function swingHits(rig) {
    return rig.swing >= HIT_FROM && rig.swing <= HIT_TO;
  }

  /** 예광탄 한 발 — 총구에서 목표점까지 짧게 보이고 사라진다 */
  function addTracer(rig, from, to) {
    const i = rig._cursor;
    rig._cursor = (rig._cursor + 1) % rig.tracerCount;
    const k = i * 3;
    rig._from[k] = from.x; rig._from[k + 1] = from.y; rig._from[k + 2] = from.z;
    rig._to[k] = to.x; rig._to[k + 1] = to.y; rig._to[k + 2] = to.z;
    rig._life[i] = 0.075;
  }

  function update(rig, dt) {
    // ----- 칼: 준비 → 베기 → 회수
    let target = IDLE;
    if (rig.swing >= 0) {
      rig.swing += dt;
      const t = rig.swing;
      if (t < HIT_FROM) target = M.lerp(IDLE, READY, M.Ease.outQuad(t / HIT_FROM));
      else if (t < HIT_TO) target = M.lerp(READY, SLASH, M.Ease.inQuad((t - HIT_FROM) / (HIT_TO - HIT_FROM)));
      else target = M.lerp(SLASH, IDLE, M.Ease.inOutCubic(Math.min(1, (t - HIT_TO) / (SWING_TIME - HIT_TO))));
      if (t >= SWING_TIME) rig.swing = -1;
    }
    // 스프링을 거쳐 각도를 따라가므로 멈출 때 살짝 지나갔다 돌아온다
    rig.shoulder.rotation.x = rig.swingAngle.update(target, dt);
    rig.edge.visible = swingHits(rig);

    // ----- 예광탄: 남은 수명만큼 총구→목표 사이에 눕혀 그린다
    let alive = 0;
    for (let i = 0; i < rig.tracerCount; i++) {
      if (rig._life[i] <= 0) continue;
      rig._life[i] -= dt;
      const k = i * 3;
      if (rig._life[i] <= 0) {
        rig._m.compose(rig._zero, rig._q.identity(), rig._zero);
      } else {
        alive++;
        rig._p.set(
          (rig._from[k] + rig._to[k]) * 0.5,
          (rig._from[k + 1] + rig._to[k + 1]) * 0.5,
          (rig._from[k + 2] + rig._to[k + 2]) * 0.5
        );
        rig._d.set(rig._to[k] - rig._from[k], rig._to[k + 1] - rig._from[k + 1], rig._to[k + 2] - rig._from[k + 2]);
        const len = rig._d.length() || 1;
        rig._d.multiplyScalar(1 / len);
        rig._q.setFromUnitVectors(rig._up, rig._d);
        rig._s.set(1, Math.min(len, 26), 1);
        rig._m.compose(rig._p, rig._q, rig._s);
      }
      rig.tracers.setMatrixAt(i, rig._m);
    }
    if (alive || rig._dirty) rig.tracers.instanceMatrix.needsUpdate = true;
    rig._dirty = alive > 0;
  }

  function reset(rig) {
    rig.swing = -1;
    rig.swingAngle.set(IDLE);
    rig.shoulder.rotation.x = IDLE;
    rig.edge.visible = false;
    hideTracers(rig);
  }

  L.MechWeapons = { attach, startSwing, swingHits, addTracer, update, reset, SWING_TIME };
})(window.LEGO = window.LEGO || {});
