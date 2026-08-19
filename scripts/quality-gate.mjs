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
if (!index.includes('https://seohyunbum.github.io/brick-city-defense/')) fail('canonical Pages URL 불일치');
if (/<script[^>]+src=["']https?:/iu.test(index) || /@import\s+url\(["']?https?:/iu.test(read('src/style.css'))) {
  fail('CDN 또는 원격 런타임 의존성 발견');
}

const runtimeCode = [...walk('src'), 'index.html'].map(read).join('\n');
if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/u.test(runtimeCode)) {
  fail('own-origin 외 통신 가능 API가 런타임 코드에 추가됨');
}

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

const runtimeFiles = ['index.html', 'manifest.webmanifest', ...walk('src'), ...walk('vendor'), ...walk('assets/icons'), ...walk('assets/external')];
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
if (rawColorCount > 93) fail(`팔레트 밖 직접 색상 증가: ${rawColorCount} > 93`);

const lineLimit = { 'src/city.js': 1087, 'src/game.js': 650 };
for (const [path, limit] of Object.entries(lineLimit)) {
  const lines = read(path).split(/\r?\n/u).length - 1;
  if (lines > limit) fail(`과대 모듈 증가: ${path} ${lines}줄 > ${limit}`);
}

if (errors.length) {
  console.error(`정적 품질 게이트 실패 ${errors.length}건`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`정적 품질 게이트 통과: 자산 ${registered.size}개 파일, 런타임 ${(runtimeBytes / 1048576).toFixed(2)}MB, 직접 색상 ${rawColorCount}/93`);
