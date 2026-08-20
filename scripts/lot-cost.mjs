/* lot-cost.mjs — 부지 유형별 삼각형 원가. 어림짐작 대신 수치로 최적화 대상을 고른다. */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sandbox = { console, Math, Date, JSON, Object, Array, Float32Array, Uint16Array, Uint32Array };
sandbox.window = sandbox; sandbox.self = sandbox; vm.createContext(sandbox);
const load = (r) => vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), sandbox, { filename: r });
load('vendor/three.min.js');
vm.runInContext('window.LEGO = window.LEGO || {};', sandbox);
for (const f of ['src/rounded-box.js','src/bricks.js','src/rng.js','src/geo-merge.js','src/world.js','src/districts.js']) load(f);
const L = sandbox.window.LEGO;

const rows = [];
for (const type of L.Districts.TYPES) {
  let tot = 0, n = 12;
  for (let i = 0; i < n; i++) {
    const ctx = { solid: L.Merge.builder(), glass: L.Merge.builder(), colliders: [], rand: L.RNG.mulberry32(1000 + i) };
    L.Districts.fillLot(ctx, type, 0, 0, 38, 0, 0, 1);
    tot += ctx.solid.triCount + ctx.glass.triCount;
  }
  rows.push({ type, tri: Math.round(tot / n) });
}
rows.sort((a, b) => b.tri - a.tri);
console.log('\n부지 유형별 평균 삼각형 (부지 1개)\n');
for (const r of rows) console.log(r.type.padEnd(14), String(r.tri).padStart(6));
console.log('\n부지당 예산 기준선 ~600 (49청크 × 4부지 = 196부지로 125,000 배분)');
console.log('실제 부지 평균:', Math.round(rows.reduce((a, b) => a + b.tri, 0) / rows.length));
