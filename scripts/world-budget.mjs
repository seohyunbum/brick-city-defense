/* world-budget.mjs — 월드 렌더 예산 계측 (브라우저 없이 결정적으로)
 *
 * 왜 node 인가: 카메라 각도 운에 좌우되는 렌더 표본 대신, 유지 반경 안 청크의
 * 정적 메시 수와 삼각형 수를 직접 센다. 프러스텀 컬링은 이 값을 더 낮추기만 하므로
 * 여기서 나온 수치는 **보수적 상한**이다. (GAME_DESIGN_SPEC §7)
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CALL_BUDGET = 650, TRI_BUDGET = 125000;

// three r150 UMD 와 클래식 <script> 모듈들을 하나의 전역 컨텍스트에서 돌린다
const sandbox = { console, Math, Date, JSON, Object, Array, Float32Array, Uint16Array, Uint32Array };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

const load = (rel) => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });

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
const passCalls = maxMesh <= CALL_BUDGET, passTris = maxTri <= TRI_BUDGET;
console.log('\n--- 판정 ---');
console.log(`드로우콜(정적 메시) 최대 ${maxMesh} / ${CALL_BUDGET}  ${passCalls ? 'PASS' : 'FAIL'}`);
console.log(`삼각형 최대 ${maxTri} / ${TRI_BUDGET}  ${passTris ? 'PASS' : 'FAIL'}   (최악: ${worstT.n})`);
console.log(`근접 콜라이더 최대 ${maxCol} (3x3 청크 기준은 이보다 훨씬 작음)`);
console.log(`\n1.x 복도 1개 기준선: 드로우콜 467~499 / 삼각형 97,062~98,114`);
process.exit(passCalls && passTris ? 0 : 1);
