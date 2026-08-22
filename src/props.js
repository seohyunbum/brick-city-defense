/* =========================================================================
 * props.js — 구역을 채우는 야외 소품 (도시 밖 생활감)
 *
 * YUNU 사냥터 브랜치(places.js)의 소품을 이 저장소의 렌더 방식으로 옮긴 것이다.
 * 원본은 소품마다 THREE.Mesh 를 개별 생성해 부모에 붙였는데, 그러면 소품 하나가
 * 드로우콜 수십 개가 된다. 여기서는 districts.js 와 똑같이 W.push* 로 청크 배치에
 * 병합해 넣는다 — 삼각형만 늘고 드로우콜은 늘지 않는다.
 *
 * 규칙
 *   · 순수 팩토리. 씬에 직접 넣지 않고 ctx 배치에만 쌓는다.
 *   · 색은 bricks.js 팔레트(C)만 쓴다. 자유 RGB 금지(CLAUDE.md 4장).
 *   · 사람·동물 형상 금지. 허수아비는 지푸라기 인형이라 허용된다(아동안전 5장).
 *   · 부피가 있어 몸으로 부딪히는 것만 collide 를 등록한다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const W = L.WorldDraw;
  const Y = 0.55;      // 인도 높이 — districts.js 소품과 같은 기준면

  /** 모닥불 — 돌 테두리 + 눕힌 장작 + 반투명 불꽃 */
  function campfire(ctx, x, z) {
    const b = ctx.solid;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      W.pushBox(b, x + Math.cos(a) * 2.2, Y + 0.35, z + Math.sin(a) * 2.2,
        1.1, 0.7, 1.1, i % 2 ? C.darkGray : C.lightGray, a);
    }
    for (let i = 0; i < 4; i++) {
      W.pushCylRot(b, x, Y + 0.5 + i * 0.15, z, 0.34, 3.2, C.weatheredWood,
        Math.PI / 2 - 0.25, i * 0.8, 0);
    }
    // 불꽃은 유리(반투명) 채널로 — 실제 광원을 쓰지 않고도 타는 느낌이 난다
    for (let i = 0; i < 4; i++) {
      W.pushCone(ctx.glass, x + Math.cos(i * 1.3) * 0.5, Y + 1.4 + i * 0.35,
        z + Math.sin(i * 1.3) * 0.5, 0.7 - i * 0.09, 1.8 + i * 0.4,
        i % 2 ? C.fire : C.ember);
    }
    W.collide(ctx, x, z, 1.6, 1.6);
  }

  /** 삼각 텐트 — 야영지 */
  function tent(ctx, x, z, color, ry) {
    const b = ctx.solid;
    const cloth = color === undefined ? C.red : color;
    for (const side of [-1, 1]) {
      W.pushBoxRot(b, x + side * 2.1, Y + 2.6, z, 0.35, 6.5, 8, cloth, 0, ry || 0, side * 0.62);
    }
    W.pushCylRot(b, x, Y + 5.1, z, 0.16, 8.4, C.darkWood, Math.PI / 2, ry || 0, 0);
    W.pushBox(b, x, Y + 2.5, z - 4.0, 6.6, 5.0, 0.3, C.darkRed, ry);
    for (const sx of [-1, 1]) {
      W.pushBox(b, x + sx * 4.2, Y + 0.6, z + 3.4, 0.25, 1.2, 0.25, C.darkWood, ry);
    }
    W.collide(ctx, x, z, 2.4, 4.2);
  }

  /** 허수아비 — 밭을 지킨다. 지푸라기 인형이라 사람 형상 금지에 걸리지 않는다. */
  function scarecrow(ctx, x, z) {
    const b = ctx.solid;
    W.pushBox(b, x, Y + 4, z, 0.6, 8, 0.6, C.weatheredWood);
    W.pushBoxRot(b, x, Y + 6.0, z, 7, 0.5, 0.5, C.weatheredWood, 0, 0, 0.06);
    W.pushBox(b, x, Y + 5.2, z, 2.6, 3.2, 1.4, C.burlap);
    W.pushSph(b, x, Y + 7.4, z, 1.1, C.hay);
    W.pushCyl(b, x, Y + 8.5, z, 0.85, 1.4, C.darkWood);            // 모자
    W.pushCyl(b, x, Y + 8.0, z, 2.1, 0.16, C.darkWood);            // 챙
    for (let i = 0; i < 5; i++) {
      W.pushBoxRot(b, x + (i - 2) * 0.5, Y + 3.6, z + 0.3, 0.2, 1.4, 0.2, C.hay,
        0.2 * (i - 2), 0, 0.1 * (i - 2));
    }
    W.collide(ctx, x, z, 0.8, 0.8);
  }

  /** 건초 더미 — 눕힌 원통 */
  function hayBale(ctx, x, z, ry) {
    const b = ctx.solid;
    W.pushCylRot(b, x, Y + 1.7, z, 1.7, 3.0, C.hay, 0, ry || 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      W.pushCylRot(b, x + (i - 1) * 0.9, Y + 1.7, z, 1.75, 0.16, C.hayBand, 0, ry || 0, Math.PI / 2);
    }
    W.collide(ctx, x, z, 1.8, 1.8);
  }

  /** 우물 — 돌 테두리 + 지붕 + 두레박 */
  function well(ctx, x, z) {
    const b = ctx.solid;
    W.pushCyl(b, x, Y + 1.1, z, 2.4, 2.2, C.darkGray);
    W.pushCyl(b, x, Y + 1.25, z, 1.8, 2.3, C.black);               // 안쪽 어둠
    for (const sx of [-1, 1]) {
      W.pushBox(b, x + sx * 2.0, Y + 3.5, z, 0.5, 5, 0.5, C.weatheredWood);
      W.pushBoxRot(b, x + sx * 1.3, Y + 6.1, z, 3.4, 0.35, 5.6, C.plank, 0, 0, sx * 0.5);
    }
    W.pushCylRot(b, x, Y + 5.0, z, 0.22, 4.4, C.darkWood, 0, 0, Math.PI / 2);
    W.pushCyl(b, x, Y + 2.4, z, 0.65, 1.0, C.weatheredWood);       // 두레박
    W.collide(ctx, x, z, 2.5, 2.5);
  }

  /** 나무 상자 */
  function crate(ctx, x, z, s, ry) {
    const b = ctx.solid;
    const k = s || 1;
    W.pushBox(b, x, Y + 1.1 * k, z, 2.2 * k, 2.2 * k, 2.2 * k, C.plank, ry);
    W.pushBox(b, x, Y + 1.1 * k, z, 2.3 * k, 0.25 * k, 0.25 * k, C.darkWood, ry);
    W.pushBox(b, x, Y + 1.1 * k, z, 0.25 * k, 0.25 * k, 2.3 * k, C.darkWood, ry);
    W.collide(ctx, x, z, 1.2 * k, 1.2 * k);
  }

  /** 드럼통 */
  function barrel(ctx, x, z, s, color) {
    const b = ctx.solid;
    const k = s || 1;
    W.pushCyl(b, x, Y + 1.3 * k, z, 0.95 * k, 2.6 * k, color === undefined ? C.weatheredWood : color);
    for (const y of [0.6, 2.0]) {
      W.pushCyl(b, x, Y + y * k, z, 1.05 * k, 0.2 * k, C.darkGray);
    }
    W.collide(ctx, x, z, 1.0 * k, 1.0 * k);
  }

  /** 나무 망루 — 멀리서도 보이는 이정표 겸 전망대 */
  function watchtower(ctx, x, z) {
    const b = ctx.solid;
    const H = 16;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        W.pushBox(b, x + sx * 3.4, Y + H / 2, z + sz * 3.4, 1.0, H, 1.0, C.darkWood);
      }
    }
    for (let i = 1; i <= 3; i++) {
      W.pushBox(b, x, Y + i * 4.2, z - 3.4, 7.6, 0.5, 0.5, C.weatheredWood);
      W.pushBox(b, x + 3.4, Y + i * 4.2, z, 0.5, 0.5, 7.6, C.weatheredWood);
    }
    W.pushBox(b, x, Y + H, z, 9.5, 0.7, 9.5, C.plank);
    for (const sx of [-1, 1]) {
      W.pushBox(b, x, Y + H + 1.2, z + sx * 4.5, 9.5, 1.4, 0.4, C.weatheredWood);
      W.pushBox(b, x + sx * 4.5, Y + H + 1.2, z, 0.4, 1.4, 9.5, C.weatheredWood);
      W.pushBox(b, x + sx * 4.0, Y + H + 2.4, z, 0.5, 4.2, 0.5, C.darkWood);
      W.pushBoxRot(b, x + sx * 2.6, Y + H + 5.2, z, 6.4, 0.4, 11, C.plank, 0, 0, sx * 0.5);
    }
    for (let i = 0; i < 8; i++) {                                   // 사다리 발판
      W.pushBox(b, x, Y + 1.6 + i * 1.8, z + 4.6, 2.4, 0.22, 0.22, C.weatheredWood);
    }
    W.collide(ctx, x, z, 4.0, 4.0);
  }

  /** 종탑 — 광장의 소리 랜드마크 */
  function bellTower(ctx, x, z) {
    const b = ctx.solid;
    W.pushBox(b, x, Y + 0.6, z, 7, 1.2, 7, C.lightGray);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        W.pushBox(b, x + sx * 2.6, Y + 5, z + sz * 2.6, 0.8, 8, 0.8, C.darkWood);
      }
      W.pushBoxRot(b, x + sx * 1.8, Y + 10.4, z, 4.6, 0.5, 8, C.darkRed, 0, 0, sx * 0.55);
    }
    W.pushCyl(b, x, Y + 7.6, z, 1.4, 2.2, C.gold);                 // 종
    W.pushCyl(b, x, Y + 6.5, z, 1.6, 0.3, C.gold);
    W.pushCylRot(b, x, Y + 8.9, z, 0.2, 3.6, C.darkWood, 0, 0, Math.PI / 2);
    W.collide(ctx, x, z, 3.2, 3.2);
  }

  /** 나무 울타리 한 칸 */
  function fence(ctx, x, z, len, ry) {
    const b = ctx.solid;
    const posts = Math.max(2, Math.round(len / 3));
    for (let i = 0; i < posts; i++) {
      const t = (i / (posts - 1) - 0.5) * len;
      W.pushBoxRot(b, x + Math.cos(ry || 0) * t, Y + 1.6, z + Math.sin(ry || 0) * t,
        0.42, 3.2, 0.42, C.weatheredWood, 0, ry || 0, ((i * 37) % 7 - 3) * 0.04);
    }
    for (const y of [1.0, 2.3]) {
      W.pushBox(b, x, Y + y, z, len, 0.3, 0.28, C.plank, ry);
    }
  }

  /** 호박 — 밭 작물 */
  function pumpkin(ctx, x, z, s) {
    const b = ctx.solid;
    const k = s || 1;
    W.pushSph(b, x, Y + 0.95 * k, z, 1.15 * k, C.orange);
    W.pushCyl(b, x, Y + 1.9 * k, z, 0.24 * k, 0.7 * k, C.moss);
  }

  L.Props = { campfire, tent, scarecrow, hayBale, well, crate, barrel, watchtower, bellTower, fence, pumpkin };
})(window.LEGO);
