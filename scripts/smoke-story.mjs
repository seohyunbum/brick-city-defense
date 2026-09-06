/* 단편 「여든여섯 번째 새벽」 브라우저 스모크.
 *   - file:// 더블클릭 경로로 연다(서버 없음)
 *   - 콘솔 오류 0
 *   - 여섯 컷이 모두 재생되고 자막이 바뀐다
 *   - 실제 렌더 패스가 드로우콜/삼각형 예산 안에 있다
 *   - 모션 줄이기 · 자막 끄기 토글이 동작한다
 *   - 컷마다 스크린샷을 남긴다
 * 사용법: node scripts/smoke-story.mjs [출력폴더]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] || resolve(root, '.smoke-story'));
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
await page.screenshot({ path: resolve(outDir, '00-intro.png') });
await page.click('#btn-start');

const shots = await page.evaluate(() => window.LEGO.Story86.SHOTS.map((s) => ({ id: s.id, dur: s.dur })));
if (shots.length !== 6) failures.push(`컷 수가 6개가 아니다: ${shots.length}`);

let at = 0;
let worstCalls = 0;
let worstTris = 0;
const seen = new Set();
for (let i = 0; i < shots.length; i++) {
  const middle = at + shots[i].dur * 0.5;
  at += shots[i].dur;
  await page.evaluate((t) => { const a = window.BRICK_STORY; a.seek(t); a.play(); }, middle);
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const a = window.BRICK_STORY;
    return {
      shot: a.story.shotIndex,
      caption: a.story.caption,
      domCaption: document.getElementById('caption').textContent,
      calls: a.renderer.info.render.calls,
      triangles: a.renderer.info.render.triangles,
      playing: a.playing,
    };
  });
  if (state.shot !== i) failures.push(`${shots[i].id}: 컷 인덱스 불일치 ${state.shot}`);
  if (!state.caption) failures.push(`${shots[i].id}: 자막이 비어 있다`);
  if (state.caption !== state.domCaption) failures.push(`${shots[i].id}: 화면 자막이 대본과 다르다`);
  if (!state.playing) failures.push(`${shots[i].id}: 재생이 멈췄다`);
  seen.add(state.caption);
  worstCalls = Math.max(worstCalls, state.calls);
  worstTris = Math.max(worstTris, state.triangles);
  await page.screenshot({ path: resolve(outDir, `${String(i + 1).padStart(2, '0')}-${shots[i].id}.png`) });
}
if (seen.size !== shots.length) failures.push(`컷마다 자막이 바뀌지 않았다: ${seen.size}종`);
if (worstCalls > MAX_DRAWCALLS) failures.push(`드로우콜 예산 초과: ${worstCalls} > ${MAX_DRAWCALLS}`);
if (worstTris > MAX_TRIANGLES) failures.push(`삼각형 예산 초과: ${worstTris} > ${MAX_TRIANGLES}`);

// 발이 미끄러지지 않는가 — 접지 중인 발은 세계 좌표에서 제자리에 있어야 한다
await page.evaluate(() => { const a = window.BRICK_STORY; a.seek(38); a.play(); });
await page.waitForTimeout(1200);
const slide = await page.evaluate(async () => {
  const a = window.BRICK_STORY;
  const rig = a.story.mech.userData.rig;
  const v = new THREE.Vector3();
  const read = () => rig.legs.map((l) => {
    l.foot.getWorldPosition(v);
    return { x: v.x, z: v.z, contact: l.contact, last: l.lastContact };
  });
  const samples = [];
  let before = read();
  let beforeX = a.story.mech.position.x;
  for (let n = 0; n < 6; n++) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = read();
    const bodyStep = Math.abs(a.story.mech.position.x - beforeX);
    let worst = 0;
    for (let i = 0; i < before.length; i++) {
      // 두 시점 모두 접지 중이고 그 사이 발을 새로 디디지 않은 다리만 본다
      if (!before[i].contact || !after[i].contact || !after[i].last) continue;
      worst = Math.max(worst, Math.hypot(after[i].x - before[i].x, after[i].z - before[i].z));
    }
    if (bodyStep > 0.05) samples.push(worst / bodyStep);
    before = after;
    beforeX = a.story.mech.position.x;
  }
  samples.sort((x, y) => x - y);
  return { samples, median: samples.length ? samples[samples.length >> 1] : 0 };
});
if (!slide.samples.length) failures.push('보행 중 접지 발을 표본으로 잡지 못했다');
else if (slide.median > 0.2) {
  failures.push(`접지한 발이 미끄러진다: 몸 이동 대비 ${(slide.median * 100).toFixed(0)}%`);
}

// 접근성 토글
await page.click('#btn-reduce');
await page.click('#btn-subtitle');
const toggles = await page.evaluate(() => ({
  reduce: window.BRICK_STORY.story.reduceMotion,
  subtitles: window.BRICK_STORY.subtitles,
  captionHidden: document.getElementById('caption').classList.contains('off'),
}));
if (!toggles.reduce) failures.push('모션 줄이기 토글이 켜지지 않았다');
if (toggles.subtitles || !toggles.captionHidden) failures.push('자막 끄기 토글이 동작하지 않았다');
await page.click('#btn-reduce');
await page.click('#btn-subtitle');

// 끝까지 재생하면 타이틀 카드가 뜬다
await page.evaluate(() => {
  const a = window.BRICK_STORY;
  a.seek(a.story.duration - 0.4);
  a.play();
});
await page.waitForFunction(() => !document.getElementById('titlecard').classList.contains('hidden'),
  null, { timeout: 20000 });
await page.screenshot({ path: resolve(outDir, '07-titlecard.png') });

await browser.close();

if (errors.length) failures.push(...errors);
if (failures.length) {
  console.error(`단편 스모크 실패 ${failures.length}건`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`단편 스모크 통과: 컷 ${shots.length}개, 최대 드로우콜 ${worstCalls}/${MAX_DRAWCALLS}, ` +
  `삼각형 ${worstTris}/${MAX_TRIANGLES}, 접지 발 미끄러짐 ${(slide.median * 100).toFixed(1)}%`);
