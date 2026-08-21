/* world-budget.mjs — 월드 렌더 예산 계측 (브라우저 없이 결정적으로)
 *
 * 무엇을 재는가: 유지 반경(7x7 청크)에 **상주하는** 정적 지오메트리 총량이다.
 * per-frame 드로우 비용이 아니라 업로드·메모리 규모다. FOV 70 에서 한 번에 보이는
 * 청크는 1/5 안팎이라 실제 프레임 삼각형은 이 값의 절반 이하로 떨어진다.
 *
 * 그래서 이 수치를 렌더 예산(650/125,000)과 직접 비교하면 사과-오렌지다.
 * per-frame 렌더 게이트의 정본은 `npm run smoke` 의 '월드 예산 확인'이고,
 * 여기서는 상주 규모가 비정상적으로 부풀지 않았는지만 본다.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 상주 규모 상한 — 렌더 예산이 아니라 업로드·메모리 sanity 기준이다.
const RESIDENT_MESH_MAX = 400;
const RESIDENT_TRI_MAX = 220000;

// three r150 UMD 와 클래식 <script> 모듈들을 하나의 전역 컨텍스트에서 돌린다
const sandbox = { console, Math, Date, JSON, Object, Array, Float32Array, Uint16Array, Uint32Array };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

const load = (rel) => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });

// 캔버스 스텁 — 이 하네스는 지오메트리만 재므로 텍스처는 실제로 굽지 않는다.
// (bricks.js 의 studCanvas/tileCanvas 가 2D 컨텍스트를 요구한다)
const g2d = () => ({
  fillStyle: '', strokeStyle: '', lineWidth: 0,
  fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
  moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, clip() {},
  rect() {}, translate() {}, rotate() {}, scale() {}, fillText() {}, measureText: () => ({ width: 0 }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
});
sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: g2d }) };
load('vendor/three.min.js');
vm.runInContext('window.LEGO = window.LEGO || {};', sandbox);
for (const f of ['src/rounded-box.js', 'src/bricks.js', 'src/rng.js', 'src/geo-merge.js',
                 'src/world.js', 'src/districts.js']) load(f);

const L = sandbox.window.LEGO;
const { CHUNK, VIEW_RADIUS, HALF_CHUNKS } = L.WORLD_CONST;
const SEED = 20260821;

function measureAt(px, pz) {
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
  let meshes = 0, tris = 0, colliders = 0, chunks = 0;
  for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (cx < -HALF_CHUNKS || cx >= HALF_CHUNKS || cz < -HALF_CHUNKS || cz >= HALF_CHUNKS) continue;
      const c = L.World.buildChunk(SEED, cx, cz);
      chunks++;
      colliders += c.colliders.length;
      for (const m of c.group.children) {
        meshes++;
        const p = m.geometry.getAttribute('position');
        tris += p.count / 3;
        m.geometry.dispose();
      }
    }
  }
  return { chunks, meshes, tris: Math.round(tris), colliders };
}

// 월드 전역 표본 — 랜드마크와 링별 지점을 고루 찍는다
const samples = [{ n: '중앙 광장', x: 32, z: 32 }];
for (let i = 0; i < 16; i++) {
  const a = i / 16 * Math.PI * 2, r = 120 + (i % 4) * 240;
  samples.push({ n: `링 r=${Math.round(r)} #${i}`, x: Math.cos(a) * r, z: Math.sin(a) * r });
}
samples.push({ n: '공사장 랜드마크', x: -8 * 64, z: -8 * 64 });
samples.push({ n: '항구', x: 12 * 64, z: 0 });
samples.push({ n: '월드 모서리', x: 900, z: 900 });

const rows = samples.map(s => ({ ...s, ...measureAt(s.x, s.z) }));
const maxMesh = Math.max(...rows.map(r => r.meshes));
const maxTri = Math.max(...rows.map(r => r.tris));
const worstT = rows.find(r => r.tris === maxTri);
const maxCol = Math.max(...rows.map(r => r.colliders));

console.log('\n브릭 시티 — 오픈월드 렌더 예산 계측 (정적 지오메트리 상한)\n');
console.log('지점'.padEnd(20), '청크'.padStart(5), '메시'.padStart(6), '삼각형'.padStart(9), '콜라이더'.padStart(8));
for (const r of rows) {
  console.log(r.n.padEnd(20), String(r.chunks).padStart(5), String(r.meshes).padStart(6),
              String(r.tris).padStart(9), String(r.colliders).padStart(8));
}
const passCalls = maxMesh <= RESIDENT_MESH_MAX, passTris = maxTri <= RESIDENT_TRI_MAX;
console.log('\n--- 판정 (상주 규모) ---');
console.log(`상주 메시 최대 ${maxMesh} / ${RESIDENT_MESH_MAX}  ${passCalls ? 'PASS' : 'FAIL'}`);
console.log(`상주 삼각형 최대 ${maxTri} / ${RESIDENT_TRI_MAX}  ${passTris ? 'PASS' : 'FAIL'}   (최악: ${worstT.n})`);
console.log(`근접 콜라이더 최대 ${maxCol} (3x3 청크 기준은 이보다 훨씬 작음)`);
console.log(`\nper-frame 렌더 예산(650 / 125,000) 판정은 npm run smoke 담당.
1.x 복도 1개 기준선: 드로우콜 467~499 / 삼각형 97,062~98,114`);
process.exit(passCalls && passTris ? 0 : 1);
