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
// 이 페이지는 웨이브 루프·성능을 잰다. 첫 안내는 아래 전용 테스트에서 따로 확인한다.
await page.evaluate(() => window.LEGO.Settings.set('tutorial', false));
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
  const out = {
    calls: r.info.render.calls,
    triangles: r.info.render.triangles,
    worldCalls,
    worldTriangles,
  };
  r.info.autoReset = true;
  return out;
});
// CI software renderer에서 두 WebGL 게임을 동시에 돌리지 않는다.
await page.close();

// 설정: 키보드만으로 열고, 값이 실제 런타임에 적용되고 다시 열어도 남아 있는지 본다.
const settingsErrors = [];
const settingsPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
settingsPage.on('console', (m) => { if (m.type() === 'error') settingsErrors.push('console: ' + m.text()); });
settingsPage.on('pageerror', (e) => settingsErrors.push('pageerror: ' + e.message));
await settingsPage.goto('file://' + resolve(root, 'index.html'));
await settingsPage.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 60000 });

// 마우스 없이 Tab · Enter 만으로 설정 화면까지 간다
await settingsPage.keyboard.press('Tab');
await settingsPage.keyboard.press('Tab');
const focusBefore = await settingsPage.evaluate(() => document.activeElement && document.activeElement.id);
await settingsPage.keyboard.press('Enter');
await settingsPage.waitForTimeout(150);
const keyboardOpen = await settingsPage.evaluate(() => ({
  open: window.LEGO.SettingsUI.isOpen(),
  inSheet: !!(document.activeElement && document.activeElement.closest('#settings-screen')),
  dialog: document.getElementById('settings-screen').getAttribute('role'),
  startHidden: document.getElementById('start-screen').classList.contains('hidden'),
}));
if (focusBefore !== 'settings-btn' || !keyboardOpen.open || !keyboardOpen.inSheet) {
  throw new Error('키보드만으로 설정을 열지 못했다: ' + focusBefore + ' ' + JSON.stringify(keyboardOpen));
}
await settingsPage.screenshot({ path: resolve(outDir, '08-settings.png') });

// 값을 바꾸면 카메라 · 후처리 · 소리 · 난이도에 그대로 닿아야 한다
const applied = await settingsPage.evaluate(() => {
  const S = window.LEGO.Settings;
  const g = window.LEGO_GAME;
  S.set('uiScale', 150);
  S.set('fov', 90);
  S.set('sensitivity', 2);
  S.set('reducedMotion', true);
  S.set('quality', 'low');
  S.set('difficulty', 'easy');
  S.set('mute', true);
  g.sfx.resume();
  g.start();
  g.player.invuln = 0;
  g.hurtPlayer(1);
  return {
    uiScale: document.documentElement.style.getPropertyValue('--ui-scale'),
    motion: document.documentElement.dataset.motion,
    fov: Math.round(g.camera.fov),
    aperture: g.post.material ? g.post.material.uniforms.uAperture.value : -1,
    postEnabled: g.post.enabled,
    autoQuality: g.autoQuality,
    invuln: Number(g.player.invuln.toFixed(2)),
    masterGain: g.sfx.master ? g.sfx.master.gain.value : -1,
  };
});
// 쉬움 난이도의 피격 무적: PLAYER.hurtInvuln 1.1 × DIFFICULTY.easy.invulnScale 1.8
const expectedInvuln = 1.98;
if (applied.uiScale !== '1.50' || applied.motion !== 'reduced' || applied.fov !== 90) {
  throw new Error('설정이 문서·카메라에 적용되지 않았다: ' + JSON.stringify(applied));
}
if (applied.aperture !== 0 || applied.postEnabled !== false || applied.autoQuality !== false) {
  throw new Error('모션·품질 설정이 후처리에 적용되지 않았다: ' + JSON.stringify(applied));
}
if (applied.invuln !== expectedInvuln || applied.masterGain !== 0) {
  throw new Error('난이도·음소거가 적용되지 않았다: ' + JSON.stringify(applied));
}
console.log('설정 적용 확인:', JSON.stringify(applied));

// Escape 로 닫으면 원래 화면으로 돌아온다
await settingsPage.evaluate(() => { window.LEGO_GAME.state = 'start'; window.LEGO.SettingsUI.open(); });
await settingsPage.waitForTimeout(100);
await settingsPage.keyboard.press('Escape');
await settingsPage.waitForTimeout(150);
const closed = await settingsPage.evaluate(() => ({
  open: window.LEGO.SettingsUI.isOpen(),
  startVisible: !document.getElementById('start-screen').classList.contains('hidden'),
}));
if (closed.open || !closed.startVisible) {
  throw new Error('Escape 로 설정을 닫지 못했다: ' + JSON.stringify(closed));
}

