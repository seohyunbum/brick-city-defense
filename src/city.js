/* =========================================================================
 * city.js — 사진 속 레고 시티를 그대로 조립한다
 *
 * 사진 판독 → 배치 규칙(정본):
 *   · 가운데로 뻗은 진회색 아스팔트 도로, 카메라 앞에 흰 횡단보도
 *   · 왼쪽: 초록 잔디 + 흰 울타리 + 소화전 + 검은 신호등 기둥(초록 보행신호) + 빨강/살색 연립주택
 *   · 오른쪽: POLICE 경찰서(흰 벽 + 파란 띠 + 유리창 + 옥상 접시안테나/안테나)
 *   · 도로 위: 빨간 SUV, 파랑/흰 경찰차
 *   · 멀리: 고층빌딩 스카이라인, 노란 타워크레인(자재 매달림), 흰 헬리콥터
 *   · 인도에는 시민 미니피그들 — 지켜야 하는 대상(공격 금지)
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  // 도로/인도 치수 (스터드 단위)
  const ROAD_HALF = 13;      // 도로 반폭
  const WALK_OUT = 19;       // 인도 바깥 경계
  const Z_NEAR = 40;         // 카메라 뒤쪽 끝
  const Z_FAR = -150;        // 도로 끝
  const CURB_Y = 0.55;       // 인도 높이
  const CROSS_Z0 = 14, CROSS_Z1 = 25; // 횡단보도 구간

  function add(scene, mesh, x, y, z, ry) {
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    scene.add(mesh);
    return mesh;
  }

  // --------------------------------------------------------------- 하늘
  function skyDome(scene) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 512;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0.00, '#1f7fd0');
    grd.addColorStop(0.35, '#3f9ede');
    grd.addColorStop(0.70, '#94cdee');
    grd.addColorStop(1.00, '#d8ecf7');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    // 뭉게구름 — 부드러운 흰 덩어리 여러 개
    function puff(cx, cy, r, a) {
      const rg = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      rg.addColorStop(0.6, 'rgba(255,255,255,' + a * 0.55 + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    // 캔버스 v 좌표: 위(y=0)가 천정, 아래가 지평선 아래.
    // 사진처럼 지평선 조금 위(y 130~250)에 뭉게구름을 띄운다.
    const clouds = [
      [120, 170, 62], [168, 156, 46], [78, 182, 40], [205, 176, 30],
      [420, 138, 56], [472, 152, 42], [382, 158, 34], [510, 166, 28],
      [700, 168, 70], [764, 156, 50], [652, 184, 40], [810, 178, 30],
      [930, 132, 54], [982, 148, 40], [886, 152, 30],
      [280, 226, 46], [318, 236, 32], [560, 218, 40], [600, 228, 30],
      [850, 224, 44], [896, 234, 30], [60, 232, 34], [1000, 220, 36],
      [230, 120, 34], [640, 112, 30],
    ];
    for (let i = 0; i < clouds.length; i++) puff(clouds[i][0], clouds[i][1], clouds[i][2], 0.95);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    scene.add(dome);
    return dome;
  }

  // --------------------------------------------------------------- 바닥
  function ground(scene) {
    // 도로(사진처럼 매끈한 진회색 아스팔트 판 — 스터드 없음, 이음선만)
    const road = L.plate(0x33383c, ROAD_HALF * 2, Z_NEAR - Z_FAR, {
      height: 0.5, kind: 'tile', tileScale: 2, finish: 'matte',
    });
    add(scene, road, 0, 0.25, (Z_NEAR + Z_FAR) / 2);

    // 중앙 차선(흰 점선)
    for (let z = Z_NEAR - 6; z > Z_FAR; z -= 12) {
      const dash = L.plate(C.white, 1, 6, { height: 0.12, kind: 'tile', tileScale: 1 });
      add(scene, dash, 0, 0.53, z);
    }

    // 횡단보도(굵은 흰 띠)
    for (let x = -11.5; x <= 11.5; x += 2.9) {
      const stripe = L.plate(C.white, 1.9, CROSS_Z1 - CROSS_Z0, { height: 0.14, kind: 'tile', tileScale: 1 });
      add(scene, stripe, x, 0.55, (CROSS_Z0 + CROSS_Z1) / 2);
    }
    // 횡단보도 앞 정지선
    for (const z of [CROSS_Z1 + 1.6, CROSS_Z0 - 1.6]) {
      const stop = L.plate(C.white, ROAD_HALF, 1.1, { height: 0.13, kind: 'tile', tileScale: 1 });
      add(scene, stop, z > 0 ? -6.5 : 6.5, 0.55, z);
    }

    // 도로 양쪽의 회색 판 띠 — 사진에서 스터드가 깔린 그 부분
    for (const side of [-1, 1]) {
      const lane = L.plate(C.lightGray, 3.2, Z_NEAR - Z_FAR, { height: 0.52 });
      add(scene, lane, side * (ROAD_HALF - 1.6), 0.26, (Z_NEAR + Z_FAR) / 2);
    }

    // 인도(연회색, 살짝 높음)
    for (const side of [-1, 1]) {
      const walk = L.plate(C.lightGray, WALK_OUT - ROAD_HALF, Z_NEAR - Z_FAR, { height: CURB_Y });
      add(scene, walk, side * (ROAD_HALF + (WALK_OUT - ROAD_HALF) / 2), CURB_Y / 2, (Z_NEAR + Z_FAR) / 2);
      // 잔디(초록 스터드 판)
      const grass = L.plate(C.brightGreen, 30, Z_NEAR - Z_FAR, { height: CURB_Y });
      add(scene, grass, side * (WALK_OUT + 15), CURB_Y / 2 - 0.02, (Z_NEAR + Z_FAR) / 2);
    }

    // 플레이어가 서 있는 앞쪽 광장(매끈한 타일 — 사진 맨 앞 회색 타일)
    const plaza = L.plate(C.lightGray, WALK_OUT * 2, 20, { height: CURB_Y, kind: 'tile', tileScale: 1 });
    add(scene, plaza, 0, CURB_Y / 2 + 0.01, Z_NEAR - 10);

    // 아주 먼 곳까지 이어지는 바탕(초록 베이스플레이트)
    const base = L.plate(C.green, 460, 460, { height: 0.4, kind: 'flat', finish: 'matte' });
    add(scene, base, 0, -0.1, -80);
  }

  // --------------------------------------------------------------- 나무
  /**
   * 사진의 나무: 갈색 줄기 + 초록 "잎 판"이 빽빽하게 얹힌 덩어리.
   * 잎은 InstancedMesh 한 개(드로우콜 1)로 심고 두 가지 초록을 섞는다.
   */
  function tree(scene, x, z, scale, colliders) {
    const s = scale || 1;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(L.cyl(0.8 * s, 1.05 * s, 6.4 * s, 10), L.mat(C.brown, 'matte'));
    trunk.position.y = 3.1 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const knob = new THREE.Mesh(L.cyl(0.5 * s, 0.6 * s, 1.2 * s, 8), L.mat(C.reddishBrown, 'matte'));
    knob.position.set(0.7 * s, 4.6 * s, -0.5 * s);
    knob.rotation.z = 0.6;
    g.add(knob);

    // 잎 덩어리: 두 개의 구 껍질에 판을 흩뿌린다
    const leaves = [];
    const shells = [
      { r: 4.4, y: 8.0, n: 26, sz: 2.6 },
      { r: 3.2, y: 10.6, n: 16, sz: 2.2 },
      { r: 2.0, y: 12.2, n: 8, sz: 1.8 },
    ];
    for (let si = 0; si < shells.length; si++) {
      const sh = shells[si];
      for (let i = 0; i < sh.n; i++) {
        // 나선 분포(황금각) — 규칙적이지 않게 퍼진다
        const t = (i + 0.5) / sh.n;
        const phi = Math.acos(1 - 1.35 * t);
        const th = i * 2.39996323;
        const rr = sh.r * (0.82 + (i % 3) * 0.09);
        leaves.push({
          x: Math.sin(phi) * Math.cos(th) * rr,
          y: sh.y + Math.cos(phi) * rr * 0.55,
          z: Math.sin(phi) * Math.sin(th) * rr,
          s: sh.sz * (0.8 + (i % 4) * 0.1),
          ry: th,
          tone: (i + si) % 3,
        });
      }
    }
    const inst = new THREE.InstancedMesh(
      L.box(1, 0.42, 1), L.studAllMaterial(0xffffff, 2), leaves.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const tones = [0x2c6e3a, 0x3f8f43, 0x57a34a];
    for (let i = 0; i < leaves.length; i++) {
      const lf = leaves[i];
      pos.set(lf.x * s, lf.y * s, lf.z * s);
      e.set(0.06 * ((i % 5) - 2), lf.ry, 0.05 * ((i % 3) - 1));
      q.setFromEuler(e);
      sc.set(lf.s * s, (0.9 + (i % 3) * 0.25) * s, lf.s * s);
      m.compose(pos, q, sc);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHex(tones[lf.tone]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    g.add(inst);

    add(scene, g, x, 0, z);
    if (colliders) colliders.push({ x, z, hx: 1.4 * s, hz: 1.4 * s });
    return g;
  }

  // --------------------------------------------------------------- 흰 울타리
  function picketFence(scene, x, z0, z1, alongZ) {
    const len = Math.abs(z1 - z0);
    const count = Math.max(2, Math.round(len / 1.5));
    const picketGeo = L.box(0.55, 2.2, 0.3);
    const inst = new THREE.InstancedMesh(picketGeo, L.mat(C.white), count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = z0 + (z1 - z0) * (i / (count - 1));
      m.makeTranslation(alongZ ? x : t, 1.6, alongZ ? t : x);
      inst.setMatrixAt(i, m);
    }
    scene.add(inst);
    // 가로 레일 두 줄
    for (const y of [1.1, 2.1]) {
      const rail = new THREE.Mesh(
        alongZ ? L.box(0.25, 0.28, len) : L.box(len, 0.28, 0.25), L.mat(C.white));
      rail.position.set(alongZ ? x : (z0 + z1) / 2, y, alongZ ? (z0 + z1) / 2 : x);
      scene.add(rail);
    }
  }

  // --------------------------------------------------------------- 소화전
  function hydrant(scene, x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(L.cyl(1.0, 1.1, 0.35, 12), L.mat(C.red));
    base.position.y = 0.2;
    const bodyM = new THREE.Mesh(L.cyl(0.62, 0.72, 1.9, 12), L.mat(C.red));
    bodyM.position.y = 1.3;
    const cap = new THREE.Mesh(L.sph(0.66, 12), L.mat(C.red));
    cap.position.y = 2.3;
    const top = new THREE.Mesh(L.cyl(0.14, 0.3, 0.55, 8), L.mat(C.red));
    top.position.y = 2.75;
    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(L.cyl(0.24, 0.24, 0.5, 8), L.mat(C.red));
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(side * 0.75, 1.55, 0);
      g.add(nozzle);
    }
    base.castShadow = bodyM.castShadow = cap.castShadow = true;
    g.add(base, bodyM, cap, top);
    return add(scene, g, x, CURB_Y, z);
  }

  // --------------------------------------------------------------- 신호등 기둥
  function pedestrianTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#0b0f12'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#3ddc4a';
    // 걷는 사람 픽토그램
    g.beginPath(); g.arc(64, 26, 11, 0, Math.PI * 2); g.fill();      // 머리
    g.save(); g.translate(64, 62); g.rotate(0.08);
    g.fillRect(-9, -20, 18, 40); g.restore();                        // 몸통
    g.lineWidth = 9; g.strokeStyle = '#3ddc4a'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(58, 78); g.lineTo(44, 108); g.stroke();   // 뒷다리
    g.beginPath(); g.moveTo(68, 78); g.lineTo(86, 104); g.stroke();   // 앞다리
    g.beginPath(); g.moveTo(58, 46); g.lineTo(38, 60); g.stroke();    // 팔
    g.beginPath(); g.moveTo(70, 46); g.lineTo(90, 38); g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function trafficPole(scene, x, z, colliders) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(L.cyl(0.42, 0.5, 20, 12), L.mat(C.black, 'matte'));
    pole.position.y = 10;
    pole.castShadow = true;
    g.add(pole);
    const foot = new THREE.Mesh(L.cyl(1.1, 1.3, 0.7, 12), L.mat(C.black, 'matte'));
    foot.position.y = 0.35;
    g.add(foot);

    // 보행 신호(초록 사람) — 카메라 쪽을 본다
    const boxBody = new THREE.Mesh(L.box(2.9, 3.6, 1.5), L.mat(C.black, 'matte'));
    boxBody.position.set(0, 12.6, 0.9);
    g.add(boxBody);
    const signal = new THREE.Mesh(L.box(2.3, 2.7, 0.1), new THREE.MeshBasicMaterial({ map: pedestrianTexture() }));
    signal.position.set(0, 12.7, 1.68);
    g.add(signal);
    const hood = new THREE.Mesh(L.box(3.1, 0.3, 1.9), L.mat(C.black, 'matte'));
    hood.position.set(0, 14.5, 1.1);
    g.add(hood);

    // 노란 신호 램프 박스
    const lampBox = new THREE.Mesh(L.box(1.9, 1.9, 1.9), L.mat(C.yellow));
    lampBox.position.set(0.2, 16.4, 0.5);
    g.add(lampBox);
    const lens = new THREE.Mesh(L.cyl(0.6, 0.6, 0.2, 12), L.mat(C.orange, 'glow'));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.2, 16.4, 1.5);
    g.add(lens);

    // 맨 위 검은 카메라 뭉치 (사진 상단의 그 덩어리)
    const camBase = new THREE.Mesh(L.box(2.4, 1.2, 2.4), L.mat(C.black, 'matte'));
    camBase.position.y = 20.4;
    g.add(camBase);
    for (const a of [0.4, 2.2, 4.1]) {
      const cam = new THREE.Mesh(L.box(1.5, 1.4, 2.2), L.mat(C.darkGray, 'matte'));
      cam.position.set(Math.sin(a) * 1.3, 21.4, Math.cos(a) * 1.3);
      cam.rotation.y = a;
      g.add(cam);
      const lensC = new THREE.Mesh(L.cyl(0.4, 0.4, 0.3, 10), L.mat(C.glass, 'glass'));
      lensC.rotation.x = Math.PI / 2;
      lensC.position.set(Math.sin(a) * 2.3, 21.4, Math.cos(a) * 2.3);
      g.add(lensC);
    }
    if (colliders) colliders.push({ x, z, hx: 1.4, hz: 1.4 });
    return add(scene, g, x, CURB_Y, z);
  }

  function streetLamp(scene, x, z, flip) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(L.cyl(0.34, 0.42, 16, 10), L.mat(C.black, 'matte'));
    pole.position.y = 8;
    const armLen = 3.4;
    const arm = new THREE.Mesh(L.box(armLen, 0.34, 0.34), L.mat(C.black, 'matte'));
    arm.position.set((flip ? -1 : 1) * armLen / 2, 15.9, 0);
    const head = new THREE.Mesh(L.box(1.5, 0.5, 1.1), L.mat(C.black, 'matte'));
    head.position.set((flip ? -1 : 1) * armLen, 15.6, 0);
    const bulb = new THREE.Mesh(L.box(1.2, 0.16, 0.85), L.mat(0xfff3c4, 'glow'));
    bulb.position.set((flip ? -1 : 1) * armLen, 15.3, 0);
    g.add(pole, arm, head, bulb);
    return add(scene, g, x, CURB_Y, z);
  }

  // --------------------------------------------------------------- 파사드 텍스처
  const facadeCache = new Map();
  /** 벽 + 창문 한 칸을 그린 타일. 벽 색까지 텍스처에 넣고 머티리얼 색은 흰색으로 쓴다. */
  function facadeTexture(wall, trim, glass) {
    const key = wall + '|' + trim + '|' + glass;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const S = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const hex = (n) => '#' + ('000000' + n.toString(16)).slice(-6);
    g.fillStyle = hex(wall);
    g.fillRect(0, 0, S, S);
    // 브릭 한 단마다 가로 이음선 (쌓아 만든 벽처럼)
    g.fillStyle = 'rgba(0,0,0,0.055)';
    for (let i = 1; i < 7; i++) g.fillRect(0, Math.round(i * S / 7), S, 2);
    // 층 사이 굵은 이음선
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(0, S - 5, S, 5);
    // 세로 이음선(브릭 엇쌓기)
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 7; i++) {
      const y = Math.round(i * S / 7);
      g.fillRect(i % 2 ? Math.round(S * 0.5) : 0, y, 2, Math.round(S / 7));
      g.fillRect(i % 2 ? 0 : Math.round(S * 0.5), y, 2, Math.round(S / 7));
    }
    // 창틀 + 유리
    g.fillStyle = hex(trim);
    g.fillRect(S * 0.18, S * 0.20, S * 0.64, S * 0.56);
    g.fillStyle = hex(glass);
    g.fillRect(S * 0.24, S * 0.26, S * 0.52, S * 0.40);
    // 유리 반사
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.moveTo(S * 0.24, S * 0.60); g.lineTo(S * 0.52, S * 0.26);
    g.lineTo(S * 0.66, S * 0.26); g.lineTo(S * 0.24, S * 0.66);
    g.closePath(); g.fill();
    // 창살 + 창턱
    g.strokeStyle = hex(trim); g.lineWidth = 4;
    g.beginPath(); g.moveTo(S * 0.5, S * 0.26); g.lineTo(S * 0.5, S * 0.66); g.stroke();
    g.fillStyle = hex(trim);
    g.fillRect(S * 0.14, S * 0.76, S * 0.72, S * 0.06);
    // 창턱 아래 그림자 — 창이 벽에서 튀어나와 보인다
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(S * 0.14, S * 0.82, S * 0.72, S * 0.04);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(S * 0.16, S * 0.16, S * 0.68, S * 0.04);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    facadeCache.set(key, t);
    return t;
  }

  /** 창문 없이 브릭 단 이음선만 있는 벽 텍스처 (경찰서·난간처럼 넓은 흰 벽) */
  const brickCache = new Map();
  function brickTexture(color) {
    if (brickCache.has(color)) return brickCache.get(color);
    const S = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#' + ('000000' + color.toString(16)).slice(-6);
    g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 1; i < 4; i++) g.fillRect(0, Math.round(i * S / 4), S, 2);
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 4; i++) {
      const y = Math.round(i * S / 4);
      g.fillRect(i % 2 ? Math.round(S * 0.5) : 0, y, 2, Math.round(S / 4));
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, 0, S, 3);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    brickCache.set(color, t);
    return t;
  }

  /** 브릭 벽 머티리얼 (w,h 는 스터드 단위 — 이음선 간격을 맞추려고 받는다) */
  function brickMaterial(color, w, h) {
    const t = brickTexture(color).clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
    return new THREE.MeshPhongMaterial({ color: 0xffffff, map: t, specular: 0x9a9a9a, shininess: 70 });
  }

  /** 박스 6면 머티리얼: 지정한 면에만 파사드 무늬 */
  function facadeMaterials(o, cols, floors) {
    const tex = facadeTexture(o.wall, o.trim, o.glass === undefined ? 0x2c5f86 : o.glass);
    const front = tex.clone(); front.needsUpdate = true; front.repeat.set(cols, floors);
    const sideT = tex.clone(); sideT.needsUpdate = true; sideT.repeat.set(Math.max(1, cols - 1), floors);
    const skin = (t) => new THREE.MeshPhongMaterial({ color: 0xffffff, map: t, specular: 0x777777, shininess: 44 });
    const plain = L.mat(o.wall);
    const f = skin(front), sd = skin(sideT);
    // +X(도로쪽), -X, +Y, -Y, +Z, -Z
    return [f, plain, plain, plain, sd, sd];
  }

  // --------------------------------------------------------------- 건물
  /** 왼쪽 연립주택 한 채 (창문은 텍스처, 문·천막·난간만 실제 브릭) */
  function townhouse(scene, o, colliders) {
    const g = new THREE.Group();
    const w = o.w, d = o.d, floors = o.floors, fh = 6.2;
    const h = floors * fh;
    const cols = Math.max(2, Math.round(d / 5.5));

    const wall = new THREE.Mesh(L.box(w, h, d), facadeMaterials(o, cols, floors));
    wall.position.y = h / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);

    // 지붕(스터드 판 + 난간)
    const roof = L.plate(o.roof, w, d, { height: 1.0 });
    roof.position.y = h + 0.5;
    g.add(roof);
    const parapet = new THREE.Mesh(L.box(w + 0.6, 1.4, d + 0.6), brickMaterial(o.trim, w, 1.4));
    parapet.position.y = h + 1.4;
    g.add(parapet);

    // 1층 상점 천막(있는 집만) — 두 칸만 달아 드로우콜을 아낀다
    if (o.awning) {
      for (let i = 0; i < 2; i++) {
        const awn = new THREE.Mesh(L.box(2.4, 0.4, 4.0), L.mat(o.awning));
        awn.position.set(w / 2 + 1.2, fh * 0.86, -d / 4 + i * (d / 2));
        awn.rotation.z = -0.22;
          g.add(awn);
      }
    }
    // 문
    const door = new THREE.Mesh(L.box(0.5, 4.6, 2.6), L.mat(o.trim));
    door.position.set(w / 2 + 0.2, 2.4, -d / 2 + 2.4);
    g.add(door);
    const knob = new THREE.Mesh(L.cyl(0.16, 0.16, 0.2, 8), L.mat(C.gold, 'metal'));
    knob.rotation.z = Math.PI / 2;
    knob.position.set(w / 2 + 0.5, 2.4, -d / 2 + 1.5);
    g.add(knob);

    add(scene, g, o.x, CURB_Y, o.z, o.ry || 0);
    if (colliders) colliders.push({ x: o.x, z: o.z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    return g;
  }

  /** 오른쪽 POLICE 경찰서 — 사진의 주인공 건물 */
  function policeStation(scene, colliders) {
    const g = new THREE.Group();
    const w = 26, d = 30, h = 15;

    const wall = new THREE.Mesh(L.box(w, h, d), brickMaterial(C.white, w, h));
    wall.position.y = h / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);

    // 파란 지붕 띠 + 지붕 판
    const band = new THREE.Mesh(L.box(w + 1.2, 2.6, d + 1.2), brickMaterial(C.blue, w, 2.6));
    band.position.y = h + 0.6;
    g.add(band);
    const roof = L.plate(C.lightGray, w, d, { height: 1.0 });
    roof.position.y = h + 2.3;
    g.add(roof);

    // 정면(도로 쪽 = -X) 유리 + 문
    for (let i = 0; i < 3; i++) {
      const glass = new THREE.Mesh(L.box(0.4, 8.5, 6.4), L.mat(0x2c5f86, 'glass'));
      glass.position.set(-w / 2 - 0.1, 5.6, -8 + i * 8.5);
      g.add(glass);
      const frame = new THREE.Mesh(L.box(0.55, 9.4, 0.6), L.mat(C.white));
      frame.position.set(-w / 2 - 0.15, 5.6, -8 + i * 8.5 - 3.4);
      g.add(frame);
      // 유리 가운데 흰 창살 — 큰 유리가 회색 판처럼 보이지 않게
      const mullion = new THREE.Mesh(L.box(0.6, 9.4, 0.35), L.mat(C.white));
      mullion.position.set(-w / 2 - 0.18, 5.6, -8 + i * 8.5);
      g.add(mullion);
      const sill = new THREE.Mesh(L.box(0.9, 0.6, 7.0), L.mat(C.lightGray));
      sill.position.set(-w / 2 - 0.3, 1.1, -8 + i * 8.5);
      g.add(sill);
    }
    // 유리 자동문
    const door = new THREE.Mesh(L.box(0.5, 7.5, 5.2), L.mat(0x3a749c, 'glass'));
    door.position.set(-w / 2 - 0.2, 4.2, 11.5);
    g.add(door);
    const doorFrame = new THREE.Mesh(L.box(0.7, 8.4, 6.0), L.mat(C.blue));
    doorFrame.position.set(-w / 2 - 0.05, 4.2, 11.5);
    g.add(doorFrame);

    // POLICE 간판(파란 판 + 흰 글자) — 정면 상단
    const sign = L.signPanel('POLICE', 15, 3.6, '#0055bf', '#f4f4f2');
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(-w / 2 - 0.5, 12.0, 1);
    g.add(sign);
    const signBack = new THREE.Mesh(L.box(0.4, 4.6, 17), L.mat(C.blue));
    signBack.position.set(-w / 2 - 0.28, 12.0, 1);
    g.add(signBack);

    // 금색 경찰 방패 엠블럼
    const shieldPlate = new THREE.Mesh(L.box(0.35, 3.0, 2.4), L.mat(C.blue));
    shieldPlate.position.set(-w / 2 - 0.3, 6.2, 15.6);
    g.add(shieldPlate);
    const shield = new THREE.Mesh(L.cyl(0.95, 0.95, 0.25, 6), L.mat(C.gold, 'metal'));
    shield.rotation.set(0, 0, Math.PI / 2);
    shield.position.set(-w / 2 - 0.6, 6.4, 15.6);
    g.add(shield);

    // 옥상: 격자 타워 + 접시안테나 + 긴 안테나
    const tower = new THREE.Group();
    for (const [tx, tz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(L.box(0.34, 9, 0.34), L.mat(C.silver, 'metal'));
      leg.position.set(tx, 4.5, tz);
      tower.add(leg);
    }
    for (let i = 1; i <= 2; i++) {
      const rung = new THREE.Mesh(L.box(3.1, 0.24, 3.1), L.mat(C.silver, 'metal'));
      rung.position.y = i * 3.4;
      tower.add(rung);
    }
    tower.position.set(3, h + 2.8, -6);
    g.add(tower);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshPhongMaterial({ color: C.silver, specular: 0xffffff, shininess: 150, side: THREE.DoubleSide }));
    dish.position.set(3, h + 12.6, -6);
    dish.rotation.set(-0.7, 0, 0.25);
    g.add(dish);
    const feed = new THREE.Mesh(L.cyl(0.14, 0.14, 2.2, 8), L.mat(C.darkGray, 'metal'));
    feed.position.set(3, h + 13.6, -4.6);
    feed.rotation.x = -0.7;
    g.add(feed);

    const antenna = new THREE.Mesh(L.cyl(0.16, 0.22, 16, 8), L.mat(C.black, 'matte'));
    antenna.position.set(-6, h + 11, -9);
    g.add(antenna);
    const tip = new THREE.Mesh(L.sph(0.55, 10), L.mat(C.white));
    tip.position.set(-6, h + 19.2, -9);
    g.add(tip);

    // 주차장 진입 게이트(사진 왼쪽의 흰 격자 담장)
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(L.box(0.4, 7, 11), L.mat(C.white));
      panel.position.set(-w / 2 - 8, 3.5, -d / 2 - 6 - i * 11.4);
      g.add(panel);
    }

    add(scene, g, 34, CURB_Y, 6);
    if (colliders) colliders.push({ x: 34, z: 6, hx: w / 2 + 0.5, hz: d / 2 + 0.5 });
    return g;
  }

  /** 고층빌딩 벽면용 창문 텍스처 (창을 메시로 만들면 드로우콜이 폭발한다) */
  let officeTex = null;
  function officeTexture() {
    if (officeTex) return officeTex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(52,110,150,0.85)';
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillRect(x * 32 + 5, y * 32 + 7, 22, 17);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.10)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 128, 128);
    officeTex = new THREE.CanvasTexture(cv);
    officeTex.wrapS = officeTex.wrapT = THREE.RepeatWrapping;
    officeTex.encoding = THREE.sRGBEncoding;
    return officeTex;
  }

  function officeMaterial(color, w, h) {
    const t = officeTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
    return new THREE.MeshPhongMaterial({ color, map: t, specular: 0x6a6a6a, shininess: 40 });
  }

  /** 멀리 보이는 고층빌딩 스카이라인 */
  function skyline(scene) {
    const specs = [
      [-52, -95, 22, 46, 0.60, C.white], [-40, -130, 26, 62, 0.65, C.tan],
      [-70, -150, 30, 74, 0.6, C.lightGray], [-30, -170, 26, 92, 0.55, C.white],
      [-58, -200, 34, 110, 0.5, C.sandBlue], [4, -196, 30, 86, 0.55, C.lightGray],
      [30, -168, 28, 104, 0.5, C.white], [58, -190, 34, 120, 0.5, C.sandBlue],
      [64, -140, 26, 70, 0.6, C.tan], [46, -120, 22, 52, 0.65, C.white],
      [-18, -220, 40, 140, 0.45, C.lightGray], [22, -240, 44, 150, 0.45, C.sandBlue],
      [-90, -175, 30, 66, 0.55, C.tan], [92, -165, 30, 78, 0.55, C.white],
    ];
    for (let i = 0; i < specs.length; i++) {
      const [x, z, w, h, glassRatio, col] = specs[i];
      void glassRatio;
      const g = new THREE.Group();
      const b = new THREE.Mesh(L.box(w, h, w * 0.9), officeMaterial(col, w, h));
      b.position.y = h / 2;
      g.add(b);
      const cap = new THREE.Mesh(L.box(w * 0.7, 3, w * 0.65), L.mat(C.lightGray));
      cap.position.y = h + 1.5;
      g.add(cap);
      add(scene, g, x, 0, z);
    }
    // 공사 중인 주황 철골 건물(사진 오른쪽)
    const site = new THREE.Group();
    for (let f = 0; f < 8; f++) {
      const slab = L.plate(C.orange, 16, 16, { height: 0.8 });
      slab.position.y = f * 6.2;
      site.add(slab);
      for (const [px, pz] of [[-7, -7], [7, 7]]) {
        const col2 = new THREE.Mesh(L.box(1.2, 6.2, 1.2), L.mat(C.reddishBrown));
        col2.position.set(px, f * 6.2 + 3.1, pz);
        site.add(col2);
      }
    }
    add(scene, site, 44, 0, -96);
  }

  /** 노란 타워크레인 + 매달린 자재 */
  function crane(scene) {
    const g = new THREE.Group();
    const mast = new THREE.Group();
    for (const [mx, mz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      const leg = new THREE.Mesh(L.box(0.6, 66, 0.6), L.mat(C.yellow));
      leg.position.set(mx, 33, mz);
      mast.add(leg);
    }
    for (let i = 1; i < 9; i++) {
      const rung = new THREE.Mesh(L.box(3.6, 0.4, 3.6), L.mat(C.yellow));
      rung.position.y = i * 7.5;
      mast.add(rung);
    }
    g.add(mast);

    // 기울어진 지브(사진처럼 비스듬히 올라간 팔)
    const jib = new THREE.Group();
    const jibLen = 52;
    for (const [jy, jz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      const beam = new THREE.Mesh(L.box(jibLen, 0.5, 0.5), L.mat(C.yellow));
      beam.position.set(jibLen / 2, jy, jz);
      jib.add(beam);
    }
    for (let i = 1; i < 8; i++) {
      const rung = new THREE.Mesh(L.box(0.4, 2.9, 2.9), L.mat(C.yellow));
      rung.position.x = i * 6.5;
      jib.add(rung);
    }
    jib.position.y = 62;
    jib.rotation.z = 0.42;
    jib.rotation.y = -0.5;
    g.add(jib);

    // 카운터 지브 + 운전실
    const counter = new THREE.Mesh(L.box(14, 1.4, 2.6), L.mat(C.yellow));
    counter.position.set(-6, 61, 0);
    counter.rotation.y = -0.5;
    g.add(counter);
    const cab = new THREE.Mesh(L.box(4.2, 3.6, 3.4), L.mat(C.yellow));
    cab.position.set(0, 58, 0);
    g.add(cab);
    const cabGlass = new THREE.Mesh(L.box(4.4, 2.0, 3.6), L.mat(C.glass, 'glass'));
    cabGlass.position.set(0, 58.6, 0);
    g.add(cabGlass);

    // 케이블 + 매달린 자재 팔레트
    const hook = new THREE.Group();
    const cable = new THREE.Mesh(L.cyl(0.09, 0.09, 22, 6), L.mat(C.darkGray, 'metal'));
    cable.position.y = -11;
    hook.add(cable);
    const pallet = L.plate(C.yellow, 5, 4, { height: 1.4 });
    pallet.position.y = -22.6;
    hook.add(pallet);
    const load = L.plate(C.lime, 4, 3, { height: 1.2 });
    load.position.y = -21.6;
    hook.add(load);
    const jibX = Math.cos(0.42) * 40, jibY = 62 + Math.sin(0.42) * 40;
    hook.position.set(Math.cos(-0.5) * jibX, jibY, -Math.sin(-0.5) * jibX);
    g.add(hook);

    add(scene, g, 62, 0, -74);
    return { group: g, hook };
  }

  /** 흰 헬리콥터 — 도시 위를 천천히 돈다 */
  function helicopter(scene) {
    const g = new THREE.Group();
    const bodyM = new THREE.Mesh(L.sph(2.6, 14), L.mat(C.white));
    bodyM.scale.set(1.5, 1.0, 1.05);
    g.add(bodyM);
    const glass = new THREE.Mesh(L.sph(2.1, 12), L.mat(0x2c5f86, 'glass'));
    glass.scale.set(1.0, 0.9, 1.0);
    glass.position.set(2.6, 0.2, 0);
    g.add(glass);
    const boom = new THREE.Mesh(L.box(7, 0.9, 0.9), L.mat(C.white));
    boom.position.set(-5.6, 0.6, 0);
    g.add(boom);
    const fin = new THREE.Mesh(L.box(1.6, 2.6, 0.5), L.mat(C.blue));
    fin.position.set(-8.8, 1.6, 0);
    g.add(fin);
    const tailRotor = new THREE.Mesh(L.box(0.3, 3.4, 0.24), L.mat(C.lightGray));
    tailRotor.position.set(-9.1, 1.4, 0.5);
    g.add(tailRotor);
    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(L.box(6, 0.4, 0.4), L.mat(C.darkGray, 'metal'));
      skid.position.set(0, -2.6, side * 1.6);
      g.add(skid);
      const strut = new THREE.Mesh(L.box(0.35, 1.6, 0.35), L.mat(C.darkGray, 'metal'));
      strut.position.set(0, -1.9, side * 1.6);
      g.add(strut);
    }
    const rotorHub = new THREE.Mesh(L.cyl(0.5, 0.5, 0.8, 8), L.mat(C.darkGray, 'metal'));
    rotorHub.position.y = 2.6;
    g.add(rotorHub);
    const rotor = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(L.box(17, 0.16, 1.0), L.mat(C.lightGray));
      blade.rotation.y = i * Math.PI / 2;
      rotor.add(blade);
    }
    rotor.position.y = 3.1;
    g.add(rotor);
    add(scene, g, 0, 62, -60);
    return { group: g, rotor, tailRotor };
  }

  // --------------------------------------------------------------- 자동차
  /** 바퀴 네 개 (타이어 + 은색 휠 + 휠 아치) */
  function carWheels(g, w, len, r) {
    r = r || 1.25;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const tyre = new THREE.Mesh(L.cyl(r, r, 1.0, 16), L.mat(C.black, 'matte'));
        tyre.rotation.z = Math.PI / 2;
        tyre.position.set(sx * (w / 2 - 0.1), r, sz * (len / 2 - 2.1));
        tyre.castShadow = true;
        g.add(tyre);
        const hub = new THREE.Mesh(L.cyl(r * 0.5, r * 0.5, 1.05, 12), L.mat(C.silver, 'metal'));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(sx * (w / 2 - 0.05), r, tyre.position.z);
        g.add(hub);
      }
    }
  }

  /**
   * 사진의 빨간 SUV: 낮은 차체 + 높은 캐빈 + 비스듬한 앞유리 +
   * 은색 범퍼·둥근 전조등 + 스터드 얹힌 지붕.
   */
  function redSuv(scene, x, z, ry, colliders) {
    const g = new THREE.Group();
    const w = 6.8, len = 13.5;

    // 차대 + 차체
    const chassis = new THREE.Mesh(L.box(w - 0.6, 1.0, len - 1), L.mat(C.darkGray, 'matte'));
    chassis.position.y = 1.1;
    g.add(chassis);
    const lower = new THREE.Mesh(L.box(w, 2.0, len), L.mat(C.red));
    lower.position.y = 2.5;
    lower.castShadow = true;
    g.add(lower);
    // 문 손잡이 라인
    for (const sx of [-1, 1]) {
      const line = new THREE.Mesh(L.box(0.16, 0.3, 4.2), L.mat(C.darkRed, 'matte'));
      line.position.set(sx * (w / 2 + 0.02), 2.9, -0.6);
      g.add(line);
    }
    // 보닛(낮은 앞부분)
    const hood = new THREE.Mesh(L.box(w - 0.3, 1.2, 4.0), L.mat(C.red));
    hood.position.set(0, 4.0, len / 2 - 2.2);
    hood.castShadow = true;
    g.add(hood);
    // 캐빈
    const cabin = new THREE.Mesh(L.box(w - 0.5, 3.0, len - 6.2), L.mat(C.red));
    cabin.position.set(0, 5.0, -1.3);
    cabin.castShadow = true;
    g.add(cabin);
    // 앞유리(비스듬히)
    const wind = new THREE.Mesh(L.box(w - 1.0, 3.3, 0.35), L.mat(0x1f3b4d, 'glass'));
    wind.position.set(0, 5.1, len / 2 - 4.1);
    wind.rotation.x = -0.42;
    g.add(wind);
    const windFrame = new THREE.Mesh(L.box(w - 0.6, 3.5, 0.2), L.mat(C.red));
    windFrame.position.set(0, 5.05, len / 2 - 4.35);
    windFrame.rotation.x = -0.42;
    g.add(windFrame);
    // 측면 유리 + 뒷유리
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(L.box(0.3, 1.9, len - 7.0), L.mat(0x1f3b4d, 'glass'));
      side.position.set(sx * (w / 2 - 0.35), 5.5, -1.3);
      g.add(side);
    }
    const rear = new THREE.Mesh(L.box(w - 1.2, 2.0, 0.3), L.mat(0x1f3b4d, 'glass'));
    rear.position.set(0, 5.5, -len / 2 + 2.5);
    g.add(rear);
    // 지붕(스터드 판) + 루프랙
    const roof = L.plate(C.red, 6, 6, { height: 0.6 });
    roof.position.set(0, 6.7, -1.3);
    g.add(roof);
    for (const sx of [-1, 1]) {
      const rack = new THREE.Mesh(L.box(0.3, 0.3, 5.4), L.mat(C.black, 'matte'));
      rack.position.set(sx * 2.2, 7.1, -1.3);
      g.add(rack);
    }
    // 앞: 그릴 · 범퍼 · 전조등 · 방향지시등 · 번호판
    const grille = new THREE.Mesh(L.box(w - 1.2, 1.0, 0.4), L.mat(C.black, 'matte'));
    grille.position.set(0, 3.9, len / 2 + 0.1);
    g.add(grille);
    const bumper = new THREE.Mesh(L.box(w + 0.1, 1.1, 0.9), L.mat(C.lightGray, 'metal'));
    bumper.position.set(0, 2.1, len / 2 + 0.25);
    bumper.castShadow = true;
    g.add(bumper);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(L.cyl(0.62, 0.62, 0.3, 14), L.mat(0xfff6d0, 'glow'));
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(sx * 2.3, 3.9, len / 2 + 0.28);
      g.add(lamp);
      const blink = new THREE.Mesh(L.box(0.7, 0.4, 0.2), L.mat(C.orange, 'glow'));
      blink.position.set(sx * 2.3, 3.1, len / 2 + 0.3);
      g.add(blink);
      const tail = new THREE.Mesh(L.box(0.8, 0.7, 0.2), L.mat(0x8c1b0a, 'glow'));
      tail.position.set(sx * 2.2, 3.4, -len / 2 - 0.12);
      g.add(tail);
    }
    const plate = new THREE.Mesh(L.box(2.6, 0.9, 0.16), L.mat(C.white));
    plate.position.set(0, 2.4, len / 2 + 0.75);
    g.add(plate);

    carWheels(g, w, len, 1.3);
    add(scene, g, x, CURB_Y - 0.5, z, ry);
    if (colliders) colliders.push({ x, z, hx: w / 2 + 0.6, hz: len / 2 + 0.4 });
    return g;
  }

  /** 사진의 경찰차: 흰 차체 + 파란 보닛/문 + POLICE 인쇄 + 파란 경광등 바 */
  function policeCar(scene, x, z, ry, colliders) {
    const g = new THREE.Group();
    const w = 6.8, len = 14.0;

    const chassis = new THREE.Mesh(L.box(w - 0.6, 1.0, len - 1), L.mat(C.darkGray, 'matte'));
    chassis.position.y = 1.05;
    g.add(chassis);
    const lower = new THREE.Mesh(L.box(w, 1.6, len), L.mat(C.blue));
    lower.position.y = 2.3;
    lower.castShadow = true;
    g.add(lower);
    const upper = new THREE.Mesh(L.box(w, 1.5, len), L.mat(C.white));
    upper.position.y = 3.7;
    upper.castShadow = true;
    g.add(upper);
    // 보닛(파랑) + 흰 지붕
    const hood = new THREE.Mesh(L.box(w - 0.3, 1.0, 3.8), L.mat(C.blue));
    hood.position.set(0, 4.7, len / 2 - 2.2);
    hood.castShadow = true;
    g.add(hood);
    const cabin = new THREE.Mesh(L.box(w - 0.5, 2.8, len - 6.4), L.mat(C.white));
    cabin.position.set(0, 5.4, -1.4);
    cabin.castShadow = true;
    g.add(cabin);
    const wind = new THREE.Mesh(L.box(w - 1.0, 3.1, 0.35), L.mat(0x1f3b4d, 'glass'));
    wind.position.set(0, 5.4, len / 2 - 4.0);
    wind.rotation.x = -0.44;
    g.add(wind);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(L.box(0.3, 1.8, len - 7.2), L.mat(0x1f3b4d, 'glass'));
      side.position.set(sx * (w / 2 - 0.35), 5.8, -1.4);
      g.add(side);
      // 측면 POLICE 인쇄 (파란 글자)
      const text = L.signPanel('POLICE', 5.6, 1.4, '#f4f4f2', '#0055bf');
      text.rotation.y = sx * Math.PI / 2;
      text.position.set(sx * (w / 2 + 0.1), 3.8, -1.0);
      g.add(text);
    }
    const rear = new THREE.Mesh(L.box(w - 1.2, 1.9, 0.3), L.mat(0x1f3b4d, 'glass'));
    rear.position.set(0, 5.8, -len / 2 + 2.6);
    g.add(rear);
    const roof = L.plate(C.white, 6, 6, { height: 0.6 });
    roof.position.set(0, 7.0, -1.4);
    g.add(roof);

    // 경광등 바(검은 받침 + 파란 투명 램프 2개)
    const barBase = new THREE.Mesh(L.box(5.0, 0.5, 1.5), L.mat(C.black, 'matte'));
    barBase.position.set(0, 7.5, 0.2);
    g.add(barBase);
    const lights = [];
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(L.box(2.0, 0.9, 1.3), L.mat(0x2f6fe0, 'glow'));
      lamp.position.set(sx * 1.3, 8.15, 0.2);
      g.add(lamp);
      lights.push(lamp);
    }
    // 앞: 푸시바 · 범퍼 · 전조등
    const push = new THREE.Mesh(L.box(w - 1.4, 1.6, 0.3), L.mat(C.silver, 'metal'));
    push.position.set(0, 3.2, len / 2 + 0.5);
    g.add(push);
    const grille = new THREE.Mesh(L.box(w - 1.2, 0.9, 0.4), L.mat(C.black, 'matte'));
    grille.position.set(0, 4.4, len / 2 + 0.1);
    g.add(grille);
    const bumper = new THREE.Mesh(L.box(w + 0.1, 1.0, 0.9), L.mat(C.lightGray, 'metal'));
    bumper.position.set(0, 2.0, len / 2 + 0.25);
    g.add(bumper);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(L.cyl(0.58, 0.58, 0.3, 14), L.mat(0xfff6d0, 'glow'));
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(sx * 2.3, 4.3, len / 2 + 0.28);
      g.add(lamp);
      const tail = new THREE.Mesh(L.box(0.8, 0.6, 0.2), L.mat(0x8c1b0a, 'glow'));
      tail.position.set(sx * 2.2, 3.6, -len / 2 - 0.12);
      g.add(tail);
    }
    const plate = new THREE.Mesh(L.box(2.6, 0.9, 0.16), L.mat(C.white));
    plate.position.set(0, 2.3, len / 2 + 0.75);
    g.add(plate);

    carWheels(g, w, len, 1.3);
    add(scene, g, x, CURB_Y - 0.5, z, ry);
    if (colliders) colliders.push({ x, z, hx: w / 2 + 0.6, hz: len / 2 + 0.4 });
    return { group: g, lights };
  }

  // --------------------------------------------------------------- 시민
  function citizens(scene) {
    const list = [];
    const spots = [
      // [x, z, 바라보는 방향, outfit index, 순찰 경로 유무]
      [-21.5, 30, 0.2, 0, true], [-17.5, 26, 0.1, 1, true], [-15.5, 24, -0.2, 2, true],
      [-17, 20, 0.4, 5, true], [-16, 12, 0.1, 3, true], [-22, 6, 0.5, 6, true],
      [16, 22, -0.2, 4, true], [17.5, 14, 0.1, 7, true], [15.5, 6, -0.3, 2, true],
      [21, 18, 0.3, 1, true], [-9, -2, 3.0, 6, false],
      [-16, -18, 0.2, 5, true],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, z, ry, oi, patrol] = spots[i];
      const fig = L.minifig(L.OUTFITS[oi % L.OUTFITS.length]);
      add(scene, fig, x, CURB_Y, z, ry);
      list.push({
        fig, home: new THREE.Vector2(x, z), phase: i * 1.3, patrol,
        dir: i % 2 ? 1 : -1, scared: 0,
      });
    }
    // 경찰서 앞 경찰관
    const cop = L.minifig(L.POLICE_OUTFIT);
    add(scene, cop, 20, CURB_Y, 12, -1.4);
    list.push({ fig: cop, home: new THREE.Vector2(20, 12), phase: 0.5, patrol: false, dir: 1, scared: 0 });
    return list;
  }

  // --------------------------------------------------------------- 조립
  function buildCity(scene) {
    const colliders = [];
    const anim = {};

    scene.background = null;
    // 거리감은 심도 흐림(postfx)이 대부분 만들어주니 안개는 옅게만
    scene.fog = new THREE.Fog(0xb6d8ef, 120, 400);

    anim.sky = skyDome(scene);
    ground(scene);
    skyline(scene);
    anim.crane = crane(scene);
    anim.heli = helicopter(scene);

    // 왼쪽 연립주택 줄 (사진: 빨강 → 살색 → 흰색 → 하늘색)
    const houses = [
      { x: -37, z: 28, w: 20, d: 18, floors: 3, wall: C.red, trim: C.white, roof: C.darkRed, awning: C.green },
      { x: -38, z: 6, w: 22, d: 22, floors: 3, wall: C.tan, trim: C.white, roof: C.reddishBrown, awning: C.azure },
      { x: -37, z: -18, w: 20, d: 24, floors: 4, wall: C.white, trim: C.lightGray, roof: C.darkGray, glass: 0x3a749c },
      { x: -39, z: -46, w: 24, d: 26, floors: 4, wall: C.sandBlue, trim: C.white, roof: C.darkBlue },
      { x: -37, z: -74, w: 20, d: 24, floors: 3, wall: C.magenta, trim: C.white, roof: C.darkRed },
    ];
    for (const h of houses) townhouse(scene, h, colliders);

    // 오른쪽: 경찰서 + 상가
    policeStation(scene, colliders);
    townhouse(scene, { x: 38, z: -34, w: 22, d: 26, floors: 3, wall: C.tan, trim: C.white, roof: C.brown, awning: C.red, ry: Math.PI }, colliders);
    townhouse(scene, { x: 40, z: -62, w: 24, d: 24, floors: 4, wall: C.white, trim: C.azure, roof: C.darkGray, ry: Math.PI }, colliders);

    // 소품
    // 신호등 기둥·소화전은 사진처럼 화면 왼쪽 앞쪽에 보이는 자리로
    trafficPole(scene, -15, 6, colliders);
    hydrant(scene, -20.5, 14);
    streetLamp(scene, 16.5, 30, true);
    streetLamp(scene, -16.5, -6, false);
    streetLamp(scene, 16.5, -22, true);
    picketFence(scene, -21, 34, 18, true);
    picketFence(scene, 21, 34, 18, true);
    picketFence(scene, -21, 12, -6, true);
    picketFence(scene, 21, 0, -18, true);
    tree(scene, -25.5, 33, 1.45, colliders);
    tree(scene, -25, 16, 1.2, colliders);
    tree(scene, -24.5, -6, 1.3, colliders);
    tree(scene, 25.5, 28, 1.25, colliders);
    tree(scene, 25, -14, 1.35, colliders);
    tree(scene, 26, -40, 1.2, colliders);
    tree(scene, -26, -34, 1.25, colliders);

    // 차량
    // 사진처럼 두 차 모두 카메라(플레이어) 쪽을 향해 서 있다
    redSuv(scene, -6.5, 2, 0, colliders);
    anim.police = policeCar(scene, 7.2, -5, 0.16, colliders);

    // ---- 진짜 돌기(스터드) 심기: 실물 레고 사진의 질감은 여기서 나온다
    const skipInside = (pad) => (x, z) => {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad) return true;
      }
      return false;
    };
    const studZ0 = -56, studZ1 = 40;
    for (const side of [-1, 1]) {
      // 인도
      const walk = L.studField(C.lightGray, {
        x0: side < 0 ? -WALK_OUT : ROAD_HALF, x1: side < 0 ? -ROAD_HALF : WALK_OUT,
        z0: studZ0, z1: studZ1,
      }, CURB_Y, { skip: skipInside(0.6), max: 1000 });
      if (walk) scene.add(walk);
      // 도로 양쪽 회색 띠
      const lane = L.studField(C.lightGray, {
        x0: side < 0 ? -ROAD_HALF : ROAD_HALF - 3.2, x1: side < 0 ? -ROAD_HALF + 3.2 : ROAD_HALF,
        z0: studZ0, z1: studZ1,
      }, 0.52, { skip: (x, z) => (z > CROSS_Z0 - 1.5 && z < CROSS_Z1 + 1.5), max: 700 });
      if (lane) scene.add(lane);
      // 잔디띠(울타리 안쪽)
      const grass = L.studField(C.brightGreen, {
        x0: side < 0 ? -27 : WALK_OUT, x1: side < 0 ? -WALK_OUT : 27,
        z0: studZ0, z1: studZ1,
      }, CURB_Y - 0.02, { skip: skipInside(1.0), max: 1000 });
      if (grass) scene.add(grass);
    }

    const npcs = citizens(scene);

    // 정적인 도시는 행렬 계산을 꺼서 CPU 를 아낀다(움직이는 것만 다시 켠다)
    const dynamic = [anim.heli.group, anim.crane.group];
    for (let i = 0; i < npcs.length; i++) dynamic.push(npcs[i].fig);
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { o.matrixAutoUpdate = false; });
    for (let i = 0; i < dynamic.length; i++) {
      dynamic[i].traverse((o) => { o.matrixAutoUpdate = true; });
    }

    return {
      colliders, anim, npcs,
      bounds: { minX: -WALK_OUT - 8, maxX: WALK_OUT + 8, minZ: -110, maxZ: Z_NEAR - 2 },
      road: { half: ROAD_HALF, crossZ: (CROSS_Z0 + CROSS_Z1) / 2 },
      curbY: CURB_Y,
    };
  }

  /** AABB 목록에 대한 원(반지름 r) 밀어내기 — 새 객체 생성 없음 */
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

  L.buildCity = buildCity;
  L.resolveCollision = resolveCollision;
  L.CITY = { ROAD_HALF, WALK_OUT, CURB_Y, CROSS_Z0, CROSS_Z1, Z_FAR, Z_NEAR };
})(window.LEGO);
