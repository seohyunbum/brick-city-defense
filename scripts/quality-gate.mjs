import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (message) => errors.push(message);
const posix = (value) => value.replaceAll('\\', '/');
const read = (path) => readFileSync(join(root, path), 'utf8');

function walk(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...walk(posix(relative(root, child))));
    else files.push(posix(relative(root, child)));
  }
  return files;
}

function sha256(path, mode = 'bytes') {
  let data = readFileSync(join(root, path));
  if (mode === 'text-lf') {
    data = Buffer.from(data.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8');
  }
  return createHash('sha256').update(data).digest('hex');
}

const requiredDocs = [
  'docs/GAME_DESIGN_SPEC.md',
  'docs/TECHNICAL_ARCHITECTURE.md',
  'docs/ART_AUDIO_BIBLE.md',
  'docs/GRAPHICS_LOOKDEV_PIPELINE.md',
  'docs/EXTERNAL_ASSET_ACQUISITION.md',
  'docs/UX_ACCESSIBILITY_CHILD_SAFETY.md',
  'docs/QA_PERFORMANCE_RELEASE_GATES.md',
  'docs/PRODUCTION_PLAN.md',
  'docs/AUDIT_2026-08-19.md',
  'docs/ICON_PROVENANCE.md',
  'THIRD_PARTY_NOTICES.md',
];
for (const path of requiredDocs) {
  if (!existsSync(join(root, path))) fail(`필수 문서 없음: ${path}`);
  else if (read(path).length < 500) fail(`필수 문서가 지나치게 짧음: ${path}`);
}

for (const path of ['README.md', 'index.html', 'manifest.webmanifest', 'scripts/install-desktop-shortcut.ps1']) {
  const text = read(path);
  if (/lego-city-game|레고 시티/iu.test(text)) fail(`공개 브랜드/URL 잔존: ${path}`);
}

const index = read('index.html');
const roundedScript = index.indexOf('./src/rounded-box.js');
const bricksScript = index.indexOf('./src/bricks.js');
const lookdevScript = index.indexOf('./src/lookdev.js');
const objectiveScript = index.indexOf('./src/objectives.js');
const creatureScript = index.indexOf('./src/creatures.js');
const creatureMeshScript = index.indexOf('./src/creature-mesh.js');
const dexScript = index.indexOf('./src/dex.js');
const companionScript = index.indexOf('./src/companions.js');
const combatScript = index.indexOf('./src/combat.js');
const progressionScript = index.indexOf('./src/progression.js');
const gameScript = index.indexOf('./src/game.js');
if (objectiveScript < 0 || progressionScript < 0 || gameScript < 0 ||
    objectiveScript > progressionScript || progressionScript > gameScript) {
  fail('Objective/Progression/Game 모듈 로드 순서 불일치');
}
if (roundedScript < 0 || bricksScript < 0 || lookdevScript < 0 || roundedScript > bricksScript || bricksScript > lookdevScript) {
  fail('RoundedBox/Bricks/LookDev 모듈 로드 순서 불일치');
}
// 브릭 도감: 표 → 모양 → 기록 → 행동 순서로 실려야 한다(뒤집히면 부팅에서 죽는다)
if (creatureScript < 0 || creatureMeshScript < 0 || dexScript < 0 || companionScript < 0 ||
    creatureScript > creatureMeshScript || creatureMeshScript > dexScript ||
    dexScript > companionScript || companionScript > gameScript) {
  fail('Creatures/CreatureMesh/Dex/Companions 모듈 로드 순서 불일치');
}
if (combatScript < 0 || combatScript > gameScript) fail('Combat 모듈이 game.js 뒤에 실렸다');
if (!index.includes('https://seohyunbum.github.io/brick-city-defense/')) fail('canonical Pages URL 불일치');
if (/<script[^>]+src=["']https?:/iu.test(index) || /@import\s+url\(["']?https?:/iu.test(read('src/style.css'))) {
  fail('CDN 또는 원격 런타임 의존성 발견');
}

const story = read('story.html');
// 단편(story.html)도 같은 실행 계약을 지킨다: file:// 더블클릭 · CDN 금지 · 모듈 순서
if (/<script[^>]+src=["']https?:/iu.test(story) || /@import\s+url\(["']?https?:/iu.test(read('src/story.css'))) {
  fail('단편 페이지에 CDN 또는 원격 런타임 의존성 발견');
}
if (!index.includes('./story.html')) fail('시작 화면에서 단편(story.html) 로 가는 길이 없다');
const storyOrder = ['./src/bricks.js', './src/loadout.js', './src/minifig.js', './src/motion.js', './src/cel.js',
  './src/mech86.js', './src/story-set.js', './src/story86.js', './src/mech-weapons.js', './src/legion.js',
  './src/input.js', './src/pilot-hud.js', './src/pilot.js', './src/story-app.js'];
let previousStory = -1;
for (const path of storyOrder) {
  const at = story.indexOf(path);
  if (at < 0) fail(`단편 모듈 누락: ${path}`);
  else if (at < previousStory) fail(`단편 모듈 로드 순서 불일치: ${path}`);
  previousStory = Math.max(previousStory, at);
}

const runtimeCode = [...walk('src'), 'index.html', 'story.html'].map(read).join('\n');
if (!runtimeCode.includes('THREE.ACESFilmicToneMapping') || !runtimeCode.includes('THREE.MeshPhysicalMaterial') ||
    !runtimeCode.includes('THREE.PMREMGenerator') || !runtimeCode.includes('RoundedBoxGeometry')) {
  fail('PBR/ACES/PMREM/라운드 엣지 그래픽 계약 누락');
}
if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/u.test(runtimeCode)) {
  fail('own-origin 외 통신 가능 API가 런타임 코드에 추가됨');
}
if (read('src/fx.js').includes('if (!s) return;')) {
  fail('수집품 풀이 가득 찰 때 보상을 조용히 유실하는 코드 발견');
}

// 아동안전 하드룰(CLAUDE.md 5장): 브릭 생물은 공격 대상이 아니다.
// 생물 런타임에 피해·죽음 경로가 생기면 여기서 막는다.
const companionCode = read('src/companions.js') + read('src/creature-mesh.js') + read('src/creatures.js');
if (/\b(damage|kill|hp|attack)\b/iu.test(companionCode)) {
  fail('브릭 생물 코드에 피해/죽음 경로가 들어왔다 — 생물은 공격 대상이 될 수 없다');
}
if (!read('src/enemies.js').includes('L.Enemies') || read('src/enemies.js').includes('Creatures')) {
  fail('몬스터 모듈이 브릭 생물 표를 참조한다 — 생물이 상대로 쓰일 수 있다');
}

// 조종 모드(86호기)도 같은 하드룰을 지킨다.
// ① 상대는 무인 기계뿐이다 — 미니피그·브릭 생물을 표적 코드가 만지지 않는다.
// ② 게임오버로 진행을 막지 않는다 — 장갑이 0 이면 수리하고 계속한다.
const legionCode = read('src/legion.js');
if (/minifig|Creatures|citizen/iu.test(legionCode)) {
  fail('적 모듈이 시민·브릭 생물을 참조한다 — 상대는 무인 기계뿐이어야 한다');
}
if (!legionCode.includes('scrapWalker')) fail('적 모듈이 무생물 기계 팩토리를 쓰지 않는다');
const pilotCode = read('src/pilot.js');
// 주석이 아니라 실제 호출을 본다(sfx.gameOver 같은 종료 연출이 들어오면 막는다)
if (/\bgameOver\s*\(/u.test(pilotCode)) fail('조종 모드에 게임오버 경로가 들어왔다');
if (!/repair/u.test(pilotCode)) fail('조종 모드에 장갑 0 이후의 수리 경로가 없다');

const packageJson = JSON.parse(read('package.json'));
if (packageJson.devDependencies?.playwright !== '1.62.1') fail('Playwright 버전이 정확히 고정되지 않음');
if (!existsSync(join(root, 'package-lock.json'))) fail('package-lock.json 없음');
const shortcutBytes = readFileSync(join(root, 'scripts/install-desktop-shortcut.ps1'));
if (shortcutBytes[0] !== 0xef || shortcutBytes[1] !== 0xbb || shortcutBytes[2] !== 0xbf) {
  fail('Windows PowerShell 5.1용 shortcut script에 UTF-8 BOM 없음');
}


const workflow = read('.github/workflows/pages.yml');
for (const line of workflow.split(/\r?\n/u).filter((value) => value.includes('uses:'))) {
  if (!/uses:\s+[\w-]+\/[\w-]+@[0-9a-f]{40}(?:\s|$)/u.test(line)) fail(`Action SHA 미고정: ${line.trim()}`);
}
if (!workflow.includes('needs: quality')) fail('deploy job이 quality job을 의존하지 않음');

const manifest = JSON.parse(read('assets/third-party-assets.json'));
const allowedLicenses = new Set(['CC0-1.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'OFL-1.1', 'CC-BY-4.0', 'LicenseRef-Project-Generated']);
const registered = new Set();
const ids = new Set();
for (const asset of manifest.assets || []) {
  if (!asset.id || ids.has(asset.id)) fail(`asset id 누락/중복: ${asset.id || '(없음)'}`);
  ids.add(asset.id);
  if (!allowedLicenses.has(asset.license)) fail(`${asset.id}: 허용되지 않은 라이선스 ${asset.license}`);
  for (const field of ['source_url', 'source_version', 'author', 'license_evidence', 'reviewed_at', 'redistribution']) {
    if (!asset[field]) fail(`${asset.id}: 필수 필드 누락 ${field}`);
  }
  if (!existsSync(join(root, asset.license_evidence || ''))) fail(`${asset.id}: 라이선스/출처 증거 없음`);
  if (!Array.isArray(asset.files) || asset.files.length === 0) fail(`${asset.id}: 등록 파일 없음`);
  for (const file of asset.files || []) {
    if (!file.path || registered.has(file.path)) fail(`${asset.id}: 파일 경로 누락/중복 ${file.path || '(없음)'}`);
    registered.add(file.path);
    if (!existsSync(join(root, file.path || ''))) {
      fail(`${asset.id}: 파일 없음 ${file.path}`);
      continue;
    }
    const actual = sha256(file.path, file.hash_mode);
    if (actual !== file.sha256) fail(`${asset.id}: SHA-256 불일치 ${file.path}`);
  }
  if (asset.license === 'CC-BY-4.0' && !asset.attribution) fail(`${asset.id}: CC-BY attribution 누락`);
  if (asset.third_party && !read('THIRD_PARTY_NOTICES.md').includes(asset.id)) fail(`${asset.id}: THIRD_PARTY_NOTICES 누락`);
}

const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg', '.glb', '.gltf', '.bin', '.mp3', '.ogg', '.wav', '.webm', '.ttf', '.otf', '.woff', '.woff2']);
for (const path of walk('assets')) {
  if (binaryExtensions.has(extname(path).toLowerCase()) && !registered.has(path)) fail(`manifest 미등록 자산: ${path}`);
}
for (const path of walk('vendor')) {
  if (!registered.has(path)) fail(`manifest 미등록 vendor 파일: ${path}`);
}

const runtimeFiles = ['index.html', 'story.html', 'manifest.webmanifest', ...walk('src'), ...walk('vendor'), ...walk('assets/icons'), ...walk('assets/external')];
let runtimeBytes = 0;
for (const path of runtimeFiles) {
  const size = statSync(join(root, path)).size;
  runtimeBytes += size;
  if (size > 4 * 1024 * 1024) fail(`개별 런타임 파일 4MB 초과: ${path}`);
}
if (runtimeBytes > 10 * 1024 * 1024) fail(`초기 런타임 payload 10MB 초과: ${(runtimeBytes / 1048576).toFixed(2)}MB`);

let rawColorCount = 0;
for (const path of walk('src').filter((value) => value.endsWith('.js') && value !== 'src/bricks.js')) {
  rawColorCount += read(path).match(/0x[0-9a-f]{6}\b/giu)?.length || 0;
}
if (rawColorCount > 64) fail(`팔레트 밖 직접 색상 증가: ${rawColorCount} > 64`);

// 과대 모듈 래칫 — 현재 줄 수로 잠근다. city.js(복도 도시)는 world.js 로 대체돼 삭제됐다.
// game.js 는 전투를 combat.js 로 뽑아내며 579 → 477 으로 내려갔다. 래칫은 내려간 값으로 다시 잠근다.
const lineLimit = {
  // game.js 482: 실내 배선 5줄(tracker 생성·update·reset·HUD). 규칙은 interiors.js 에 있다.
  'src/game.js': 482, 'src/objectives.js': 89, 'src/progression.js': 39,
  'src/director.js': 192, 'src/props.js': 183, 'src/interiors.js': 153, 'src/enemies.js': 484,
  'src/combat.js': 150, 'src/creatures.js': 265, 'src/creature-mesh.js': 335,
  'src/dex.js': 180, 'src/companions.js': 370,
  // 단편(story.html) 모듈. 연출(story86)과 세트(story-set)를 갈라 둔 상태로 잠근다.
  'src/motion.js': 210, 'src/cel.js': 275, 'src/mech86.js': 345,
  'src/story-set.js': 395, 'src/story86.js': 505, 'src/story-app.js': 240,
  // 조종 모드 모듈
  'src/mech-weapons.js': 190, 'src/legion.js': 220, 'src/pilot.js': 310, 'src/pilot-hud.js': 95,
};
for (const [path, limit] of Object.entries(lineLimit)) {
  const lines = read(path).split(/\r?\n/u).length - 1;
  if (lines > limit) fail(`과대 모듈 증가: ${path} ${lines}줄 > ${limit}`);
}

if (errors.length) {
  console.error(`정적 품질 게이트 실패 ${errors.length}건`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`정적 품질 게이트 통과: 자산 ${registered.size}개 파일, 런타임 ${(runtimeBytes / 1048576).toFixed(2)}MB, 직접 색상 ${rawColorCount}/64`);
