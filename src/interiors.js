/* =========================================================================
 * interiors.js — 걸어 들어갈 수 있는 건물 껍데기
 *
 * 지금까지 건물은 통짜 박스 하나 + 발자국 전체를 막는 충돌 상자 하나였다.
 * 현관문은 그려져 있었지만 장식이었다 — 앞을 막고 있으니 들어갈 수가 없었다.
 *
 * 여기서는 벽을 네 조각으로 세우고 조각마다 충돌 상자를 따로 넣는다.
 * 문 자리에는 충돌 상자를 넣지 않는다 → 문으로만 드나들 수 있다.
 *
 * 높이 규약: 플레이어 눈높이가 4.6 이라 문 상인방(lintel)은 6.0 위에 있어야
 * 시야가 벽을 넘지 않는다. 그래서 진입 가능 건물의 최소 높이는 8.0 이다.
 * (기존 주택 4.4 는 플레이어보다 낮아서 애초에 들어갈 수 있는 크기가 아니었다)
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const W = L.WorldDraw;
  const Y = 0.55;        // 인도 높이
  const T = 1.0;         // 벽 두께
  // 문 폭 — 플레이어 반지름이 2.0 이라 폭 5.0 이면 통로가 1.0 밖에 안 남는다.
  // 아이가 벽에 끼지 않고 걸어 들어가려면 최소 6.0 은 있어야 한다.
  const DOOR_W = 6.0;
  const DOOR_H = 6.0;    // 상인방 아래 높이 (눈높이 4.6 보다 높게)

  /**
   * 건물 껍데기 — 바닥·천장·벽 네 면(앞면에 문 구멍).
   * 문은 항상 +z(길 쪽)에 낸다. 축정렬만 지원한다 — 충돌이 AABB 라서다.
   *
   * @param {number} h 처마 아래 높이. 8.0 미만이면 들어갈 수 없다.
   * @param {object} o { wall, floor, ceil, doorW, sign, contents }
   */
  function shell(ctx, cx, cz, w, d, h, o) {
    o = o || {};
    const b = ctx.solid;
    const wall = o.wall || C.white;
    const doorW = o.doorW || DOOR_W;
    const hw = w / 2, hd = d / 2;

    // 바닥 — 실내가 인도보다 살짝 높다(문턱)
    W.pushBox(b, cx, Y + 0.1, cz, w, 0.2, d, o.floor || C.lightGray);

    // 뒷벽 · 좌우벽 (창문은 파사드 채널이 그린다)
    W.pushWall(b, cx, Y + h / 2, cz - hd + T / 2, w, h, T, wall);
    W.collide(ctx, cx, cz - hd + T / 2, hw, T / 2);
    for (const sx of [-1, 1]) {
      W.pushWall(b, cx + sx * (hw - T / 2), Y + h / 2, cz, T, h, d - T * 2, wall);
      W.collide(ctx, cx + sx * (hw - T / 2), cz, T / 2, hd - T);
    }

    // 앞벽 — 문 구멍 양옆 조각 + 상인방. 구멍에는 충돌을 넣지 않는다.
    const segW = (w - doorW) / 2;
    if (segW > 0.2) {
      for (const sx of [-1, 1]) {
        const px = cx + sx * (doorW / 2 + segW / 2);
        W.pushWall(b, px, Y + h / 2, cz + hd - T / 2, segW, h, T, wall);
        W.collide(ctx, px, cz + hd - T / 2, segW / 2, T / 2);
      }
    }
    W.pushWall(b, cx, Y + DOOR_H + (h - DOOR_H) / 2, cz + hd - T / 2, doorW, h - DOOR_H, T, wall);
    // 문틀 — 어디로 들어가는지 눈에 보이게
    for (const sx of [-1, 1]) {
      W.pushBox(b, cx + sx * (doorW / 2 + 0.2), Y + DOOR_H / 2, cz + hd, 0.4, DOOR_H, 0.5, C.brown);
    }
    W.pushBox(b, cx, Y + DOOR_H + 0.25, cz + hd, doorW + 1.0, 0.5, 0.5, C.brown);

    // 천장 + 실내등
    W.pushBox(b, cx, Y + h + 0.3, cz, w, 0.6, d, o.ceil || C.lightGray);
    W.pushBox(b, cx, Y + h - 0.25, cz, w * 0.3, 0.2, d * 0.3, C.lookWarm);

    // 실내 판정 볼륨 — 벽 안쪽만
    W.room(ctx, cx, cz, hw - T, hd - T, Y + h);

    if (o.contents) o.contents(ctx, cx, cz, w - T * 2, d - T * 2);
    return { doorZ: cz + hd, inner: { hx: hw - T, hz: hd - T } };
  }

  // ------------------------------------------------------------- 실내 살림
  /** 집 — 침대·식탁·의자·선반 */
  function homeRoom(ctx, cx, cz, w, d) {
    const b = ctx.solid;
    W.pushBox(b, cx - w * 0.28, Y + 0.85, cz - d * 0.26, 4.2, 1.1, 6.4, C.azure);      // 침대
    W.pushBox(b, cx - w * 0.28, Y + 1.6, cz - d * 0.42, 4.2, 0.9, 1.2, C.white);       // 베개 쪽
    W.pushBox(b, cx + w * 0.22, Y + 1.5, cz - d * 0.1, 4.6, 0.3, 3.0, C.reddishBrown); // 식탁
    for (const sx of [-1, 1]) {
      W.pushBox(b, cx + w * 0.22 + sx * 2.8, Y + 1.0, cz - d * 0.1, 1.4, 2.0, 1.4, C.brown);
    }
    W.pushBox(b, cx + w * 0.34, Y + 2.4, cz + d * 0.3, 1.0, 4.8, 4.4, C.tan);          // 선반
  }

  /** 경찰서·소방서 — 접수대·사물함 */
  function officeRoom(ctx, cx, cz, w, d, accent) {
    const b = ctx.solid;
    W.pushBox(b, cx, Y + 1.3, cz + d * 0.18, w * 0.62, 2.6, 1.6, C.reddishBrown);      // 접수대
    W.pushBox(b, cx, Y + 2.75, cz + d * 0.18, w * 0.66, 0.3, 2.2, C.tan);
    for (let i = -1; i <= 1; i++) {
      W.pushBox(b, cx + i * 4.2, Y + 2.2, cz - d * 0.36, 3.4, 4.4, 1.6, accent || C.sandBlue);
    }
    W.pushBox(b, cx - w * 0.36, Y + 1.0, cz - d * 0.05, 1.8, 2.0, 1.8, C.brown);       // 의자
  }

  /** 학교 — 칠판과 책상 */
  function classRoom(ctx, cx, cz, w, d) {
    const b = ctx.solid;
    W.pushBox(b, cx, Y + 3.2, cz - d * 0.44, w * 0.7, 3.2, 0.4, C.green);              // 칠판
    for (let r = 0; r < 2; r++) {
      for (let i = -1; i <= 1; i++) {
        W.pushBox(b, cx + i * 4.4, Y + 1.35, cz + r * 4.4 - d * 0.1, 3.2, 0.3, 2.0, C.tan);
        W.pushBox(b, cx + i * 4.4, Y + 0.7, cz + r * 4.4 - d * 0.1 + 1.4, 2.4, 1.4, 1.2, C.azure);
      }
    }
  }

  /** 정비소 — 작업대·타이어·공구함 */
  function workshopRoom(ctx, cx, cz, w, d) {
    const b = ctx.solid;
    W.pushBox(b, cx, Y + 1.4, cz - d * 0.36, w * 0.7, 2.8, 2.0, C.darkGray);           // 작업대
    W.pushBox(b, cx, Y + 2.9, cz - d * 0.36, w * 0.72, 0.3, 2.4, C.lightGray);
    for (let i = 0; i < 3; i++) {
      W.pushCyl(b, cx - w * 0.34, Y + 0.5 + i * 0.9, cz + d * 0.2, 1.6, 0.9, C.black);  // 타이어
    }
    L.Props.crate(ctx, cx + w * 0.3, cz + d * 0.22, 1.0, 0);
    L.Props.barrel(ctx, cx + w * 0.32, cz - d * 0.05, 0.9, C.red);
  }

  // ------------------------------------------------------------- 실내 판정·조명
  const SUN_OUT = 1.62, SUN_IN = 0.34;      // lookdev.js 기본값 / 실내
  const HEMI_OUT = 0.64, HEMI_IN = 1.55;

  /**
   * 실내 여부를 따라가며 조명을 바꾼다.
   * game.js 는 지휘자라 이 규칙을 들고 있지 않는다(CLAUDE.md 2장) — 배선만 한다.
   */
  function tracker(world, lookdev, onEnter) {
    const t = { inside: false };
    function light(inside) {
      lookdev.sun.intensity = inside ? SUN_IN : SUN_OUT;
      lookdev.hemi.intensity = inside ? HEMI_IN : HEMI_OUT;
    }
    t.reset = function () { t.inside = false; light(false); };
    t.update = function (pos) {
      const now = world.indoors(pos.x, pos.z, pos.y);
      if (now === t.inside) return;
      t.inside = now;
      light(now);
      if (now && onEnter) onEnter();
    };
    return t;
  }

  L.Interiors = {
    shell, homeRoom, officeRoom, classRoom, workshopRoom, tracker, DOOR_H, MIN_H: 8.0,
  };
})(window.LEGO);
