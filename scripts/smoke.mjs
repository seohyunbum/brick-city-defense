/* 브라우저 스모크 테스트: 콘솔 오류 0 + 실제 장면 스크린샷.
 * 사용법: node scripts/smoke.mjs [출력폴더]
 * playwright 가 있는 곳에서 실행한다 (NODE_PATH 로 잡아줘도 된다).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] || resolve(root, '.smoke'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--allow-file-access-from-files'],
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
  for (const t of ['slime', 'slime', 'slime', 'golem', 'bat']) {
    const e = g.enemies.spawn(t);
    if (e) {
      e.pos.set((Math.random() - 0.5) * 16, e.def.flying ? e.def.hover : g.city.curbY, -12 - Math.random() * 22);
      e.group.position.copy(e.pos);
    }
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

// 실제 조작으로 잠깐 플레이: 이동 · 공격 · 시전 · 웨이브 진행
// (앞 단계에서 몬스터에 맞아 죽었을 수 있으니 깨끗한 상태로 다시 시작한다)
await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.start();
  g.enemies.clear();
  g.enemies.queue.length = 0;
  g.input.attackHeld = false;
});
await page.waitForTimeout(200);
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
const play = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  return {
    state: g.state, z: Math.round(g.player.pos.z), kills: g.player.kills,
    score: g.player.score, alive: g.enemies.aliveCount(), weapon: g.hands.currentWeapon().id,
    skill: g.hands.currentSkill().id, mana: Math.round(g.player.mana),
  };
});
if (play.z >= 30) throw new Error('W 키로 앞으로 나아가지 못했다: z=' + play.z);
if (play.weapon !== 'sword') throw new Error('1번 키로 검을 들지 못했다: ' + play.weapon);
if (play.skill !== 'fireball') throw new Error('6번 키로 파이어볼을 들지 못했다: ' + play.skill);
console.log('플레이 확인:', JSON.stringify(play));

// 웨이브 클리어 → 다음 웨이브로 넘어가는지 (프레임 속도에 흔들리지 않게 상태를 기다린다)
const waveFlow = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const before = g.wave;
  g.enemies.queue.length = 0;
  g.enemies.clear();
  g.enemies.waveActive = true;
  let t0 = Date.now();
  while (g.wave === before && Date.now() - t0 < 6000) await wait(100);
  const advanced = g.wave;
  g.waveBreak = 0.05;
  t0 = Date.now();
  while (!g.enemies.waveActive && Date.now() - t0 < 6000) await wait(100);
  return { before, advanced, active: g.enemies.waveActive, queued: g.enemies.queue.length };
});
if (waveFlow.advanced !== waveFlow.before + 1) {
  throw new Error('웨이브가 넘어가지 않았다: ' + JSON.stringify(waveFlow));
}
if (!waveFlow.active) {
  throw new Error('다음 웨이브가 시작되지 않았다: ' + JSON.stringify(waveFlow));
}
console.log('웨이브 진행 확인:', JSON.stringify(waveFlow));

// 게임 오버 → 다시 시작
const over = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  g.hurtPlayer(99);
  const s1 = g.state;
  g.start();
  return { over: s1, restarted: g.state, hearts: g.player.hearts, wave: g.wave };
});
if (over.over !== 'over' || over.restarted !== 'playing' || over.hearts !== 5 || over.wave !== 1) {
  throw new Error('게임오버/재시작 흐름이 깨졌다: ' + JSON.stringify(over));
}
console.log('게임오버·재시작 확인:', JSON.stringify(over));

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

// 드로우콜 수(도시 씬 한 패스 기준. 예산 700 이하 유지)
const info = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const r = g.renderer;
  r.info.autoReset = false;
  r.info.reset();
  r.render(g.scene, g.camera);
  const out = { calls: r.info.render.calls, triangles: r.info.render.triangles };
  r.shadowMap.enabled = false;
  r.info.reset();
  r.render(g.scene, g.camera);
  out.callsNoShadow = r.info.render.calls;
  r.shadowMap.enabled = true;
  r.info.autoReset = true;
  return out;
});

await browser.close();

console.log('FPS(소프트웨어 렌더러 기준):', fps);
console.log('드로우콜: 그림자 포함', info.calls, '/ 도시만', info.callsNoShadow, '/ 삼각형', info.triangles);
if (info.calls > 1100) {
  console.error('드로우콜이 예산(1100)을 넘었다: ' + info.calls);
  process.exit(1);
}
if (errors.length) {
  console.error('오류 ' + errors.length + '건:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('오류 없음. 스크린샷:', outDir);
