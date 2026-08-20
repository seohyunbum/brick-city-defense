/* =========================================================================
 * rng.js — 시드 기반 결정적 난수
 *
 * 왜 필요한가: `file://` 에서는 동적 import() 가 CORS 로 막혀(CLAUDE.md §1)
 * 청크를 파일로 스트리밍할 수 없다. 대신 시드에서 런타임에 도시를 만든다.
 * 같은 시드 → 항상 같은 도시. 아이가 "우리 도시"를 다시 찾을 수 있어야 한다.
 * ========================================================================= */
(function (L) {
  'use strict';

  /** mulberry32 — 32bit 시드 하나로 균일 분포. 상태 1개라 청크마다 싸게 만든다. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 좌표를 시드로 섞는다 — 청크 (cx,cz) 는 월드 시드와 무관하게 재현돼야 한다. */
  function hash2(seed, x, z) {
    let h = seed >>> 0;
    h = Math.imul(h ^ (x >>> 0), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (z >>> 0), 0xC2B2AE35) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
  }

  /** 청크 전용 난수기 — 이웃 청크와 상관없이 독립 재현된다. */
  function chunkRng(seed, cx, cz) {
    return mulberry32(hash2(seed, cx + 0x9E37, cz + 0x79B9));
  }

  /** 편의 헬퍼 — 새 객체를 만들지 않는다(핫패스 금지 규칙, CLAUDE.md §2). */
  function pick(rand, arr) { return arr[(rand() * arr.length) | 0]; }
  function range(rand, lo, hi) { return lo + rand() * (hi - lo); }
  function irange(rand, lo, hi) { return lo + ((rand() * (hi - lo + 1)) | 0); }
  function chance(rand, p) { return rand() < p; }

  L.RNG = { mulberry32, hash2, chunkRng, pick, range, irange, chance };
})(window.LEGO);
