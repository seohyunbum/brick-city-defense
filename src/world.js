/* =========================================================================
 * world.js — 청크 스트리밍 오픈월드 (city.js 복도를 대체한다)
 *
 * 1.x: 54 × 148 복도 하나, 개별 .add() 114회, 드로우콜 467~499.
 * 2.x: 2048 × 2048 도시, 청크 128, 청크당 정적 메시 2개(불투명 + 유리).
 *      근접 7×7=49 청크 유지 → 정적 드로우콜 98 내외. (GAME_DESIGN_SPEC §3·§7)
 *
 * 도로는 월드 좌표 64 배수마다 깔린다. 청크 하나에 도로 격자 2×2, 부지(lot) 4개.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  const CHUNK = 128;          // 청크 한 변
  const HALF_CHUNKS = 8;      // 16 × 16 청크
  const WORLD_HALF = CHUNK * HALF_CHUNKS;   // 1024 → 월드 2048
  const LOT = 64;             // 도로 간격 = 부지 한 변
  const ROAD_HALF = 13;       // 1.x 도로 반폭 계승
  const CURB_Y = 0.55;        // 1.x 인도 높이 계승
  const VIEW_RADIUS = 3;      // 유지 반경(체비셰프) → (2r+1)^2 = 49 청크

  // 공용 단위 지오메트리 — 전부 행렬로 변형해 병합한다(매번 new 금지, CLAUDE.md §2)
  let G = null;
  function geos() {
    if (G) return G;
    G = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
      sph: new THREE.SphereGeometry(0.5, 8, 6),
    };
    return G;
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler();

  /** 축정렬 박스를 병합 대기열에 넣는다. 스터드 배율은 크기에 비례시킨다. */
  function pushBox(b, cx, cy, cz, w, h, d, color, ry) {
    _p.set(cx, cy, cz);
    _s.set(w, h, d);
    _e.set(0, ry || 0, 0);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    b.add(geos().box, _m, color, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
  }

  function pushCyl(b, cx, cy, cz, r, h, color) {
    _p.set(cx, cy, cz); _s.set(r * 2, h, r * 2); _q.identity();
    _m.compose(_p, _q, _s);
    b.add(geos().cyl, _m, color, 1, 1);
  }

  function pushCone(b, cx, cy, cz, r, h, color) {
    _p.set(cx, cy, cz); _s.set(r * 2, h, r * 2); _q.identity();
    _m.compose(_p, _q, _s);
    b.add(geos().cone, _m, color, 1, 1);
  }

  function pushSph(b, cx, cy, cz, r, color) {
    _p.set(cx, cy, cz); _s.set(r * 2, r * 2, r * 2); _q.identity();
    _m.compose(_p, _q, _s);
    b.add(geos().sph, _m, color, 1, 1);
  }

  /** 충돌 AABB 등록 — resolveCollision(city.js) 과 같은 형식 */
  function collide(ctx, x, z, hx, hz) {
    ctx.colliders.push({ x, z, hx, hz });
  }

  L.WORLD_CONST = { CHUNK, HALF_CHUNKS, WORLD_HALF, LOT, ROAD_HALF, CURB_Y, VIEW_RADIUS };
  L.WorldDraw = { pushBox, pushCyl, pushCone, pushSph, collide, geos };

  // ------------------------------------------------------------- 청크 포장
  /** 아스팔트 바닥 + 부지 인도. 도로는 64 배수 좌표에 깔린다. */
  function paveChunk(ctx, ox, oz) {
    // 청크 전체 아스팔트 한 장 — 교차로 겹침·z-fighting 을 원천 차단한다
    pushBox(ctx.solid, ox + CHUNK / 2, -0.05, oz + CHUNK / 2, CHUNK, 0.1, CHUNK, C.darkGray);

    for (let lx = 0; lx < 2; lx++) {
      for (let lz = 0; lz < 2; lz++) {
        const cx = ox + lx * LOT + LOT / 2;
        const cz = oz + lz * LOT + LOT / 2;
        const w = LOT - ROAD_HALF * 2;      // 38
        // 인도(연회색) — 도로보다 CURB_Y 만큼 높다
        pushBox(ctx.solid, cx, CURB_Y / 2, cz, w, CURB_Y, w, C.lightGray);
      }
    }
  }

  /** 차선 중앙선 — 도로 위 얇은 흰 띠. 시각적 방향 단서. */
  function laneMarks(ctx, ox, oz) {
    for (let i = 0; i < 2; i++) {
      const rx = ox + i * LOT;
      const rz = oz + i * LOT;
      for (let t = 8; t < CHUNK; t += 32) {
        pushBox(ctx.solid, rx, 0.02, oz + t, 1.1, 0.06, 7, C.white);
        pushBox(ctx.solid, ox + t, 0.02, rz, 7, 0.06, 1.1, C.white);
      }
    }
  }

  // ------------------------------------------------------------- 청크 생성
  function buildChunk(seed, cx, cz) {
    const rand = L.RNG.chunkRng(seed, cx, cz);
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const ctx = {
      solid: L.Merge.builder(),
      glass: L.Merge.builder(),
      colliders: [],
      rand,
    };

    paveChunk(ctx, ox, oz);
    laneMarks(ctx, ox, oz);

    for (let lx = 0; lx < 2; lx++) {
      for (let lz = 0; lz < 2; lz++) {
        const lotX = cx * 2 + lx, lotZ = cz * 2 + lz;
        const centerX = ox + lx * LOT + LOT / 2;
        const centerZ = oz + lz * LOT + LOT / 2;
        const type = L.Districts.typeAt(seed, lotX, lotZ);
        L.Districts.fillLot(ctx, type, centerX, centerZ, LOT - ROAD_HALF * 2, lotX, lotZ, seed);
      }
    }

    const group = new THREE.Group();
    const solidGeo = ctx.solid.build();
    if (solidGeo) {
      const mesh = new THREE.Mesh(solidGeo, mats().solid);
      mesh.castShadow = false; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    const glassGeo = ctx.glass.build();
    if (glassGeo) {
      const mesh = new THREE.Mesh(glassGeo, mats().glass);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    group.matrixAutoUpdate = false;
    group.updateMatrix();

    return { group, colliders: ctx.colliders, cx, cz };
  }

  // ------------------------------------------------------------- 환경
  let MATS = null;

  /** 재질은 지연 생성한다 — 계측 하네스가 create() 없이 청크만 만들 수 있게. */
  function mats() {
    if (!MATS) MATS = makeMaterials();
    return MATS;
  }

  function makeMaterials() {
    return {
      solid: L.Merge.material({ shininess: 38 }),
      glass: new THREE.MeshPhongMaterial({
        vertexColors: true, transparent: true, opacity: 0.55,
        shininess: 110, specular: new THREE.Color(0x6f8ea8),
      }),
    };
  }

  /** 하늘 돔 + 바다. 월드 경계는 벽이 아니라 물로 닫는다(GAME_DESIGN_SPEC §3). */
  function environment(scene) {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 256;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0.00, '#1f7fd0');
    grd.addColorStop(0.45, '#61b0e4');
    grd.addColorStop(0.80, '#a9d9f0');
    grd.addColorStop(1.00, '#dceff8');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;

    // 반경은 카메라 far(game.js: 900) 안이어야 한다. 밖이면 통째로 클리핑돼 하늘이 검게 나온다.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(720, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    sky.matrixAutoUpdate = false; sky.updateMatrix();
    scene.add(sky);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshPhongMaterial({ color: 0x2f7fb5, shininess: 80, specular: 0x88bcd8 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -1.2;
    sea.matrixAutoUpdate = false; sea.updateMatrix();
    scene.add(sea);

    scene.fog = new THREE.Fog(0xa9d9f0, CHUNK * 2.2, CHUNK * (VIEW_RADIUS + 1.1));
    return { sky, sea, tex };
  }

  // ------------------------------------------------------------- 매니저
  function create(scene, opts) {
    opts = opts || {};
    const seed = (opts.seed >>> 0) || 20260821;
    mats();
    const env = environment(scene);

    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    scene.add(root);

    const chunks = new Map();
    const pending = [];
    let lastCX = null, lastCZ = null;
    let nearColliders = [];
    let nearKey = '';

    const inWorld = (cx, cz) =>
      cx >= -HALF_CHUNKS && cx < HALF_CHUNKS && cz >= -HALF_CHUNKS && cz < HALF_CHUNKS;
    const key = (cx, cz) => cx + ':' + cz;

    function disposeChunk(c) {
      root.remove(c.group);
      for (let i = 0; i < c.group.children.length; i++) {
        const m = c.group.children[i];
        if (m.geometry) m.geometry.dispose();
      }
      c.group.clear();
    }

    /** 프레임당 생성 상한 — 넓은 월드에서 이동 시 히칭을 막는다. */
    function drain(budget) {
      let made = 0;
      while (pending.length && made < budget) {
        const job = pending.shift();
        if (chunks.has(job.k) || !inWorld(job.cx, job.cz)) continue;
        const c = buildChunk(seed, job.cx, job.cz);
        chunks.set(job.k, c);
        root.add(c.group);
        nearKey = '';          // 콜라이더 캐시 무효화 — 새 청크 반영
        made++;
      }
      return made;
    }

    /** 플레이어 위치 기준으로 유지 반경 안을 채우고 밖을 해제한다. */
    function update(px, pz, budget) {
      const pcx = Math.floor(px / CHUNK);
      const pcz = Math.floor(pz / CHUNK);

      if (pcx !== lastCX || pcz !== lastCZ) {
        lastCX = pcx; lastCZ = pcz;
        pending.length = 0;

        for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
          for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
            const cx = pcx + dx, cz = pcz + dz;
            if (!inWorld(cx, cz)) continue;
            const k = key(cx, cz);
            if (chunks.has(k)) continue;
            pending.push({ k, cx, cz, d: Math.abs(dx) + Math.abs(dz) });
          }
        }
        pending.sort((a, b) => a.d - b.d);   // 가까운 청크 먼저

        chunks.forEach((c, k) => {
          if (Math.abs(c.cx - pcx) > VIEW_RADIUS || Math.abs(c.cz - pcz) > VIEW_RADIUS) {
            disposeChunk(c);
            chunks.delete(k);
            nearKey = '';      // 콜라이더 캐시 무효화 — 해제 반영
          }
        });
      }

      // 하늘·바다는 플레이어를 따라다닌다(유한 반경이라 고정하면 가장자리가 드러난다)
      env.sky.position.set(px, 0, pz); env.sky.updateMatrix(); env.sky.updateMatrixWorld(true);
      env.sea.position.set(px, -1.2, pz); env.sea.updateMatrix(); env.sea.updateMatrixWorld(true);

      // 첫 진입은 즉시 다 채우고(빈 화면 방지), 이후에는 프레임당 소량만
      drain(budget === undefined ? 2 : budget);
    }

    /** 즉시 전부 채운다 — 시작·순간이동 직후 빈 도시를 보여주지 않기 위해. */
    function prime(px, pz) {
      update(px, pz, 0);
      drain(pending.length);
    }

    /** 충돌 검사는 플레이어 주변 3×3 청크로만 — 전 월드 순회를 막는다. */
    function collidersNear(x, z) {
      const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
      const k = pcx + ':' + pcz;
      if (k !== nearKey) {
        nearKey = k;
        nearColliders = [];
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const c = chunks.get(key(pcx + dx, pcz + dz));
            if (!c) continue;
            for (let i = 0; i < c.colliders.length; i++) nearColliders.push(c.colliders[i]);
          }
        }
      }
      return nearColliders;
    }

    /** 월드 밖(바다)으로 나가지 않게 해안선에서 멈춘다. */
    function clamp(pos) {
      const lim = WORLD_HALF - 6;
      if (pos.x < -lim) pos.x = -lim; else if (pos.x > lim) pos.x = lim;
      if (pos.z < -lim) pos.z = -lim; else if (pos.z > lim) pos.z = lim;
    }

    /**
     * 좌표가 속한 부지의 구역 이름. 부지가 바뀔 때만 다시 계산한다.
     * game.js 는 지휘자라 이런 월드 조회를 들고 있지 않는다(CLAUDE.md 2장).
     */
    let _lotX = null, _lotZ = null, _label = '브릭 시티';
    function districtLabel(x, z) {
      const lx = Math.floor(x / LOT), lz = Math.floor(z / LOT);
      if (lx !== _lotX || lz !== _lotZ) {
        _lotX = lx; _lotZ = lz;
        _label = L.Districts.labelAt(seed, lx, lz);
      }
      return _label;
    }

    function stats() {
      let meshes = 0, tris = 0;
      chunks.forEach((c) => {
        for (let i = 0; i < c.group.children.length; i++) {
          const g = c.group.children[i].geometry;
          if (!g) continue;
          meshes++;
          const p = g.getAttribute('position');
          if (p) tris += p.count / 3;
        }
      });
      return { chunks: chunks.size, meshes, tris: Math.round(tris), pending: pending.length };
    }

    function dispose() {
      chunks.forEach((c) => disposeChunk(c));
      chunks.clear();
      scene.remove(root);
      scene.remove(env.sky); scene.remove(env.sea);
      env.sky.geometry.dispose(); env.sky.material.dispose(); env.tex.dispose();
      env.sea.geometry.dispose(); env.sea.material.dispose();
      MATS.solid.dispose(); MATS.glass.dispose();
      scene.fog = null;
    }

    /**
     * 시작 지점 — 좌표를 손으로 고르지 않고 실제 콜라이더로 검증한다.
     * 부지 중앙에는 건물·분수가 서므로 거기서 시작하면 충돌로 밀려난다.
     * 중앙 광장 주변을 나선형으로 훑어 여유가 확보된 첫 지점을 쓴다.
     */
    let _spawn = null;
    function spawnPoint() {
      if (_spawn) return _spawn;
      const cx = LOT / 2, cz = LOT / 2;    // 중앙 광장 부지
      const c = chunks.get(key(0, 0)) || buildChunk(seed, 0, 0);
      const cols = c.colliders;
      const NEED = 3.0;                    // 플레이어 반지름 2.0 + 여유
      let best = { x: cx, z: cz, gap: -Infinity };
      for (let ring = 0; ring <= 5 && best.gap < NEED; ring++) {
        const r = ring * 4.5;
        const steps = ring === 0 ? 1 : ring * 8;
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          let gap = Infinity;
          for (let k = 0; k < cols.length; k++) {
            const o = cols[k];
            const dx = Math.abs(x - o.x) - o.hx;
            const dz = Math.abs(z - o.z) - o.hz;
            const d = Math.max(dx, dz);    // AABB 바깥 거리(음수면 내부)
            if (d < gap) gap = d;
          }
          if (gap > best.gap) best = { x, z, gap };
          if (gap >= NEED) break;
        }
      }
      // 광장 중심을 등지고 바깥(열린 길)을 보게 한다.
      // 중심을 바라보게 하면 처음 W 를 누르자마자 분수에 막힌다 — 아이 기준으로 나쁜 첫 경험.
      // yaw 규약: 앞 = (-sin(yaw), -cos(yaw))  (game.js updatePlayer 참조)
      const yaw = Math.atan2(-(best.x - cx), -(best.z - cz));
      _spawn = { x: best.x, z: best.z, yaw, clearance: best.gap };
      return _spawn;
    }

    return {
      seed, root, update, prime, collidersNear, clamp, stats, dispose, spawnPoint, districtLabel,
      // city.js 호환 표면 — enemies.js·objectives.js 가 기대하는 모양을 유지한다.
      // npcs 는 시민 스트리밍이 붙기 전까지 비어 있다(빈 배열에서 양쪽 모두 안전).
      npcs: [],
      anim: {},
      bounds: { minX: -WORLD_HALF, maxX: WORLD_HALF, minZ: -WORLD_HALF, maxZ: WORLD_HALF },
      curbY: CURB_Y,
      invalidate: function () { nearKey = ''; },
      chunkCount: function () { return chunks.size; },
    };
  }

  /**
   * AABB 목록에 대한 원(반지름 r) 밀어내기 — 새 객체 생성 없음.
   * city.js 에 있던 것을 그대로 옮겨왔다(city.js 는 더 이상 로드하지 않는다).
   */
  function resolveCollision(pos, r, colliders) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const ox = c.hx + r - Math.abs(dx);
      const oz = c.hz + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) pos.x += dx >= 0 ? ox : -ox;
        else pos.z += dz >= 0 ? oz : -oz;
      }
    }
  }

  L.resolveCollision = resolveCollision;
  L.World = { create, buildChunk };   // buildChunk 는 예산 계측 하네스용 seam
})(window.LEGO);
