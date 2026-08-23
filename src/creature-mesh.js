/* =========================================================================
 * creature-mesh.js — 브릭 생물 모양 공장 (순수 팩토리, 부수효과 금지)
 *
 * 왜 병합하나: 생물 한 마리를 enemies.js 처럼 개별 Mesh 30 개로 지으면
 * 한 마리가 드로우콜 30 이다. 여섯 마리면 예산(650)의 4분의 1 을 생물이 먹는다.
 * 여기서는 geo-merge 로 **몸통 1 + 팔다리 2** = 마리당 드로우콜 3 으로 굽는다.
 * 색은 정점 색으로 실려 팔레트가 달라도 재질 하나(브릭 플라스틱)를 공유한다.
 *
 * 좌표 규약
 *   · 1 unit = 스터드 1칸. 발바닥이 y = 0. 앞은 +Z (enemies.js 와 같다).
 *   · 팔다리 지오메트리는 **회전축(pivot) 기준 좌표**로 굽는다. 그래서 Mesh 를
 *     pivot 위치에 놓고 rotation.x 만 흔들면 걷는 모양이 된다.
 *
 * 색은 bricks.js COLORS 팔레트만 쓴다(CLAUDE.md 4장 하드룰).
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler();

  // 브릭 무늬 한 칸이 부품보다 크면 돌기가 뭉개진다 — 면마다 최소 1칸으로 올린다
  function faceUVof(w, h, d) {
    const r = (v) => Math.max(1, Math.round(v));
    const uX = [r(d), r(h)];
    const uY = [r(w), r(d)];
    const uZ = [r(w), r(h)];
    return [uX, uX, uY, uY, uZ, uZ];
  }

  const G = { box: null, cyl: null, cone: null, sph: null };
  function geos() {
    if (!G.box) {
      G.box = new THREE.BoxGeometry(1, 1, 1);
      G.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
      G.cone = new THREE.ConeGeometry(0.5, 1, 7);
      G.sph = new THREE.SphereGeometry(0.5, 8, 6);
    }
    return G;
  }

  /** 박스 한 개 (rx, ry, rz 회전 가능) */
  function box(b, x, y, z, w, h, d, color, rx, ry, rz) {
    _p.set(x, y, z);
    _s.set(w, h, d);
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    b.add(geos().box, _m, color, { faceUV: faceUVof(w, h, d) });
  }

  function round(b, geo, x, y, z, sx, sy, sz, color, rx, ry, rz) {
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    b.add(geo, _m, color, { uv: [1, 1] });
  }

  function cyl(b, x, y, z, r, h, color, rx, ry, rz) {
    round(b, geos().cyl, x, y, z, r * 2, h, r * 2, color, rx, ry, rz);
  }

  function cone(b, x, y, z, r, h, color, rx, ry, rz) {
    round(b, geos().cone, x, y, z, r * 2, h, r * 2, color, rx, ry, rz);
  }

  function sph(b, x, y, z, r, color) {
    round(b, geos().sph, x, y, z, r * 2, r * 2, r * 2, color);
  }

  /** 눈 — 앞을 보는 원통 흰자 + 작은 검은 동자. 브릭 장난감 얼굴의 핵심. */
  function eyes(b, y, z, spread, r) {
    for (let side = -1; side <= 1; side += 2) {
      cyl(b, side * spread, y, z, r, 0.22, C.white, Math.PI / 2, 0, 0);
      box(b, side * spread, y, z + 0.16, r * 0.7, r * 0.7, 0.12, C.black);
    }
  }

  /** 웃는 입 — 작은 판 하나. 무생물처럼 보이지 않게 하는 최소 표정. */
  function smile(b, y, z, w, color) {
    box(b, 0, y, z, w, 0.24, 0.14, color);
  }

  // ------------------------------------------------------------------ 머리 장식
  function crest(b, kind, y, z, sp) {
    if (kind === 'horn') {
      for (let s = -1; s <= 1; s += 2) cone(b, s * 0.42, y + 0.4, z, 0.26, 0.9, sp.trim, -0.2, 0, s * 0.3);
    } else if (kind === 'ear') {
      for (let s = -1; s <= 1; s += 2) box(b, s * 0.62, y + 0.5, z, 0.5, 1.1, 0.34, sp.trim, 0, 0, s * 0.34);
    } else if (kind === 'fin') {
      box(b, 0, y + 0.45, z, 0.26, 1.0, 1.5, sp.accent, -0.12, 0, 0);
    } else if (kind === 'antenna') {
      for (let s = -1; s <= 1; s += 2) {
        cyl(b, s * 0.34, y + 0.5, z, 0.09, 1.0, sp.trim, 0, 0, s * 0.22);
        sph(b, s * 0.46, y + 1.0, z, 0.22, sp.accent);
      }
    } else if (kind === 'spike') {
      for (let i = 0; i < 3; i++) cone(b, 0, y + 0.34, z - i * 0.8, 0.24 - i * 0.04, 0.8 - i * 0.12, sp.trim);
    } else if (kind === 'leaf') {
      for (let s = -1; s <= 1; s += 2) box(b, s * 0.5, y + 0.5, z - 0.1, 1.1, 0.2, 0.62, sp.trim, 0, s * 0.3, s * 0.5);
    } else if (kind === 'ring') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        box(b, Math.cos(a) * 0.85, y + 0.75, z + Math.sin(a) * 0.85, 0.3, 0.24, 0.3, sp.trim, 0, -a, 0);
      }
    }
  }

  // ------------------------------------------------------------------ 꼬리
  function tail(b, kind, y, z, sp) {
    if (kind === 'flame') {
      for (let i = 0; i < 3; i++) {
        cone(b, 0, y + 0.3 + i * 0.55, z - 0.5 - i * 0.2, 0.4 - i * 0.09, 0.9 - i * 0.15,
          i === 2 ? sp.trim : sp.accent);
      }
    } else if (kind === 'long') {
      for (let i = 0; i < 4; i++) {
        box(b, 0, y + i * 0.28, z - 0.7 - i * 0.7, 0.7 - i * 0.11, 0.6 - i * 0.09, 0.8,
          i % 2 ? sp.accent : sp.body, 0.24, 0, 0);
      }
    } else if (kind === 'stub') {
      box(b, 0, y, z - 0.8, 0.8, 0.8, 0.9, sp.accent, 0.2, 0, 0);
    } else if (kind === 'fork') {
      for (let s = -1; s <= 1; s += 2) cone(b, s * 0.35, y + 0.3, z - 1.1, 0.22, 1.2, sp.trim, 1.2, 0, s * 0.4);
    } else if (kind === 'fan') {
      for (let i = -1; i <= 1; i++) {
        box(b, i * 0.55, y, z - 1.1, 0.5, 0.22, 1.5, i ? sp.accent : sp.trim, 0, i * 0.34, 0);
      }
    }
  }

  /** 단계 표식 — 크기 말고도 한눈에 구분되게 등에 무늬를 얹는다 */
  function stageMark(b, stage, y, z, w, sp) {
    if (stage >= 2) box(b, 0, y, z, w * 0.5, 0.2, w * 0.9, sp.trim);
    if (stage >= 3) {
      for (let s = -1; s <= 1; s += 2) box(b, s * (w * 0.5), y - 0.2, z, 0.5, 0.5, w * 0.7, sp.trim);
    }
  }

  // ------------------------------------------------------------------ 몸 구성 6종
  /** 뭉치 — 판을 쌓아 올린 통통한 몸. 폴짝폴짝 뛴다. */
  function planBlob(sp, out) {
    const b = out.body;
    box(b, 0, 0.75, 0, 3.0, 1.5, 3.0, sp.accent);
    box(b, 0, 2.05, 0, 2.5, 1.3, 2.5, sp.body);
    box(b, 0, 3.05, 0, 1.8, 1.0, 1.8, sp.body);
    eyes(b, 2.4, 1.28, 0.6, 0.3);
    smile(b, 1.85, 1.3, 0.9, sp.trim);
    stageMark(b, sp.stage, 3.6, -0.2, 1.6, sp);
    crest(b, sp.crest, 3.4, 0, sp);
    tail(b, sp.tail, 1.5, -1.4, sp);
    // 발 두 짝 — 좌우가 번갈아 움직인다
    for (const pair of [[out.limbA, -1], [out.limbB, 1]]) {
      box(pair[0], pair[1] * 0.85, -0.3, 0.1, 0.9, 0.6, 1.3, sp.trim);
    }
    out.pivotA.set(0, 0.6, 0);
    out.pivotB.set(0, 0.6, 0);
    out.height = 4.2;
    out.radius = 1.7;
    out.gait = 'hop';
  }

  /** 네발 — 대각선 두 짝이 짝지어 움직이는 걸음(실제 네발 걸음) */
  function planQuad(sp, out) {
    const b = out.body;
    box(b, 0, 2.3, 0, 2.6, 1.8, 3.6, sp.body);
    box(b, 0, 3.3, -0.2, 2.0, 0.5, 2.6, sp.accent);
    box(b, 0, 2.9, 1.9, 1.3, 1.3, 1.0, sp.body);
    box(b, 0, 3.5, 2.7, 1.7, 1.5, 1.6, sp.body);
    box(b, 0, 3.1, 3.5, 1.0, 0.8, 0.7, sp.accent);
    eyes(b, 3.8, 3.3, 0.55, 0.28);
    smile(b, 3.0, 3.75, 0.7, sp.trim);
    stageMark(b, sp.stage, 3.7, -0.4, 1.8, sp);
    crest(b, sp.crest, 4.2, 2.5, sp);
    tail(b, sp.tail, 2.4, -1.8, sp);
    // 대각선 짝 — A = 왼앞 + 오른뒤, B = 오른앞 + 왼뒤
    const leg = (target, x, z) => box(target, x, -0.85, z, 0.72, 1.7, 0.72, sp.trim);
    leg(out.limbA, -0.95, 1.25);
    leg(out.limbA, 0.95, -1.25);
    leg(out.limbB, 0.95, 1.25);
    leg(out.limbB, -0.95, -1.25);
    out.pivotA.set(0, 1.5, 0);
    out.pivotB.set(0, 1.5, 0);
    out.height = 4.6;
    out.radius = 1.9;
    out.gait = 'walk';
  }

  /** 두발 — 팔다리가 서로 반대로 흔들린다 */
  function planBiped(sp, out) {
    const b = out.body;
    box(b, 0, 3.6, 0, 2.4, 2.4, 1.9, sp.body);
    box(b, 0, 3.9, 1.05, 1.7, 1.1, 0.4, sp.accent);
    box(b, 0, 5.3, 0.1, 2.0, 1.7, 1.8, sp.body);
    eyes(b, 5.5, 1.05, 0.6, 0.3);
    smile(b, 4.85, 1.05, 0.9, sp.trim);
    stageMark(b, sp.stage, 4.9, -1.0, 1.9, sp);
    crest(b, sp.crest, 6.1, 0, sp);
    tail(b, sp.tail, 3.0, -1.1, sp);
    // 다리 한 짝 + 반대쪽 팔을 같은 회전축에 묶는다(사람 걸음)
    const side = (target, s) => {
      box(target, s * 0.62, -1.0, 0, 0.85, 2.0, 0.95, sp.trim);
      box(target, -s * 1.5, 1.55, 0, 0.62, 1.8, 0.62, sp.accent);
    };
    side(out.limbA, -1);
    side(out.limbB, 1);
    out.pivotA.set(0, 2.3, 0);
    out.pivotB.set(0, 2.3, 0);
    out.height = 6.5;
    out.radius = 1.8;
    out.gait = 'walk';
  }

  /** 날개 — 공중에 떠서 날개를 젓는다 */
  function planWing(sp, out) {
    const b = out.body;
    box(b, 0, 0, 0, 1.9, 1.6, 2.7, sp.body);
    box(b, 0, 0.45, 1.75, 1.4, 1.2, 1.2, sp.accent);
    eyes(b, 0.55, 2.3, 0.45, 0.26);
    smile(b, 0.0, 2.3, 0.6, sp.trim);
    stageMark(b, sp.stage, 0.9, -0.4, 1.3, sp);
    crest(b, sp.crest, 1.0, 1.6, sp);
    tail(b, sp.tail, -0.1, -1.3, sp);
    for (const pair of [[out.limbA, -1], [out.limbB, 1]]) {
      box(pair[0], pair[1] * 1.7, 0.1, 0, 3.2, 0.3, 2.1, sp.accent);
      box(pair[0], pair[1] * 3.1, 0.1, -0.2, 1.2, 0.26, 1.3, sp.trim);
    }
    out.pivotA.set(0, 0.45, 0);
    out.pivotB.set(0, 0.45, 0);
    out.height = 2.4;
    out.radius = 1.7;
    out.gait = 'flap';
    out.hover = 6.5;
  }

  /** 뱀 — 마디가 길게 이어지고 옆지느러미를 젓는다 */
  function planSerpent(sp, out) {
    const b = out.body;
    for (let i = 0; i < 5; i++) {
      box(b, 0, 1.3 + Math.sin(i * 0.9) * 0.3, 1.1 - i * 1.15,
        1.9 - i * 0.16, 1.5 - i * 0.14, 1.2, i % 2 ? sp.accent : sp.body);
    }
    box(b, 0, 1.7, 2.35, 1.7, 1.4, 1.7, sp.body);
    eyes(b, 1.85, 3.1, 0.5, 0.28);
    smile(b, 1.25, 3.15, 0.8, sp.trim);
    stageMark(b, sp.stage, 2.3, 0.6, 1.5, sp);
    crest(b, sp.crest, 2.4, 2.2, sp);
    tail(b, sp.tail, 1.2, -4.4, sp);
    for (const pair of [[out.limbA, -1], [out.limbB, 1]]) {
      box(pair[0], pair[1] * 1.1, 0, 0, 1.5, 0.28, 1.2, sp.trim, 0, 0, pair[1] * 0.3);
    }
    out.pivotA.set(0, 1.4, 0.6);
    out.pivotB.set(0, 1.4, 0.6);
    out.height = 3.0;
    out.radius = 1.6;
    out.gait = 'flap';
    out.hover = 1.6;
  }

  /** 구슬 — 떠 있는 공 + 도는 브릭 고리 */
  function planOrb(sp, out) {
    const b = out.body;
    sph(b, 0, 0, 0, 1.15, sp.body);
    box(b, 0, -0.95, 0, 1.3, 0.5, 1.3, sp.accent);
    eyes(b, 0.2, 1.0, 0.42, 0.26);
    smile(b, -0.35, 1.05, 0.6, sp.trim);
    stageMark(b, sp.stage, 1.1, -0.3, 1.0, sp);
    crest(b, sp.crest, 0.9, 0, sp);
    tail(b, sp.tail, -0.2, -1.0, sp);
    // 고리는 눕혀 돌고, 위성은 세워 돈다
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(out.limbA, Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75, 0.42, 0.34, 0.42, sp.accent, 0, -a, 0);
    }
    for (let s = -1; s <= 1; s += 2) sph(out.limbB, s * 1.5, 0.7, 0, 0.34, sp.trim);
    out.pivotA.set(0, 0, 0);
    out.pivotB.set(0, 0, 0);
    out.height = 2.4;
    out.radius = 1.5;
    out.gait = 'spin';
    out.hover = 5.5;
  }

  const PLANS = {
    blob: planBlob, quad: planQuad, biped: planBiped,
    wing: planWing, serpent: planSerpent, orb: planOrb,
  };

  let sharedMaterial = null;
  /** 모든 생물이 공유하는 브릭 플라스틱 재질 하나 (정점 색 + 돌기 무늬) */
  function material() {
    if (!sharedMaterial) sharedMaterial = L.Merge.brickMaterial('tile');
    return sharedMaterial;
  }

  /**
   * 한 종의 지오메트리를 굽는다. 종마다 한 번만 부르고 결과를 재사용한다
   * (프레임 안에서 부르면 안 된다 — companions.js 가 부팅 때 전부 굽는다).
   * @returns {{body:THREE.BufferGeometry, limbA:?THREE.BufferGeometry, limbB:?THREE.BufferGeometry,
   *            pivotA:THREE.Vector3, pivotB:THREE.Vector3, height:number, radius:number,
   *            gait:string, hover:number}}
   */
  function build(species) {
    const plan = PLANS[species.plan] || planBlob;
    const out = {
      body: L.Merge.builder(),
      limbA: L.Merge.builder(),
      limbB: L.Merge.builder(),
      pivotA: new THREE.Vector3(),
      pivotB: new THREE.Vector3(),
      height: 4,
      radius: 1.6,
      gait: 'hop',
      hover: 0,
    };
    plan(species, out);
    out.body = out.body.build();
    out.limbA = out.limbA.build();
    out.limbB = out.limbB.build();
    return out;
  }

  L.CreatureMesh = { build, material, PLANS: Object.keys(PLANS) };
})(window.LEGO);
