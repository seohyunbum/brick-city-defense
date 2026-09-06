/* 86호기 조종 모드 브라우저 스모크.
 *   - file:// 로 열어 조종석(1인칭)에 앉는다
 *   - 콘솔 오류 0
 *   - 무리가 등장하고, 기관총과 칼로 실제로 쓰러진다(브릭이 흩어진다)
 *   - 걸으면 실제로 이동하고 조종석 카메라가 유한한 값을 유지한다(스프링 발산 방지)
 *   - 장갑이 다 닳아도 게임오버가 아니라 수리 후 계속된다
 *   - 실제 렌더 패스가 드로우콜/삼각형 예산 안에 있다
 *   - 단편으로 돌아가면 배우와 하늘이 제자리로 돌아온다
 * 사용법: node scripts/smoke-pilot.mjs [출력폴더]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] || resolve(root, '.smoke-pilot'));
mkdirSync(outDir, { recursive: true });

const MAX_DRAWCALLS = 650;
const MAX_TRIANGLES = 125000;

const hardwareProbe = process.env.SMOKE_RENDERER === 'hardware';
const browserArgs = ['--allow-file-access-from-files'];
if (!hardwareProbe) browserArgs.push('--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: browserArgs,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
const failures = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('file://' + resolve(root, 'story.html'));
await page.waitForFunction(() => !!window.BRICK_STORY, null, { timeout: 30000 });

// ---- 조종석 진입
await page.click('#btn-start-play');
// 느린 CI 에서는 첫 프레임이 늦게 온다 — 조종석 카메라가 자리를 잡을 때까지 기다린다
await page.waitForFunction(() => {
  const a = window.BRICK_STORY;
  return a.mode === 'pilot' && a.pilot.active
    && Math.abs(a.camera.position.y - (a.pilot.mech.position.y + 8.4)) < 1.5;
}, null, { timeout: 60000 }).catch(() => {});
const entered = await page.evaluate(() => {
  const a = window.BRICK_STORY, p = a.pilot;
  return {
    mode: a.mode, active: p.active, hearts: p.hearts,
    hudHidden: document.getElementById('pilot-hud').classList.contains('hidden'),
    camY: a.camera.position.y, mech: p.mech.position.toArray(),
  };
});
if (entered.mode !== 'pilot' || !entered.active) failures.push('조종 모드로 들어가지 못했다');
if (entered.hudHidden) failures.push('조종 HUD 가 보이지 않는다');
if (!(entered.camY > 6 && entered.camY < 12)) failures.push(`조종석 눈높이가 이상하다: ${entered.camY}`);
await page.screenshot({ path: resolve(outDir, '01-cockpit.png') });

// ---- 웨이브 등장
await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  p.legion.startWave(p.mech.position);
});
await page.waitForTimeout(3500);
const wave = await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  return { alive: p.legion.aliveCount(), left: p.legion.spawnLeft, wave: p.legion.wave };
});
if (wave.alive + wave.left < 3) failures.push(`무리가 등장하지 않았다: ${JSON.stringify(wave)}`);
await page.screenshot({ path: resolve(outDir, '02-wave.png') });

// ---- 걷기: 실제로 이동하고 카메라가 발산하지 않는다
// (소프트웨어 렌더러는 프레임이 들쭉날쭉하다 — 시간이 아니라 조건으로 기다린다)
await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  window.__walkFrom = p.mech.position.clone();
  p.input.keys.KeyW = true;
});
const walked = await page.waitForFunction(() => {
  const a = window.BRICK_STORY, p = a.pilot;
  const moved = p.mech.position.distanceTo(window.__walkFrom);
  const camFinite = Number.isFinite(a.camera.position.y) && Math.abs(a.camera.position.y) < 1000;
  if (!camFinite) return { moved, camFinite: false };
  return moved > 1.5 ? { moved, camFinite: true } : false;
}, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => ({ moved: 0, camFinite: true }));
await page.evaluate(() => { window.BRICK_STORY.pilot.input.keys.KeyW = false; });
if (walked.moved <= 1.5) failures.push(`전진 입력에도 86호기가 걷지 않았다: ${walked.moved.toFixed(2)}`);
if (!walked.camFinite) failures.push('조종석 카메라가 발산했다(스프링 적분 불안정)');

// ---- 기관총: 조준한 기계가 실제로 쓰러진다
await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  let best = null, bd = 1e9;
  for (const u of p.legion.units) {
    if (!u.alive) continue;
    const d = u.group.position.distanceTo(p.mech.position);
    if (d < bd) { bd = d; best = u; }
  }
  if (best) {
    // 눈앞으로 끌어와 조준한다. 조종석은 기계보다 훨씬 높으므로 내려다보는 각을 계산해 넣는다.
    const range = 22;
    best.group.position.set(p.mech.position.x, 0, p.mech.position.z - range);
    p.yaw = 0;
    p.mech.rotation.y = 0;
    p.pitch = Math.atan2(3.4 - (p.mech.position.y + 8.4), range);
  }
  window.__killsBefore = p.kills;
  p.input.attackHeld = true;
});
const gun = await page.waitForFunction(() => {
  const p = window.BRICK_STORY.pilot;
  const downed = p.kills - window.__killsBefore;
  return downed > 0 ? { downed, heat: p.heat } : false;
}, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => ({ downed: 0, heat: 0 }));
await page.evaluate(() => { window.BRICK_STORY.pilot.input.attackHeld = false; });
if (gun.downed < 1) failures.push('기관총으로 기계를 쓰러뜨리지 못했다');
if (!(gun.heat > 0)) failures.push('기관총을 쏴도 총열 온도가 오르지 않는다');
await page.screenshot({ path: resolve(outDir, '03-gun.png') });

// ---- 칼: 부채꼴 안의 기계를 벤다
const staged = await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  if (p.legion.aliveCount() === 0) p.legion.startWave(p.mech.position);
  window.__swordBefore = p.kills;
  p.input.castHeld = true;
  return p.legion.aliveCount();
});
// 기계가 아직 걸어오는 중일 수 있으므로, 매번 앞으로 끌어다 놓으며 격파를 기다린다
const sword = await page.waitForFunction(() => {
  const p = window.BRICK_STORY.pilot;
  let n = 0;
  for (const u of p.legion.units) {
    if (!u.alive) continue;
    u.group.position.set(p.mech.position.x + n * 2 - 2, 0, p.mech.position.z - 9);
    n++;
  }
  const downed = p.kills - window.__swordBefore;
  return downed > 0 ? { downed, staged: n } : false;
}, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => ({ downed: 0, staged: 0 }));
await page.evaluate(() => { window.BRICK_STORY.pilot.input.castHeld = false; });
if (sword.downed < 1) failures.push('칼을 휘둘러도 기계가 쓰러지지 않았다');
void staged;
await page.screenshot({ path: resolve(outDir, '04-sword.png') });

// ---- 게임오버가 없다: 장갑이 0 이 되면 수리하고 계속한다
const inRepair = await page.evaluate(() => {
  const p = window.BRICK_STORY.pilot;
  for (let i = 0; i < 8; i++) { p.invuln = 0; p.hurt(1); }
  return p.repair > 0 && p.active;
});
if (!inRepair) failures.push('장갑이 0 이 되어도 수리 상태로 들어가지 않았다');
// 수리가 끝나면 장갑이 돌아오고 그대로 계속된다(게임오버 화면 없음)
const repaired = await page.waitForFunction(() => {
  const p = window.BRICK_STORY.pilot;
  return p.repair <= 0 && p.hearts > 0 && p.active ? p.hearts : false;
}, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => 0);
if (!repaired) failures.push('수리가 끝나도 진행이 이어지지 않았다(게임오버는 없어야 한다)');

// ---- 예산: 최대 정원(10대)을 눈앞에 세운 최악의 프레임으로 잰다
await page.evaluate(async () => {
  const p = window.BRICK_STORY.pilot;
  p.repair = 0;
  p.hearts = 5;
  p.legion.spawnLeft = 0;
  for (let i = 0; i < p.legion.units.length; i++) {
    const u = p.legion.units[i];
    u.alive = true;
    u.hp = 99;
    u.group.visible = true;
    const a = (i / p.legion.units.length - 0.5) * 1.2;
    u.group.position.set(p.mech.position.x + Math.sin(a) * 26, 0, p.mech.position.z - Math.cos(a) * 26);
  }
  p.yaw = 0;
  p.mech.rotation.y = 0;
  p.burstProbe = true;
  await new Promise((r) => setTimeout(r, 1200));
});
await page.screenshot({ path: resolve(outDir, '04b-full-wave.png') });
const budget = await page.evaluate(() => ({
  calls: window.BRICK_STORY.renderer.info.render.calls,
  triangles: window.BRICK_STORY.renderer.info.render.triangles,
  enemies: window.BRICK_STORY.pilot.legion.aliveCount(),
}));
if (budget.enemies < 10) failures.push(`최대 정원 프레임을 만들지 못했다: ${budget.enemies}`);
if (budget.calls > MAX_DRAWCALLS) failures.push(`드로우콜 예산 초과: ${budget.calls}`);
if (budget.triangles > MAX_TRIANGLES) failures.push(`삼각형 예산 초과: ${budget.triangles}`);

// ---- 단편으로 복귀: Esc 로 나간다(무대가 정리되는지 본다)(포인터 락이 잡혀 있으면 락부터 풀린다)
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
if (await page.evaluate(() => window.BRICK_STORY.mode === 'pilot')) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
if (await page.evaluate(() => window.BRICK_STORY.mode === 'pilot')) {
  await page.click('#btn-play-mode');
}
await page.waitForTimeout(600);
const back = await page.evaluate(() => {
  const a = window.BRICK_STORY;
  return {
    mode: a.mode,
    hudHidden: document.getElementById('pilot-hud').classList.contains('hidden'),
    legionAlive: a.pilot.legion.aliveCount(),
    swordHidden: !a.pilot.weapons.shoulder.visible,
    citizens: a.story.citizens.filter((c) => c.visible).length,
  };
});
if (back.mode !== 'film') failures.push('단편으로 돌아오지 못했다');
if (!back.hudHidden) failures.push('단편으로 돌아왔는데 조종 HUD 가 남아 있다');
if (back.legionAlive !== 0) failures.push('단편으로 돌아왔는데 기계가 남아 있다');
if (!back.swordHidden) failures.push('단편에서 칼이 그대로 매달려 있다');
if (back.citizens === 0) failures.push('단편으로 돌아왔는데 시민이 보이지 않는다');
await page.screenshot({ path: resolve(outDir, '05-back-to-film.png') });

await browser.close();

if (errors.length) failures.push(...errors);
if (failures.length) {
  console.error(`조종 모드 스모크 실패 ${failures.length}건`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`조종 모드 스모크 통과: 웨이브 ${wave.wave}, 기관총 격파 ${gun.downed}, 칼 격파 ${sword.downed}, ` +
  `이동 ${walked.moved.toFixed(1)} 유닛, 수리 후 장갑 ${repaired}, ` +
  `기계 ${budget.enemies}대 동시 프레임 드로우콜 ${budget.calls}/${MAX_DRAWCALLS}, ` +
  `삼각형 ${budget.triangles}/${MAX_TRIANGLES}`);
