/* =========================================================================
 * bricks.js — 레고 브릭 부품 공장
 * 사진(레고 시티 실물 디오라마)의 느낌을 그대로 내기 위한 규칙:
 *   - 1 unit = 스터드 1칸(8mm), 브릭 높이 1.2, 플레이트 높이 0.4
 *   - 플라스틱 광택 = MeshPhongMaterial(specular + shininess)
 *   - 스터드(돌기)는 넓은 판은 텍스처(map+bumpMap), 가까운 부품은 실제 실린더
 * 모든 함수는 순수 팩토리(부수효과 금지). 색은 COLORS 팔레트만 사용.
 * ========================================================================= */
window.LEGO = window.LEGO || {};
(function (L) {
  'use strict';

  // 팔레트 색은 sRGB 값이다. legacyMode 를 끄지 않으면 전부 하얗게 날아간다.
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  const STUD = 1;          // 스터드 가로 피치
  const PLATE = 0.4;       // 플레이트 높이(브릭의 1/3)
  const BRICK = 1.2;       // 브릭 1단 높이

  // 레고 공식 색에 가까운 팔레트 (사진에서 뽑음)
  const COLORS = {
    red: 0xc91a09,
    darkRed: 0x720e0f,
    blue: 0x0055bf,
    darkBlue: 0x0a3463,
    sandBlue: 0x6074a1,
    azure: 0x078bc9,
    yellow: 0xf2cd37,
    orange: 0xfe8a18,
    white: 0xf4f4f2,
    black: 0x1b2a34,
    darkGray: 0x6c6e68,
    lightGray: 0xa3a8ac,
    green: 0x237841,
    brightGreen: 0x4b9f4a,
    lime: 0xa5ca18,
    tan: 0xe4cd9e,
    darkTan: 0x958a73,
    brown: 0x583927,
    reddishBrown: 0x7c503a,
    gold: 0xdcbe61,
    silver: 0xb8b8b8,
    purple: 0x81007b,
    magenta: 0xc870a0,
    glass: 0x9fd2e6,
    flesh: 0xf6d7b3,
    fire: 0xff7a18,
  };

  // ---------------------------------------------------------------- 텍스처
  const texCache = new Map();

  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function finishTexture(cv, repeatX, repeatY, srgb) {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 4;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // 스터드 1칸 = 64px. map(밝기)와 bump(높이)를 따로 굽는다.
  function studCanvas(kind) {
    const S = 64, cv = canvas(S), g = cv.getContext('2d');
    const bump = kind === 'bump';
    g.fillStyle = bump ? '#7a7a7a' : '#ffffff';
    g.fillRect(0, 0, S, S);
    // 타일 경계(브릭 이음선)
    g.strokeStyle = bump ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.07)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, S, S);
    // 돌기
    const grd = g.createRadialGradient(S * 0.4, S * 0.36, 2, S * 0.5, S * 0.5, S * 0.34);
    if (bump) { grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#9a9a9a'); }
    else { grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#d2d2d2'); }
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.31, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = bump ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.16)';
    g.lineWidth = bump ? 4 : 2;
    g.stroke();
    return cv;
  }

  // 매끈한 타일(스터드 없는 바닥) — 이음선만
  function tileCanvas(kind) {
    const S = 64, cv = canvas(S), g = cv.getContext('2d');
    const bump = kind === 'bump';
    g.fillStyle = bump ? '#c0c0c0' : '#ffffff';
    g.fillRect(0, 0, S, S);
    // 판 경계(홈): 색은 살짝, 요철은 뚜렷하게
    g.strokeStyle = bump ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.20)';
    g.lineWidth = 4;
    g.strokeRect(0, 0, S, S);
    // 안쪽에 아주 옅은 하이라이트를 넣어 판이 평평해 보이지 않게
    if (!bump) {
      const gg = g.createLinearGradient(0, 0, S, S);
      gg.addColorStop(0, 'rgba(255,255,255,0.10)');
      gg.addColorStop(1, 'rgba(0,0,0,0.05)');
      g.fillStyle = gg;
      g.fillRect(3, 3, S - 6, S - 6);
    }
    return cv;
  }

  function sharedTexture(key, maker, srgb) {
    if (!texCache.has(key)) texCache.set(key, finishTexture(maker(), 1, 1, srgb));
    return texCache.get(key);
  }

  // 판 크기에 맞춰 repeat 를 바꿔야 하므로 텍스처는 clone 해서 쓴다.
  function surfaceTextures(kind, repeatX, repeatY) {
    const base = kind === 'tile'
      ? { map: sharedTexture('tile-map', () => tileCanvas('map'), true), bump: sharedTexture('tile-bump', () => tileCanvas('bump')) }
      : { map: sharedTexture('stud-map', () => studCanvas('map'), true), bump: sharedTexture('stud-bump', () => studCanvas('bump')) };
    const map = base.map.clone();
    const bump = base.bump.clone();
    map.needsUpdate = bump.needsUpdate = true;
    map.repeat.set(repeatX, repeatY);
    bump.repeat.set(repeatX, repeatY);
    return { map, bump };
  }

  // ---------------------------------------------------------------- 머티리얼
  const matCache = new Map();

  /** 단색 플라스틱. finish: 'plastic' | 'matte' | 'glass' | 'metal' | 'glow' */
  function mat(color, finish) {
    finish = finish || 'plastic';
    const key = color + ':' + finish;
    if (matCache.has(key)) return matCache.get(key);
    let m;
    if (finish === 'glass') {
      m = new THREE.MeshPhongMaterial({
        color, specular: 0xffffff, shininess: 140, transparent: true,
        opacity: 0.42, side: THREE.DoubleSide,
      });
    } else if (finish === 'glow') {
      m = new THREE.MeshBasicMaterial({ color });
    } else if (finish === 'metal') {
      m = new THREE.MeshPhongMaterial({ color, specular: 0xdddddd, shininess: 200, reflectivity: 1 });
    } else if (finish === 'matte') {
      m = new THREE.MeshPhongMaterial({ color, specular: 0x1a1a1a, shininess: 8 });
    } else {
      m = new THREE.MeshPhongMaterial({ color, specular: 0xa6a6a6, shininess: 84 });
    }
    matCache.set(key, m);
    return m;
  }

  /** 위쪽 면에만 스터드/타일 무늬가 들어간 6면 머티리얼 배열 */
  function surfaceMaterials(color, kind, repeatX, repeatY, finish) {
    repeatX = Math.max(1, Math.round(repeatX));
    repeatY = Math.max(1, Math.round(repeatY));
    const side = mat(color, finish);
    const { map, bump } = surfaceTextures(kind, repeatX, repeatY);
    const top = new THREE.MeshPhongMaterial({
      color, map, bumpMap: bump, bumpScale: kind === 'tile' ? 0.12 : 0.18,
      specular: 0x8f8f8f, shininess: finish === 'matte' ? 10 : 60,
    });
    // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z, -Z
    return [side, side, top, side, side, side];
  }

  /** 모든 면에 스터드 무늬가 들어간 단일 머티리얼 (InstancedMesh 는 머티리얼 배열을 못 쓴다) */
  const studAllCache = new Map();
  function studAllMaterial(color, repeat) {
    const key = color + '|' + repeat;
    if (studAllCache.has(key)) return studAllCache.get(key);
    const { map, bump } = surfaceTextures('stud', repeat, repeat);
    const m = new THREE.MeshPhongMaterial({
      color, map, bumpMap: bump, bumpScale: 0.16, specular: 0x8a8a8a, shininess: 40,
    });
    studAllCache.set(key, m);
    return m;
  }

  // ---------------------------------------------------------------- 지오메트리
  const boxCache = new Map();
  function box(w, h, d) {
    const key = w.toFixed(3) + 'x' + h.toFixed(3) + 'x' + d.toFixed(3);
    if (!boxCache.has(key)) boxCache.set(key, new THREE.BoxGeometry(w, h, d));
    return boxCache.get(key);
  }

  const cylCache = new Map();
  function cyl(rTop, rBot, h, seg) {
    seg = seg || 12;
    const key = [rTop, rBot, h, seg].join('|');
    if (!cylCache.has(key)) cylCache.set(key, new THREE.CylinderGeometry(rTop, rBot, h, seg));
    return cylCache.get(key);
  }

  const sphCache = new Map();
  function sph(r, seg) {
    seg = seg || 14;
    const key = r + '|' + seg;
    if (!sphCache.has(key)) sphCache.set(key, new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)));
    return sphCache.get(key);
  }

  // ---------------------------------------------------------------- 부품
  /**
   * 스터드가 실제로 튀어나온 브릭(가까이서 보는 부품용).
   * w,d = 스터드 칸수, hUnits = 브릭 단수(1 = 브릭 하나, 1/3 = 플레이트)
   */
  function brick(color, w, d, hUnits, opts) {
    opts = opts || {};
    const h = BRICK * (hUnits === undefined ? 1 : hUnits);
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(w * STUD, h, d * STUD), mat(color, opts.finish));
    body.castShadow = opts.shadow !== false;
    body.receiveShadow = opts.shadow !== false;
    g.add(body);
    if (opts.studs !== false) {
      const sg = cyl(0.3, 0.3, 0.18, 10);
      const sm = mat(color, opts.finish);
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          const s = new THREE.Mesh(sg, sm);
          s.position.set((x - (w - 1) / 2) * STUD, h / 2 + 0.09, (z - (d - 1) / 2) * STUD);
          s.castShadow = false;
          g.add(s);
        }
      }
    }
    g.userData.height = h;
    return g;
  }

  /**
   * 넓은 판(도로·잔디·바닥). 스터드는 텍스처로 처리해서 가볍다.
   * kind: 'stud' | 'tile' | 'flat'
   */
  function plate(color, w, d, opts) {
    opts = opts || {};
    const h = opts.height === undefined ? PLATE : opts.height;
    const kind = opts.kind || 'stud';
    const scale = opts.tileScale || 1;   // 무늬 한 칸을 몇 스터드로 볼지
    const geo = box(w * STUD, h, d * STUD);
    const m = kind === 'flat'
      ? mat(color, opts.finish)
      : surfaceMaterials(color, kind, w / scale, d / scale, opts.finish);
    const mesh = new THREE.Mesh(geo, m);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  /**
   * 넓은 판 위에 "진짜" 돌기를 심는다. 실물 레고 사진의 질감은 여기서 나온다.
   * area = {x0,x1,z0,z1}, y = 판 윗면 높이. 전부 합쳐 InstancedMesh 하나(드로우콜 1).
   * opts.skip(x, z) 가 true 를 주면 그 자리는 비운다(건물 아래 등).
   */
  function studField(color, area, y, opts) {
    opts = opts || {};
    const step = opts.step || STUD;
    const seg = opts.segments || 8;
    const r = opts.radius || 0.31;
    const h = opts.height || 0.2;
    const max = opts.max || 4000;
    const xs = [], zs = [];
    for (let x = area.x0 + step * 0.5; x < area.x1; x += step) {
      for (let z = area.z0 + step * 0.5; z < area.z1; z += step) {
        if (opts.skip && opts.skip(x, z)) continue;
        xs.push(x); zs.push(z);
        if (xs.length >= max) break;
      }
      if (xs.length >= max) break;
    }
    const count = xs.length;
    if (count === 0) return null;
    const inst = new THREE.InstancedMesh(cyl(r, r, h, seg), mat(color, opts.finish), count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeTranslation(xs[i], y + h * 0.5, zs[i]);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.userData.count = count;
    return inst;
  }

  /** 1x1 라운드 브릭(스터드 알맹이) — 몬스터가 떨어뜨리는 수집품 */
  function roundStud(color, scale) {
    const s = scale || 1;
    const m = new THREE.Mesh(cyl(0.42 * s, 0.42 * s, 0.5 * s, 12), mat(color));
    const top = new THREE.Mesh(cyl(0.29 * s, 0.29 * s, 0.2 * s, 12), mat(color));
    top.position.y = 0.34 * s;
    const g = new THREE.Group();
    g.add(m, top);
    return g;
  }

  /** 미니피그 손: C 자 클로. 사진 앞쪽 노란 손 그대로. */
  function clawHand(color) {
    const geo = new THREE.TorusGeometry(0.42, 0.16, 10, 20, Math.PI * 1.45);
    const h = new THREE.Mesh(geo, mat(color === undefined ? COLORS.yellow : color));
    h.castShadow = true;
    return h;
  }

  /** 미니피그 얼굴 텍스처 (눈 + 웃는 입) */
  function faceTexture(style) {
    const key = 'face-' + style;
    if (texCache.has(key)) return texCache.get(key);
    const S = 128, cv = canvas(S), g = cv.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#2a1c10';
    // 눈
    g.beginPath(); g.arc(S * 0.36, S * 0.42, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(S * 0.64, S * 0.42, 7, 0, Math.PI * 2); g.fill();
    // 입
    g.lineWidth = 5; g.strokeStyle = '#2a1c10'; g.beginPath();
    if (style === 'worry') g.arc(S * 0.5, S * 0.75, 15, Math.PI * 1.15, Math.PI * 1.85);
    else g.arc(S * 0.5, S * 0.56, 17, 0.25 * Math.PI, 0.75 * Math.PI);
    g.stroke();
    if (style === 'police') { // 콧수염
      g.fillRect(S * 0.4, S * 0.52, S * 0.2, 5);
    }
    const t = finishTexture(cv, 1, 1, true);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    texCache.set(key, t);
    return t;
  }

  /** 글자 판(POLICE 간판 등) */
  function signTexture(text, bg, fg) {
    const key = 'sign-' + text + bg + fg;
    if (texCache.has(key)) return texCache.get(key);
    const W = 512, H = 128, cv = canvas(W);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = fg;
    g.font = 'bold 84px Arial, Helvetica, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.letterSpacing = '10px';
    g.fillText(text, W / 2, H / 2 + 4);
    const t = finishTexture(cv, 1, 1, true);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    texCache.set(key, t);
    return t;
  }

  function signPanel(text, w, h, bg, fg) {
    const m = new THREE.MeshPhongMaterial({
      map: signTexture(text, bg, fg), specular: 0x777777, shininess: 60,
    });
    const mesh = new THREE.Mesh(box(w, h, 0.25), m);
    return mesh;
  }

  L.STUD = STUD;
  L.PLATE = PLATE;
  L.BRICK = BRICK;
  L.COLORS = COLORS;
  L.mat = mat;
  L.box = box;
  L.cyl = cyl;
  L.sph = sph;
  L.brick = brick;
  L.plate = plate;
  L.studField = studField;
  L.studAllMaterial = studAllMaterial;
  L.roundStud = roundStud;
  L.clawHand = clawHand;
  L.faceTexture = faceTexture;
  L.signPanel = signPanel;
  L.surfaceMaterials = surfaceMaterials;
})(window.LEGO);
