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
  // 실물 레고 시티의 벽은 흰/크림이 많다. 색은 벽이 아니라 '지붕·차양·간판·탈것'에서 온다.
  // 그래서 벽은 차분하게 두고 액센트를 따로 뽑아 쓴다.
  const TOWER_COLORS = [C.white, C.tan, C.sandBlue, C.lightGray, C.white, C.azure];
  const ACCENTS = [C.red, C.azure, C.yellow, C.green, C.orange, C.darkRed, C.blue];
  const ROOF_COLORS = [C.darkRed, C.red, C.darkBlue, C.green, C.brown];

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
      if (r < 0.44) return 'house';
      if (r < 0.64) return 'park';
      if (r < 0.78) return 'apartment';
      if (r < 0.90) return 'garage';
      if (r < 0.97) return 'market';
      return 'construction';       // 크레인은 높아서 멀리서도 다 보인다 — 3% 로 억제
    }
    if (r < 0.38) return 'farm';
    if (r < 0.68) return 'park';
    if (r < 0.88) return 'house';
    if (r < 0.97) return 'garage';
    return 'construction';
  }

  // ------------------------------------------------------------- 공용 소품
  function tree(ctx, x, z, s) {
    const b = ctx.solid;
    W.pushCyl(b, x, 0.55 + 1.6 * s, z, 0.5 * s, 3.2 * s, C.brown);
    W.pushCone(b, x, 0.55 + 3.9 * s, z, 2.6 * s, 3.6 * s, C.green);
    W.pushCone(b, x, 0.55 + 5.6 * s, z, 2.0 * s, 3.2 * s, C.brightGreen);
    W.pushCone(b, x, 0.55 + 7.2 * s, z, 1.3 * s, 2.4 * s, C.lime);
    W.collide(ctx, x, z, 0.9 * s, 0.9 * s);
  }

  /** 상점 차양 — 레퍼런스 사진의 줄무늬 차양. 거리 눈높이에 색을 넣는 가장 싼 방법. */
  function awning(ctx, x, z, w, color, ry) {
    const b = ctx.solid;
    W.pushBox(b, x, 0.55 + 3.4, z, w, 0.4, 2.6, color, ry);
    W.pushBox(b, x, 0.55 + 3.0, z, w, 0.5, 0.4, C.white, ry);
  }

  /** 신호등 — 교차로마다 하나. 사진 속 도시의 대표적 실루엣. */
  function trafficLight(ctx, x, z) {
    const b = ctx.solid;
    W.pushBox(b, x, 0.55 + 0.3, z, 1.6, 0.6, 1.6, C.darkGray);
    W.pushCyl(b, x, 0.55 + 3.4, z, 0.22, 6.2, C.darkGray);
    W.pushBox(b, x, 0.55 + 6.0, z, 1.2, 3.0, 1.0, C.black);
    W.pushBox(b, x, 0.55 + 7.0, z + 0.55, 0.7, 0.7, 0.2, C.red);
    W.pushBox(b, x, 0.55 + 6.1, z + 0.55, 0.7, 0.7, 0.2, C.yellow);
    W.pushBox(b, x, 0.55 + 5.2, z + 0.55, 0.7, 0.7, 0.2, C.brightGreen);
    W.collide(ctx, x, z, 0.8, 0.8);
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

  /**
   * 시민 — 정적 병합본. 레고 시티 사진의 밀도감은 미니피그에서 나온다.
   * minifig.js 의 완전한 모델은 동적 객체용이라 여기서는 실루엣만 저비용으로 세운다.
   */
  const SHIRT = [C.red, C.azure, C.yellow, C.brightGreen, C.orange, C.white, C.purple, C.blue];
  const PANTS = [C.darkBlue, C.black, C.brown, C.darkGray, C.reddishBrown];
  function citizen(ctx, x, z, rand, ry) {
    const b = ctx.solid;
    const y = 0.55;
    W.pushBox(b, x, y + 0.55, z, 0.85, 1.1, 0.6, R.pick(rand, PANTS), ry);   // 다리
    W.pushBox(b, x, y + 1.6, z, 1.0, 1.1, 0.65, R.pick(rand, SHIRT), ry);    // 몸통
    W.pushBox(b, x, y + 2.45, z, 0.85, 0.7, 0.75, C.flesh, ry);              // 머리
    W.pushBox(b, x, y + 2.9, z, 0.9, 0.3, 0.85, R.pick(rand, PANTS), ry);    // 머리카락
  }

  /** 인도 가장자리에 시민 몇 명 — 부지 유형과 무관하게 거리를 채운다. */
  function sidewalkLife(ctx, cx, cz, size, rand, n) {
    for (let i = 0; i < n; i++) {
      const edge = (rand() * 4) | 0;
      const t = R.range(rand, -size / 2 + 4, size / 2 - 4);
      const off = size / 2 - 2.2;
      const x = edge === 0 ? cx + t : (edge === 1 ? cx + t : (edge === 2 ? cx - off : cx + off));
      const z = edge === 0 ? cz - off : (edge === 1 ? cz + off : cz + t);
      citizen(ctx, x, z, rand, R.range(rand, 0, Math.PI * 2));
    }
  }

  function parkedCar(ctx, x, z, ry, color) {
    const b = ctx.solid;
    W.pushBox(b, x, 1.35, z, 5.6, 1.4, 2.6, color, ry);          // 차체
    W.pushBox(b, x - 0.3, 2.45, z, 3.0, 1.3, 2.35, C.glass, ry); // 캐빈
    W.pushBox(b, x, 0.72, z, 5.2, 0.5, 2.9, C.black, ry);        // 바퀴축
    W.collide(ctx, x, z, 2.8, 1.4);
  }

  /** 길가 주차 — 도로변에 색을 넣는 가장 싼 방법. */
  const CAR_COLORS = [C.red, C.azure, C.white, C.yellow, C.green, C.orange, C.black];
  function streetParking(ctx, cx, cz, size, rand, n) {
    for (let i = 0; i < n; i++) {
      const alongZ = R.chance(rand, 0.5);
      const t = R.range(rand, -size / 2 + 5, size / 2 - 5);
      const off = size / 2 + 4.5;
      const sign = R.chance(rand, 0.5) ? 1 : -1;
      const x = alongZ ? cx + off * sign : cx + t;
      const z = alongZ ? cz + t : cz + off * sign;
      parkedCar(ctx, x, z, alongZ ? 0 : Math.PI / 2, R.pick(rand, CAR_COLORS));
    }
  }

  // ------------------------------------------------------------- 부지 생성기
  function downtown(ctx, cx, cz, size, rand) {
    const b = ctx.solid, g = ctx.glass;
    const floors = R.irange(rand, 5, 14);
    const w = R.range(rand, size * 0.5, size * 0.72);
    const d = R.range(rand, size * 0.5, size * 0.72);
    const col = R.pick(rand, TOWER_COLORS);
    const fh = 3.2, H = floors * fh;
    // 층마다 슬래브를 쌓으면 팬케이크처럼 처마가 튀어나온다.
    // 몸통은 한 덩어리로 세우고 창만 띠로 두른다 — 보기도 낫고 삼각형도 절반이다.
    W.pushBox(b, cx, 0.55 + 0.4, cz, w + 2.4, 0.8, d + 2.4, C.darkGray);   // 기단
    W.pushBox(b, cx, 0.95 + H / 2, cz, w, H, d, col);                      // 몸통
    for (let i = 0; i < floors; i++) {
      W.pushBox(g, cx, 0.95 + i * fh + fh * 0.62, cz, w + 0.3, fh * 0.44, d + 0.3, C.glass);
    }
    // 파라펫·옥탑은 액센트 색 — 스카이라인에 색을 넣는다
    const acc = R.pick(rand, ACCENTS);
    W.pushBox(b, cx, 0.95 + H + 0.35, cz, w + 0.8, 0.7, d + 0.8, acc);        // 파라펫
    W.pushBox(b, cx, 0.95 + H + 1.4, cz, w * 0.45, 1.4, d * 0.45, C.lightGray); // 옥탑
    // 1층 상점 전면 + 차양 — 눈높이에 색이 있어야 거리가 살아난다
    W.pushBox(b, cx, 0.95 + 1.6, cz + d / 2, w * 0.78, 3.2, 0.5, acc);
    awning(ctx, cx, cz + d / 2 + 1.4, w * 0.7, acc, 0);
    W.collide(ctx, cx, cz, w / 2 + 0.6, d / 2 + 0.6);
    if (R.chance(rand, 0.5)) lamp(ctx, cx + size / 2 - 2, cz - size / 2 + 2);
  }

  function apartment(ctx, cx, cz, size, rand) {
    const b = ctx.solid, g = ctx.glass;
    const floors = R.irange(rand, 3, 6);
    const w = size * 0.7, d = size * 0.46, fh = 3.4;
    const col = R.pick(rand, HOUSE_COLORS);
    const H = floors * fh;
    W.pushBox(b, cx, 0.95 + H / 2, cz, w, H, d, col);                      // 몸통
    for (let i = 0; i < floors; i++) {                                     // 앞면 창
      W.pushBox(g, cx, 0.95 + i * fh + fh * 0.6, cz + d * 0.5, w * 0.86, fh * 0.42, 0.3, C.glass);
    }
    W.pushBox(b, cx, 0.95 + H + 0.35, cz, w + 1.2, 0.7, d + 1.2, C.darkRed);  // 처마
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
      W.pushCone(b, hx, 0.55 + 5.6, cz, w * 0.82, 2.6, R.pick(rand, ROOF_COLORS));  // 지붕
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

  const STREET = { trafficLight, awning, lamp, tree, citizen, parkedCar };

  const GEN = {
    downtown, apartment, house, park, market, plaza, playground,
    police, fire, school, construction, garage, farm, harbor, beach,
  };

  // 화면에 그대로 뜨는 구역 이름 — 아이가 '지금 어디'인지 항상 알 수 있어야 한다(SPEC 10장)
  const LABELS = {
    downtown: '도심', apartment: '아파트 단지', house: '주택가', park: '공원',
    market: '시장', plaza: '중앙 광장', playground: '놀이터', police: '경찰서',
    fire: '소방서', school: '학교', construction: '공사장', garage: '자동차 정비소',
    farm: '농장', harbor: '항구', beach: '바닷가',
  };

  function labelAt(seed, lotX, lotZ) {
    return LABELS[typeAt(seed, lotX, lotZ)] || '브릭 시티';
  }

  // 거리 생활 밀도 — 도심일수록 붐빈다
  const LIFE = {
    downtown: [3, 2], plaza: [4, 0], market: [4, 1], apartment: [2, 2],
    house: [1, 1], school: [3, 1], police: [1, 2], fire: [1, 1],
    playground: [2, 0], park: [1, 0], garage: [1, 0],
  };

  function fillLot(ctx, type, cx, cz, size, lotX, lotZ, seed) {
    const fn = GEN[type] || park;
    fn(ctx, cx, cz, size, ctx.rand);
    const life = LIFE[type];
    if (life) {
      if (life[0]) sidewalkLife(ctx, cx, cz, size, ctx.rand, life[0]);
      if (life[1]) streetParking(ctx, cx, cz, size, ctx.rand, life[1]);
    }
  }

  L.Districts = { typeAt, labelAt, fillLot, STREET, LANDMARKS, LABELS, TYPES: Object.keys(GEN) };
})(window.LEGO);