// 다시 열었을 때(새로 고침) 저장값이 살아 있어야 한다
await settingsPage.reload();
await settingsPage.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 60000 });
const persisted = await settingsPage.evaluate(() => ({
  uiScale: window.LEGO.Settings.get('uiScale'),
  fov: Math.round(window.LEGO_GAME.camera.fov),
  difficulty: window.LEGO.Settings.get('difficulty'),
  motion: document.documentElement.dataset.motion,
}));
if (persisted.uiScale !== 150 || persisted.fov !== 90 || persisted.difficulty !== 'easy' || persisted.motion !== 'reduced') {
  throw new Error('설정이 저장되지 않았다: ' + JSON.stringify(persisted));
}
console.log('설정 저장 확인:', JSON.stringify(persisted));

// 손상된 저장값은 기본값으로 조용히 복구한다
await settingsPage.evaluate(() => {
  window.localStorage.setItem(window.LEGO.Settings.KEY, '{ this is not json');
});
await settingsPage.reload();
await settingsPage.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 60000 });
const recovered = await settingsPage.evaluate(() => ({
  uiScale: window.LEGO.Settings.get('uiScale'),
  fov: window.LEGO.Settings.get('fov'),
  quality: window.LEGO.Settings.get('quality'),
}));
if (recovered.uiScale !== 100 || recovered.fov !== 70 || recovered.quality !== 'auto') {
  throw new Error('손상된 설정값 복구 실패: ' + JSON.stringify(recovered));
}
if (settingsErrors.length) {
  throw new Error('설정 화면 오류: ' + settingsErrors.join(' | '));
}
console.log('설정 손상값 복구 확인:', JSON.stringify(recovered));

// 마우스 없이 시작 → 멈춤 → 재개 → 결과 → 재시작까지 완주한다 (UX 규격 §5)
await settingsPage.keyboard.press('Tab');
await settingsPage.keyboard.press('Enter');
await settingsPage.waitForTimeout(200);
const afterStart = await settingsPage.evaluate(() => window.LEGO_GAME.state);
await settingsPage.keyboard.press('Escape');
await settingsPage.waitForTimeout(150);
const afterPause = await settingsPage.evaluate(() => ({
  state: window.LEGO_GAME.state,
  pauseVisible: !document.getElementById('pause-screen').classList.contains('hidden'),
}));
await settingsPage.keyboard.press('Escape');
await settingsPage.waitForTimeout(150);
const afterResume = await settingsPage.evaluate(() => window.LEGO_GAME.state);
await settingsPage.evaluate(() => window.LEGO_GAME.hurtPlayer(99));
await settingsPage.waitForTimeout(150);
await settingsPage.keyboard.press('Tab');
const overFocus = await settingsPage.evaluate(() => document.activeElement && document.activeElement.id);
await settingsPage.keyboard.press('Enter');
await settingsPage.waitForTimeout(200);
const keyboardFlow = await settingsPage.evaluate(() => ({
  state: window.LEGO_GAME.state,
  hearts: window.LEGO_GAME.player.hearts,
}));
if (afterStart !== 'playing' || afterPause.state !== 'pause' || !afterPause.pauseVisible) {
  throw new Error('키보드만으로 시작·멈춤이 되지 않았다: ' + afterStart + ' ' + JSON.stringify(afterPause));
}
if (afterResume !== 'playing' || overFocus !== 'again-btn' || keyboardFlow.state !== 'playing') {
  throw new Error('키보드만으로 재개·재시작이 되지 않았다: ' + JSON.stringify({ afterResume, overFocus, keyboardFlow }));
}
console.log('키보드 전용 흐름 확인:', JSON.stringify({ afterStart, pause: afterPause.state, afterResume, restart: keyboardFlow }));
if (settingsErrors.length) {
  throw new Error('설정·키보드 흐름 오류: ' + settingsErrors.join(' | '));
}

