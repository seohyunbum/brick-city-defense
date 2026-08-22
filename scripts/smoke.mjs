/* 브라우저 스모크 테스트: 콘솔 오류 0 + 실제 장면 스크린샷.
 * 사용법: node scripts/smoke.mjs [출력폴더]
 * playwright 가 있는 곳에서 실행한다 (NODE_PATH 로 잡아줘도 된다).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_DRAWCALLS = 650;
const MAX_TRIANGLES = 125000;
const soakMs = Math.max(0, Number(process.env.SMOKE_SOAK_MS || 3000));

const root = resolve(here, '..');
const outDir = resolve(process.argv[2] || resolve(root, '.smoke'));
mkdirSync(outDir, { recursive: true });

const hardwareProbe = process.env.SMOKE_RENDERER === 'hardware';
const browserArgs = ['--allow-file-access-from-files'];
if (!hardwareProbe) browserArgs.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: browserArgs,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// 포인터 락이 헤드리스에서 풀리면 일시정지로 넘어가므로, 스크린샷 전에 되돌린다
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('file://' + resolve(root, 'index.html'));
await page.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 20000 });
// 소프트웨어 렌더러는 항상 느리다 — 자동 품질 저하를 끄고 최고 품질로 확인한다
await page.evaluate(() => { window.LEGO_GAME.autoQuality = false; });
await page.waitForTimeout(1200);
await page.screenshot({ path: resolve(outDir, '01-start.png') });

// 게임 시작 (포인터 락 없이 상태만 진행)
await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.start();
  g.player.pos.set(0, 5.15, 26);
  g.player.yaw = 0;
  g.player.pitch = -0.06;
});
await page.waitForTimeout(900);
await page.screenshot({ path: resolve(outDir, '02-first-person.png') });

// 몬스터를 눈앞에 불러서 전투 화면
await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const at = new THREE.Vector3();
  for (const t of ['slime', 'slime', 'slime', 'golem', 'bat']) {
    at.set(g.player.pos.x + (Math.random() - 0.5) * 16, 0, g.player.pos.z - 12 - Math.random() * 22);
    g.enemies.spawnAt(t, at, { level: 1 });
  }
});
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(outDir, '03-monsters.png') });

// 오른손 무기 3종
const weapons = ['sword', 'blaster', 'bomb'];
for (let i = 0; i < weapons.length; i++) {
  await page.evaluate((i) => {
    const g = window.LEGO_GAME;
    g.hands.setWeapon(i);
    g.player.weaponCd = 0;
  }, i);
  await page.waitForTimeout(420);
  await page.evaluate(() => window.LEGO_GAME.attack());
  await page.waitForTimeout(120);
  await page.screenshot({ path: resolve(outDir, `04-weapon-${weapons[i]}.png`) });
}

// 손 모양 확인용: 하늘을 배경으로 두 손을 크게 본다
for (let i = 0; i < weapons.length; i++) {
  await page.evaluate((i) => {
    const g = window.LEGO_GAME;
    if (g.state !== 'playing') { g.state = 'playing'; g.hud.screen(null); g.hud.show(true); }
    g.hands.setWeapon(i);
    g.player.pitch = 0.34;
  }, i);
  await page.waitForTimeout(420);
  await page.screenshot({ path: resolve(outDir, `07-hands-${weapons[i]}.png`) });
}
await page.evaluate(() => { window.LEGO_GAME.player.pitch = -0.06; });

// 왼손 두루마리 3종
const skills = ['dragonfire', 'meteor', 'fireball'];
for (let i = 0; i < skills.length; i++) {
  await page.evaluate((i) => {
    const g = window.LEGO_GAME;
    g.hands.setSkill(i);
    g.player.mana = 100;
    g.skillCd[g.hands.currentSkill().id] = 0;
    g.player.channelTimer = 0;
  }, i);
  await page.waitForTimeout(420);
  await page.evaluate(() => window.LEGO_GAME.cast());
  await page.waitForTimeout(i === 1 ? 900 : 260);
  await page.screenshot({ path: resolve(outDir, `05-skill-${skills[i]}.png`) });
}

// 실제 조작으로 잠깐 플레이: 이동 · 공격 · 시전
// (앞 단계에서 몬스터에 맞아 죽었을 수 있으니 깨끗한 상태로 다시 시작한다)
await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.start();
  g.enemies.clear();
  g.input.attackHeld = false;
});
await page.waitForTimeout(200);
// 이동 판정 기준점 — 소프트웨어 렌더는 프레임이 느려 '이동 거리'가 하드웨어와 다르다.
// 그래서 절대 거리가 아니라 '앞으로 간 성분'으로 판정한다.
const pre = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  return { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw };
});
await page.keyboard.down('KeyW');
await page.mouse.move(700, 450);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.mouse.up();
await page.keyboard.up('KeyW');
await page.keyboard.press('Digit1');
await page.keyboard.press('Digit6');
await page.keyboard.down('Space');
await page.waitForTimeout(700);
await page.keyboard.up('Space');
const play = await page.evaluate((pre) => {
  const g = window.LEGO_GAME;
  const dx = g.player.pos.x - pre.x, dz = g.player.pos.z - pre.z;
  // yaw 규약: 앞 = (-sin(yaw), -cos(yaw))  (game.js updatePlayer)
  const fx = -Math.sin(pre.yaw), fz = -Math.cos(pre.yaw);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    state: g.state,
    moved: r1(Math.hypot(dx, dz)),
    forward: r1(dx * fx + dz * fz),
    weapon: g.hands.currentWeapon().id, skill: g.hands.currentSkill().id,
    mana: Math.round(g.player.mana),
  };
}, pre);
if (play.forward < 2) {
  throw new Error('W 키로 앞으로 나아가지 못했다: 전진성분=' + play.forward + ' 총이동=' + play.moved);
}
if (play.weapon !== 'sword') throw new Error('1번 키로 검을 들지 못했다: ' + play.weapon);
if (play.skill !== 'fireball') throw new Error('6번 키로 파이어볼을 들지 못했다: ' + play.skill);
console.log('플레이 확인:', JSON.stringify(play));

// ---------------------------------------------------------------- 오픈월드 계약
// 아래 4개는 GAME_DESIGN_SPEC 2.0 의 판정 기준이다.
// 1.x 의 웨이브/지원선택/게임오버 검증은 계약이 뒤집혀 있었으므로 제거했다.

// (1) 자유 이동 — 스폰에서 멀리 갈 수 있고, 청크는 유지 반경 안으로 제한된다
const roam = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  g.start();
  const sp = g.world.spawnPoint();
  g.player.pos.set(sp.x + 520, g.player.pos.y, sp.z + 520);
  g.world.prime(g.player.pos.x, g.player.pos.z);
  await wait(150);
  const st = g.world.stats();
  const b = g.world.bounds;
  return {
    far: Math.round(Math.hypot(g.player.pos.x - sp.x, g.player.pos.z - sp.z)),
    chunks: st.chunks, meshes: st.meshes,
    worldSize: b.maxX - b.minX, state: g.state,
  };
});
if (roam.state !== 'playing' || roam.far < 500) {
  throw new Error('자유 이동 실패(월드를 가로지르지 못했다): ' + JSON.stringify(roam));
}
if (roam.worldSize < 2000) {
  throw new Error('월드가 규격(2048)보다 작다: ' + JSON.stringify(roam));
}
if (roam.chunks < 20 || roam.chunks > 49) {
  throw new Error('청크 스트리밍이 유지 반경을 벗어났다: ' + JSON.stringify(roam));
}
console.log('자유 이동·스트리밍 확인:', JSON.stringify(roam));
await page.screenshot({ path: resolve(outDir, '08-openworld-roam.png') });

// (2) 게임오버 없음 — 쓰러져도 진행이 끊기지 않는다 (SPEC 9장)
const noGameOver = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.start();
  g.hurtPlayer(99);
  return { state: g.state, hearts: g.player.hearts };
});
if (noGameOver.state !== 'playing' || noGameOver.hearts <= 0) {
  throw new Error('게임오버가 진행을 차단했다(오픈월드 위반): ' + JSON.stringify(noGameOver));
}
console.log('게임오버 없음 확인:', JSON.stringify(noGameOver));

// (3) 전투는 선택 — 시작 직후 자동으로 몬스터가 나오지 않는다
const peaceful = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  g.start();
  await wait(1600);
  return { alive: g.enemies.aliveCount(), safe: g.director.safe, district: g.director.label, state: g.state };
});
if (peaceful.alive !== 0 || !peaceful.safe) {
  throw new Error('시작하자마자 강제 전투가 걸렸다(오픈월드 위반): ' + JSON.stringify(peaceful));
}
console.log('전투 선택제 확인:', JSON.stringify(peaceful));

// (3.5) 위험 구역에는 실제로 몬스터가 산다 — 빈 월드를 합격시키지 않는다
const wilds = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  g.start();
  // 외곽(농장·공원 링)으로 이동 — 안전지대가 아닌 구역
  g.player.pos.set(-8 * 64 + 32, g.player.pos.y, -8 * 64 + 32);
  g.world.prime(g.player.pos.x, g.player.pos.z);
  await wait(6000);
  return {
    district: g.director.label,
    safe: g.director.safe,
    level: g.director.level,
    alive: g.enemies.aliveCount(),
    lord: !!(g.enemies.boss && g.enemies.boss.alive),
    state: g.state,
  };
});
if (wilds.safe || wilds.alive < 1) {
  throw new Error('위험 구역이 비어 있다(오픈월드에 할 일이 없다): ' + JSON.stringify(wilds));
}
if (wilds.state !== 'playing') {
  throw new Error('위험 구역에서 진행이 끊겼다: ' + JSON.stringify(wilds));
}
console.log('위험 구역 서식 확인:', JSON.stringify(wilds));

// (4) 월드 어느 지점에서도 렌더 예산 — 평균이 아니라 최악값으로 판정한다
const worldBudget = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pts = [[45, 32], [300, -260], [-520, 140], [-512, -512], [760, 0], [96, 512]];
  let worstCalls = 0, worstTris = 0, worstAt = null;
  for (const pt of pts) {
    g.player.pos.x = pt[0]; g.player.pos.z = pt[1];
    g.world.prime(pt[0], pt[1]);
    g.camera.position.set(pt[0], g.player.pos.y, pt[1]);
    await wait(40);
    const r = g.renderer;
    r.info.autoReset = false;
    r.info.reset();
    g.post.renderWorld(g.scene);
    r.clearDepth();
    r.render(g.hands.scene, g.hands.camera);
    const calls = r.info.render.calls, tris = r.info.render.triangles;
    r.info.autoReset = true;
    if (calls > worstCalls) { worstCalls = calls; worstAt = pt; }
    if (tris > worstTris) worstTris = tris;
  }
  return { worstCalls, worstTris, worstAt, samples: pts.length };
});
if (worldBudget.worstCalls > 650 || worldBudget.worstTris > 125000) {
  throw new Error('월드 렌더 예산 초과: ' + JSON.stringify(worldBudget));
}
console.log('월드 예산 확인(최악값):', JSON.stringify(worldBudget));

// 스폰 지점으로 되돌려 이후 검사를 깨끗한 상태에서 이어간다
await page.evaluate(() => { window.LEGO_GAME.start(); });
await page.waitForTimeout(150);

// 수집품 풀이 가득 차도 게임 보상이 사라지지 않고 즉시 지급돼야 한다.
const pickupOverflow = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.fx.clear();
  const spawned = g.fx.dropStud(g.player.pos, 'mana');
  const launched = g.fx.studs.find((stud) => stud.alive);
  const launchSpeed = launched ? launched.vel.length() : 0;
  g.fx.clear();
  for (const stud of g.fx.studs) stud.alive = true;
  g.player.mana = 0;
  const scoreBefore = g.player.score;
  const overflowPhysical = g.fx.dropStud(g.player.pos, 'mana');
  const result = {
    spawned,
    launchSpeed,
    overflowPhysical,
    overflow: g.fx.stats.studOverflowGrants,
    lost: g.fx.stats.studLost,
    mana: g.player.mana,
    scoreGain: g.player.score - scoreBefore,
  };
  g.fx.clear();
  return result;
});
if (pickupOverflow.spawned !== true || pickupOverflow.launchSpeed <= 0 || pickupOverflow.overflowPhysical !== false ||
    pickupOverflow.overflow !== 1 || pickupOverflow.lost !== 0 ||
    pickupOverflow.mana <= 0 || pickupOverflow.scoreGain !== 5) {
  throw new Error('수집품 풀 초과 보상 보존 실패: ' + JSON.stringify(pickupOverflow));
}
console.log('수집품 풀 초과 확인:', JSON.stringify(pickupOverflow));
// 오디오 할당 폭주 방지: 잡음 buffer는 하나, 활성 voice는 cap 이하여야 한다.
const audioGuard = await page.evaluate(() => {
  const sfx = window.LEGO_GAME.sfx;
  sfx.resume();
  for (let i = 0; i < 100; i++) sfx.flame();
  for (let i = 0; i < 100; i++) sfx.shoot();
  return {
    active: sfx.activeVoices,
    max: sfx.maxVoices,
    noiseSamples: sfx.noiseBuffer ? sfx.noiseBuffer.length : 0,
  };
});
if (audioGuard.active > audioGuard.max || audioGuard.noiseSamples <= 0) {
  throw new Error('오디오 voice/buffer guard 실패: ' + JSON.stringify(audioGuard));
}
if (soakMs) await page.waitForTimeout(soakMs);

// 성능: 3초 동안 프레임 수
const fps = await page.evaluate(async () => {
  let frames = 0;
  const t0 = performance.now();
  await new Promise((res) => {
    function tick() {
      frames++;
      if (performance.now() - t0 > 3000) res();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  return Math.round((frames / (performance.now() - t0)) * 1000);
});

// 뒤돌아 경찰서 쪽 보기
await page.evaluate(() => {
  const g = window.LEGO_GAME;
  if (g.state !== 'playing') { g.state = 'playing'; g.hud.screen(null); g.hud.show(true); }
  g.player.yaw = -0.9;
  g.player.pos.set(-4, 5.15, 22);
});
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(outDir, '06-police-station.png') });

// 실제 프레임의 world + postfx quad + hands 패스 합계를 잰다.
const info = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const r = g.renderer;
  r.info.autoReset = false;
  r.info.reset();
  g.post.renderWorld(g.scene);
  const worldCalls = r.info.render.calls;
  const worldTriangles = r.info.render.triangles;
  r.clearDepth();
  r.render(g.hands.scene, g.hands.camera);
  const physical = new Set();
  const rounded = new Set();
  const auditObject = (object) => {
    if (object.geometry?.type === 'RoundedBoxGeometry') rounded.add(object.geometry.uuid);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material?.isMeshPhysicalMaterial) physical.add(material.uuid);
  };
  g.scene.traverse(auditObject);
  g.hands.scene.traverse(auditObject);

  const sample = document.createElement('canvas');
  sample.width = 160; sample.height = 90;
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(r.domElement, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  let sum = 0, sumSq = 0, clipped = 0, crushed = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
    sum += lum; sumSq += lum * lum;
    if (lum > 0.985) clipped++;
    if (lum < 0.025) crushed++;
  }
  const mean = sum / count;
  const out = {
    calls: r.info.render.calls,
    triangles: r.info.render.triangles,
    worldCalls,
    worldTriangles,
    visual: {
      aces: r.toneMapping === THREE.ACESFilmicToneMapping,
      exposure: r.toneMappingExposure,
      environment: !!g.scene.environment,
      physicalMaterials: physical.size,
      roundedGeometries: rounded.size,
      aperture: g.post.material?.uniforms.uAperture.value ?? 0,
      maxBlur: g.post.material?.uniforms.uMaxBlur.value ?? 0,
      vignette: g.post.material?.uniforms.uVignette.value ?? 0,
      meanLuma: Number(mean.toFixed(4)),
      lumaStdDev: Number(Math.sqrt(Math.max(0, sumSq / count - mean * mean)).toFixed(4)),
      clippedRatio: Number((clipped / count).toFixed(4)),
      crushedRatio: Number((crushed / count).toFixed(4)),
      gpuRenderer: (() => {
        const gl = r.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      })(),
    },
  };
  r.info.autoReset = true;
  return out;
});
// CI software renderer에서 두 WebGL 게임을 동시에 돌리지 않는다.
await page.close();

// 저장소 접근이 차단돼도 부팅·플레이·점수 저장 흐름이 살아 있어야 한다.
const deniedErrors = [];
const denied = await browser.newPage({ viewport: { width: 1280, height: 720 } });
denied.on('console', (m) => { if (m.type() === 'error') deniedErrors.push('console: ' + m.text()); });
denied.on('pageerror', (e) => deniedErrors.push('pageerror: ' + e.message));
await denied.addInitScript(() => {
  const deny = () => { throw new DOMException('Storage denied for smoke', 'SecurityError'); };
  Storage.prototype.getItem = deny;
  Storage.prototype.setItem = deny;
});
await denied.goto('file://' + resolve(root, 'index.html'));
await denied.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 60000 });
const storageFlow = await denied.evaluate(() => {
  const g = window.LEGO_GAME;
  g.start();
  g.player.score = 321;
  g.recordBest();
  return {
    state: g.state,
    best: g.best,
    memory: window.LEGO.Storage._memory['brickcity-best'],
  };
});
if (storageFlow.state !== 'playing' || storageFlow.best !== 321 || storageFlow.memory !== '321') {
  throw new Error('저장소 차단 fallback 실패: ' + JSON.stringify(storageFlow));
}
if (deniedErrors.length) {
  throw new Error('저장소 차단 페이지 오류: ' + deniedErrors.join(' | '));
}
await denied.close();

await browser.close();

console.log(hardwareProbe ? 'FPS(로컬 하드웨어 프로브):' : 'FPS(소프트웨어 렌더러 기준):', fps);
console.log('렌더 패스 합계:', JSON.stringify(info));
console.log('그래픽 품질 계약:', JSON.stringify(info.visual));
const v = info.visual;
if (!v.aces || !v.environment || v.physicalMaterials < 12 || v.roundedGeometries < 12 ||
    v.aperture > 0.30 || v.maxBlur > 4.5 || v.vignette > 0.10 ||
    v.meanLuma < 0.30 || v.meanLuma > 0.86 || v.lumaStdDev < 0.12 ||
    v.clippedRatio > 0.28 || v.crushedRatio > 0.18) {
  console.error('그래픽 품질 계약 실패:', JSON.stringify(v));
  process.exit(1);
}
if (info.calls > MAX_DRAWCALLS) {
  console.error(`드로우콜이 예산(${MAX_DRAWCALLS})을 넘었다: ${info.calls}`);
  process.exit(1);
}
if (info.triangles > MAX_TRIANGLES) {
  console.error(`삼각형이 예산(${MAX_TRIANGLES})을 넘었다: ${info.triangles}`);
  process.exit(1);
}
if (errors.length) {
  console.error('오류 ' + errors.length + '건:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('오류 없음. 스크린샷:', outDir);
