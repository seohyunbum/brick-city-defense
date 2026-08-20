/* =========================================================================
 * districts.js — 부지(lot) 단위 도시 콘텐츠 생성기
 *
 * 부지 한 변 38 스터드(도로 격자 64 - 도로폭 26). 청크마다 4개.
 * 삼각형 예산: 49청크 × 4부지 = 196부지로 125,000 tri 를 나눠 쓴다(GAME_DESIGN_SPEC §7).
 * → 부지당 600 tri 내외. box=12tri 기준 프리미티브 40개 안쪽으로 유지한다.
 *
 * 랜드마크는 절차 생성이 아니라 고정 좌표다 — 아이의 방향 기준점이기 때문(§3).
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const W = L.WorldDraw;
  const R = L.RNG;

  // 고정 랜드마크 — 멀리서 보이고 위치가 변하지 않는다
  const LANDMARKS = {
    '0:0': 'plaza',          // 시작 지점 중앙 광장
    '0:-6': 'police',
    '6:0': 'fire',
    '-6:4': 'school',
    '4:8': 'playground',
    '-8:-8': 'construction', // 타워크레인 — 최고 높이 랜드마크
    '12:0': 'harbor',
    '-12:-2': 'harbor',
  };

  const HOUSE_COLORS = [C.red, C.tan, C.brightGreen, C.azure, C.yellow, C.orange, C.white];
  const TOWER_COLORS = [C.sandBlue, C.lightGray, C.white, C.darkBlue, C.silver];

  /** 부지 유형 결정 — 중심에서 멀어질수록 도심 → 주거 → 외곽 → 해안 */
  function typeAt(seed, lotX, lotZ) {
    const fixed = LANDMARKS[lotX + ':' + lotZ];
    if (fixed) return fixed;

    const ring = Math.max(Math.abs(lotX), Math.abs(lotZ));
    if (ring >= 15) return 'beach';
    const rand = R.mulberry32(R.hash2(seed ^ 0x5bf03635, lotX, lotZ));
    const r = rand();

    if (ring <= 3) return r < 0.72 ? 'downtown' : (r < 0.88 ? 'plaza' : 'market');
    if (ring <= 7) {
      if (r < 0.34) return 'downtown';
      if (r < 0.58) return 'apartment';
      if (r < 0.74) return 'market';
      if (r < 0.88) return 'park';
      return 'playground';
    }
    if (ring <= 12) {
      if (r < 0.46) return 'house';
      if (r < 0.66) return 'park';
      if (r < 0.78) return 'apartment';
      if (r < 0.90) return 'garage';
      return 'construction';
    }
    if (r < 0.40) return 'farm';
    if (r < 0.70) return 'park';
    if (r < 0.86) return 'house';
    return 'construction';
  }

  // ------------------------------------------------------------- 공용 소품
  function tree(ctx, x, z, s) {
    const b = ctx.solid;
    W.pushCyl(b, x, 0.55 + 1.6 * s, z, 0.5 * s, 3.2 * s, C.brown);
    W.pushCone(b, x, 0.55 + 4.2 * s, z, 2.4 * s, 4.0 * s, C.green);
    W.pushCone(b, x, 0.55 + 6.4 * s, z, 1.7 * s, 3.0 * s, C.brightGreen);
    W.collide(ctx, x, z, 0.9 * s, 0.9 * s);
  }

  function lamp(ctx, x, z) {
    const b = ctx.solid;
    W.pushCyl(b, x, 0.55 + 3.2, z, 0.26, 6.4, C.darkGray);
    W.pushBox(b, x, 0.55 + 6.5, z, 2.0, 0.5, 0.7, C.darkGray);
    W.pushBox(b, x + 0.85, 0.55 + 6.15, z, 1.1, 0.3, 0.6, C.lookWarm);
  }

  function bench(ctx, x, z, ry) {
    const b = ctx.solid;
    W.pushBox(b, x, 0.55 + 0.9, z, 4.0, 0.35, 1.3, C.reddishBrown, ry);
    W.pushBox(b, x, 0.55 + 1.7, z - 0.5, 4.0, 1.2, 0.3, C.reddishBrown, ry);
  }

  function parkedCar(ctx, x, z, ry, color) {
    const b = ctx.solid;
    W.pushBox(b, x, 1.3, z, 5.6, 1.5, 2.6, color, ry);
    W.pushBox(b, x, 2.5, z, 3.2, 1.3, 2.4, C.glass, ry);
    W.collide(ctx, x, z, 2.8, 1.4);
  }

  // ------------------------------------------------------------- 부지 생성기
  function downtown(ctx, cx, cz, size, rand) {
    const b = ctx.solid, g = ctx.glass;
    const floors = R.irange(rand, 5, 14);
    const w = R.range(rand, size * 0.5, size * 0.72);
    const d = R.range(rand, size * 0.5, size * 0.72);
    const col = R.pick(rand, TOWER_COLORS);
    const fh = 3.2;
    W.pushBox(b, cx, 0.55 + 0.4, cz, w + 2.4, 0.8, d + 2.4, C.darkGray);   // 기단
    for (let i = 0; i < floors; i++) {
      const y = 0.95 + i * fh + fh / 2;
      const shrink = 1 - (i / floors) * R.range(rand, 0, 0.28);
      W.pushBox(b, cx, y, cz, w * shrink, fh * 0.42, d * shrink, col);
      W.pushBox(g, cx, y + fh * 0.32, cz, w * shrink * 0.97, fh * 0.5, d * shrink * 0.97, C.glass);
    }
    W.pushBox(b, cx, 0.95 + floors * fh + 0.5, cz, w * 0.5, 1.0, d * 0.5, C.lightGray);
    W.collide(ctx, cx, cz, w / 2 + 0.6, d / 2 + 0.6);
    if (R.chance(rand, 0.5)) lamp(ctx, cx + size / 2 - 2, cz - size / 2 + 2);
  }

  function apartment(ctx, cx, cz, size, rand) {
    const b = ctx.solid, g = ctx.glass;
    const floors = R.irange(rand, 3, 6);
    const w = size * 0.7, d = size * 0.46, fh = 3.4;
    const col = R.pick(rand, HOUSE_COLORS);
    for (let i = 0; i < floors; i++) {
      const y = 0.95 + i * fh + fh / 2;
      W.pushBox(b, cx, y, cz, w, fh * 0.5, d, col);
      W.pushBox(g, cx, y + fh * 0.3, cz + d * 0.5, w * 0.86, fh * 0.42, 0.3, C.glass);
    }
    W.pushBox(b, cx, 0.95 + floors * fh + 0.35, cz, w + 1.2, 0.7, d + 1.2, C.darkRed);  // 처마
    W.collide(ctx, cx, cz, w / 2 + 0.4, d / 2 + 0.4);
    tree(ctx, cx - size / 2 + 3, cz + size / 2 - 3, 0.8);
  }

  function house(ctx, cx, cz, size, rand) {
    const b = ctx.solid, g = ctx.glass;
    for (let i = 0; i < 2; i++) {
      const hx = cx + (i === 0 ? -size / 4 : size / 4);
      const col = R.pick(rand, HOUSE_COLORS);
      const w = size * 0.36, d = size * 0.4;
      W.pushBox(b, hx, 0.55 + 2.2, cz, w, 4.4, d, col);
      W.pushBox(g, hx, 0.55 + 2.6, cz + d / 2, w * 0.5, 1.6, 0.28, C.glass);
      W.pushCone(b, hx, 0.55 + 5.6, cz, w * 0.82, 2.6, C.darkRed);          // 지붕
      W.pushBox(b, hx + w * 0.3, 0.55 + 6.4, cz, 0.8, 1.6, 0.8, C.lightGray); // 굴뚝
      W.collide(ctx, hx, cz, w / 2, d / 2);
    }
    // 흰 울타리 — 1.x picketFence 의 저비용 대체
    for (let t = -size / 2 + 2; t < size / 2 - 1; t += 3.4) {
      W.pushBox(b, cx + t, 0.55 + 0.8, cz + size / 2 - 1, 0.4, 1.6, 0.4, C.white);
    }
    tree(ctx, cx, cz - size / 2 + 4, 0.9);
  }

  function park(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.brightGreen);      // 잔디
    const n = R.irange(rand, 4, 7);
    for (let i = 0; i < n; i++) {
      tree(ctx, cx + R.range(rand, -size / 2 + 3, size / 2 - 3),
              cz + R.range(rand, -size / 2 + 3, size / 2 - 3), R.range(rand, 0.7, 1.25));
    }
    if (R.chance(rand, 0.6)) {
      W.pushCyl(b, cx, 0.6, cz, size * 0.2, 0.2, C.azure);            // 연못
      bench(ctx, cx + size * 0.28, cz, 0);
    }
    lamp(ctx, cx - size / 2 + 2.5, cz + size / 2 - 2.5);
  }

  function market(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.tan);
    const cols = [C.red, C.yellow, C.azure, C.brightGreen, C.orange];
    for (let i = 0; i < 4; i++) {
      const sx = cx + (i % 2 ? 1 : -1) * size * 0.24;
      const sz = cz + (i < 2 ? -1 : 1) * size * 0.24;
      W.pushBox(b, sx, 0.55 + 1.1, sz, 6.0, 2.2, 4.4, C.reddishBrown);      // 좌판
      W.pushBox(b, sx, 0.55 + 3.4, sz, 7.2, 0.4, 5.4, cols[i % cols.length]); // 차양
      W.pushCyl(b, sx - 3.2, 0.55 + 2.4, sz, 0.2, 4.0, C.darkGray);
      W.pushCyl(b, sx + 3.2, 0.55 + 2.4, sz, 0.2, 4.0, C.darkGray);
      W.collide(ctx, sx, sz, 3.2, 2.4);
    }
  }

  function plaza(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.white);
    W.pushCyl(b, cx, 0.9, cz, size * 0.22, 0.8, C.lightGray);       // 분수 하단
    W.pushCyl(b, cx, 1.6, cz, size * 0.13, 0.9, C.azure);
    W.pushCyl(b, cx, 2.6, cz, 0.5, 1.4, C.lightGray);
    W.pushSph(b, cx, 3.6, cz, 1.0, C.glass);
    W.collide(ctx, cx, cz, size * 0.22, size * 0.22);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      bench(ctx, cx + Math.cos(a) * size * 0.36, cz + Math.sin(a) * size * 0.36, a);
      lamp(ctx, cx + Math.cos(a) * size * 0.45, cz + Math.sin(a) * size * 0.45);
    }
  }

  function playground(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.lime);
    W.pushBox(b, cx - size * 0.2, 0.55 + 0.3, cz, 10, 0.6, 10, C.tan);       // 모래밭
    // 미끄럼틀
    W.pushBox(b, cx + size * 0.22, 0.55 + 1.8, cz - 3, 4.0, 3.6, 4.0, C.red);
    W.pushBox(b, cx + size * 0.22, 0.55 + 2.2, cz + 1.6, 3.0, 0.4, 5.4, C.yellow, 0);
    // 그네
    W.pushCyl(b, cx - 3, 0.55 + 2.2, cz + size * 0.26, 0.24, 4.4, C.azure);
    W.pushCyl(b, cx + 3, 0.55 + 2.2, cz + size * 0.26, 0.24, 4.4, C.azure);
    W.pushBox(b, cx, 0.55 + 4.3, cz + size * 0.26, 7.0, 0.4, 0.4, C.azure);
    W.pushBox(b, cx - 1.6, 0.55 + 2.0, cz + size * 0.26, 1.6, 0.3, 1.0, C.yellow);
    W.pushBox(b, cx + 1.6, 0.55 + 2.0, cz + size * 0.26, 1.6, 0.3, 1.0, C.yellow);
    tree(ctx, cx - size / 2 + 3, cz - size / 2 + 3, 1.0);
  }

  function civic(ctx, cx, cz, size, rand, wall, band, signColor) {
    const b = ctx.solid, g = ctx.glass;
    const w = size * 0.78, d = size * 0.55;
    W.pushBox(b, cx, 0.55 + 3.0, cz, w, 6.0, d, wall);
    W.pushBox(b, cx, 0.55 + 4.6, cz, w + 0.5, 1.2, d + 0.5, band);          // 띠
    W.pushBox(g, cx, 0.55 + 2.4, cz + d / 2, w * 0.7, 2.4, 0.3, C.glass);
    W.pushBox(b, cx, 0.55 + 6.6, cz, w * 0.35, 1.2, d * 0.35, signColor);   // 표지 블록
    W.collide(ctx, cx, cz, w / 2 + 0.4, d / 2 + 0.4);
    lamp(ctx, cx - w / 2 - 2, cz + d / 2 + 2);
    return { w, d };
  }

  function police(ctx, cx, cz, size, rand) {
    civic(ctx, cx, cz, size, rand, C.white, C.blue, C.blue);
    parkedCar(ctx, cx - size * 0.28, cz + size * 0.4, 0, C.blue);
    parkedCar(ctx, cx + size * 0.28, cz + size * 0.4, 0, C.white);
  }

  function fire(ctx, cx, cz, size, rand) {
    civic(ctx, cx, cz, size, rand, C.darkRed, C.white, C.red);
    parkedCar(ctx, cx, cz + size * 0.4, 0, C.red);
  }

  function school(ctx, cx, cz, size, rand) {
    civic(ctx, cx, cz, size, rand, C.tan, C.reddishBrown, C.yellow);
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz - size * 0.36, size * 0.8, 0.12, size * 0.22, C.orange); // 운동장
    tree(ctx, cx - size / 2 + 3, cz - size / 2 + 4, 1.1);
  }

  function construction(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.darkTan);
    // 타워크레인 — 최고 높이 랜드마크(멀리서 방향을 준다)
    const h = R.range(rand, 26, 40);
    W.pushBox(b, cx, 0.55 + 1.0, cz, 5.0, 2.0, 5.0, C.darkGray);
    W.pushBox(b, cx, 0.55 + h / 2 + 2, cz, 1.8, h, 1.8, C.yellow);
    W.pushBox(b, cx + 6, 0.55 + h + 2.6, cz, 22, 1.4, 1.4, C.yellow);      // 지브
    W.pushBox(b, cx - 6, 0.55 + h + 2.6, cz, 8, 1.2, 1.2, C.yellow);       // 카운터지브
    W.pushBox(b, cx - 9.5, 0.55 + h + 2.4, cz, 2.6, 2.2, 2.2, C.darkGray); // 평형추
    W.pushCyl(b, cx + 13, 0.55 + h - 2.0, cz, 0.14, 8.0, C.darkGray);      // 와이어
    W.pushBox(b, cx + 13, 0.55 + h - 6.6, cz, 2.4, 2.0, 2.4, C.orange);    // 자재
    W.collide(ctx, cx, cz, 2.6, 2.6);
    // 자재 더미
    for (let i = 0; i < 3; i++) {
      const px = cx + R.range(rand, -size / 2 + 4, size / 2 - 4);
      const pz = cz + R.range(rand, -size / 2 + 4, size / 2 - 4);
      W.pushBox(b, px, 0.55 + 0.8, pz, 4.0, 1.6, 3.0, R.pick(rand, [C.orange, C.lightGray, C.brown]));
      W.collide(ctx, px, pz, 2.0, 1.5);
    }
  }

  function garage(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.lightGray);
    W.pushBox(b, cx, 0.55 + 2.2, cz - size * 0.26, size * 0.7, 4.4, size * 0.3, C.sandBlue);
    W.pushBox(b, cx, 0.55 + 1.6, cz - size * 0.26 + size * 0.15, size * 0.45, 3.2, 0.3, C.darkGray);
    W.collide(ctx, cx, cz - size * 0.26, size * 0.35, size * 0.15);
    const cols = [C.red, C.azure, C.yellow, C.white, C.green];
    for (let i = 0; i < 3; i++) {
      parkedCar(ctx, cx + (i - 1) * 7.5, cz + size * 0.22, Math.PI / 2, cols[(i + (rand() * 5 | 0)) % cols.length]);
    }
  }

  function farm(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.darkTan);
    // 밭이랑
    const crop = R.pick(rand, [C.lime, C.brightGreen, C.yellow]);
    for (let t = -size / 2 + 3; t < size / 2 - 2; t += 3.2) {
      W.pushBox(b, cx + t, 0.72, cz, 1.8, 0.4, size * 0.62, crop);
    }
    // 헛간
    W.pushBox(b, cx, 0.55 + 2.4, cz - size * 0.34, 11, 4.8, 8, C.darkRed);
    W.pushCone(b, cx, 0.55 + 6.2, cz - size * 0.34, 7.6, 3.0, C.white);
    W.collide(ctx, cx, cz - size * 0.34, 5.5, 4.0);
    tree(ctx, cx + size / 2 - 3, cz + size / 2 - 3, 1.2);
  }

  function harbor(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.58, cz, size, 0.12, size, C.darkGray);
    const cols = [C.red, C.azure, C.yellow, C.green, C.orange];
    for (let i = 0; i < 6; i++) {
      const px = cx + R.range(rand, -size / 2 + 5, size / 2 - 5);
      const pz = cz + R.range(rand, -size / 2 + 4, size / 2 - 4);
      const stack = R.irange(rand, 1, 2);
      for (let s = 0; s < stack; s++) {
        W.pushBox(b, px, 0.55 + 1.4 + s * 2.8, pz, 9.0, 2.7, 4.0, R.pick(rand, cols));
      }
      W.collide(ctx, px, pz, 4.6, 2.1);
    }
    W.pushCyl(b, cx - size * 0.36, 0.55 + 7, cz, 0.9, 14, C.orange);       // 항만 크레인
    W.pushBox(b, cx - size * 0.36 + 5, 0.55 + 13.6, cz, 14, 1.2, 1.2, C.orange);
  }

  function beach(ctx, cx, cz, size, rand) {
    const b = ctx.solid;
    W.pushBox(b, cx, 0.5, cz, size, 0.1, size, C.tan);
    for (let i = 0; i < 3; i++) {
      const px = cx + R.range(rand, -size / 2 + 4, size / 2 - 4);
      const pz = cz + R.range(rand, -size / 2 + 4, size / 2 - 4);
      W.pushCyl(b, px, 0.5 + 2.6, pz, 0.34, 5.2, C.brown);                 // 야자수
      W.pushCone(b, px, 0.5 + 5.6, pz, 3.0, 1.8, C.brightGreen);
    }
  }

  const GEN = {
    downtown, apartment, house, park, market, plaza, playground,
    police, fire, school, construction, garage, farm, harbor, beach,
  };

  function fillLot(ctx, type, cx, cz, size, lotX, lotZ, seed) {
    const fn = GEN[type] || park;
    fn(ctx, cx, cz, size, ctx.rand);
  }

  L.Districts = { typeAt, fillLot, LANDMARKS, TYPES: Object.keys(GEN) };
})(window.LEGO);