// 첫 60초 안내: 처음 여는 아이에게만 뜨고, 단계마다 실제 행동으로 넘어간다
await settingsPage.evaluate(() => window.LEGO.Settings.reset());
await settingsPage.reload();
await settingsPage.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 60000 });
const tutorialFlow = await settingsPage.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = window.LEGO_GAME;
  const T = window.LEGO.Tutorial;
  // 소프트웨어 렌더러는 초당 몇 프레임뿐이다 — 프레임 수가 아니라 상태로 기다린다
  const until = async (fn, ms) => {
    const t0 = Date.now();
    while (!fn() && Date.now() - t0 < ms) await wait(150);
    return fn();
  };
  const seen = [];
  g.start();                               // 안내 카드는 이때 만들어진다
  const card = document.getElementById('tutorial-card');
  seen.push(T.step());
  const waveHeldBack = !g.enemies.waveActive;
  const cardVisible = !card.classList.contains('hidden');
  g.player.yaw += 3;                       // 둘러보기
  await until(() => T.step() !== 'look', 20000);
  seen.push(T.step());
  g.player.pos.x += 20;                    // 걷기
  await until(() => T.step() !== 'move', 20000);
  seen.push(T.step());
  const swordTarget = g.enemies.list.find((e) => e.alive);   // 안내가 세운 슬라임
  if (swordTarget) g.enemies.kill(swordTarget);
  await until(() => T.step() !== 'sword', 20000);
  seen.push(T.step());
  const farTargets = g.enemies.list.filter((e) => e.alive);
  for (const e of farTargets) g.enemies.kill(e);
  await until(() => T.step() !== 'blaster', 20000);
  seen.push(T.step());
  await until(() => !T.isActive(), 30000);  // 마지막 단계는 잠깐 뒤 스스로 끝난다
  return {
    seen, waveHeldBack, cardVisible,
    swordSpawned: !!swordTarget,
    farCount: farTargets.length,
    active: T.isActive(),
    waveActive: g.enemies.waveActive,
    setting: window.LEGO.Settings.get('tutorial'),
    cardHidden: card.classList.contains('hidden'),
  };
});
if (tutorialFlow.seen.join(',') !== 'look,move,sword,blaster,ready') {
  throw new Error('안내 단계가 행동으로 넘어가지 않았다: ' + JSON.stringify(tutorialFlow));
}
if (!tutorialFlow.waveHeldBack || !tutorialFlow.cardVisible || !tutorialFlow.swordSpawned || tutorialFlow.farCount !== 2) {
  throw new Error('안내 중 웨이브 보류·표적 배치가 어긋났다: ' + JSON.stringify(tutorialFlow));
}
if (tutorialFlow.active || !tutorialFlow.waveActive || tutorialFlow.setting !== false || !tutorialFlow.cardHidden) {
  throw new Error('안내가 끝난 뒤 웨이브로 이어지지 않았다: ' + JSON.stringify(tutorialFlow));
}
console.log('첫 안내 확인:', JSON.stringify(tutorialFlow));

// 두 번째 판에서는 배운 조작을 다시 요구하지 않는다
const secondRun = await settingsPage.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.LEGO_GAME.start();
  await wait(400);
  return {
    active: window.LEGO.Tutorial.isActive(),
    waveActive: window.LEGO_GAME.enemies.waveActive,
  };
});
if (secondRun.active || !secondRun.waveActive) {
  throw new Error('두 번째 판에서 안내가 다시 떴다: ' + JSON.stringify(secondRun));
}

// Enter 로 언제든 건너뛸 수 있다
await settingsPage.evaluate(() => {
  window.LEGO.Settings.set('tutorial', true);
  window.LEGO_GAME.start();
});
await settingsPage.waitForTimeout(200);
const beforeSkip = await settingsPage.evaluate(() => window.LEGO.Tutorial.isActive());
await settingsPage.keyboard.press('Enter');
await settingsPage.waitForTimeout(500);
const afterSkip = await settingsPage.evaluate(() => ({
  active: window.LEGO.Tutorial.isActive(),
  waveActive: window.LEGO_GAME.enemies.waveActive,
  setting: window.LEGO.Settings.get('tutorial'),
}));
if (!beforeSkip || afterSkip.active || !afterSkip.waveActive || afterSkip.setting !== false) {
  throw new Error('안내 건너뛰기가 되지 않았다: ' + JSON.stringify({ beforeSkip, afterSkip }));
}
console.log('안내 재실행·건너뛰기 확인:', JSON.stringify({ secondRun, afterSkip }));
if (settingsErrors.length) {
  throw new Error('첫 안내 오류: ' + settingsErrors.join(' | '));
}
await settingsPage.close();

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
  g.gameOver(false);
  // 저장이 막혀도 설정은 기억(메모리) 위에서 계속 동작해야 한다
  const S = window.LEGO.Settings;
  S.set('uiScale', 125);
  return {
    state: g.state,
    best: g.best,
    memory: window.LEGO.Storage._memory['brickcity-best'],
    uiScale: S.get('uiScale'),
    uiScaleVar: document.documentElement.style.getPropertyValue('--ui-scale'),
    fov: S.get('fov'),
  };
});
if (storageFlow.state !== 'over' || storageFlow.best !== 321 || storageFlow.memory !== '321') {
  throw new Error('저장소 차단 fallback 실패: ' + JSON.stringify(storageFlow));
}
if (storageFlow.uiScale !== 125 || storageFlow.uiScaleVar !== '1.25' || storageFlow.fov !== 70) {
  throw new Error('저장소 차단 시 설정 fallback 실패: ' + JSON.stringify(storageFlow));
}
if (deniedErrors.length) {
  throw new Error('저장소 차단 페이지 오류: ' + deniedErrors.join(' | '));
}
await denied.close();

await browser.close();

console.log('FPS(소프트웨어 렌더러 기준):', fps);
console.log('렌더 패스 합계:', JSON.stringify(info));
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
