/* =========================================================================
 * geo-merge.js — 정적 지오메트리 병합기 (직접 구현)
 *
 * 왜 직접 만드나: vendor/three.min.js (r150 UMD) 에는 BufferGeometryUtils 가 없다.
 * 번들 안의 "THREE.BufferGeometryUtils.mergeBufferGeometries()" 문자열은
 * BufferGeometry.merge() 의 **deprecation 에러 메시지**일 뿐 구현이 아니다.
 *
 * 무엇을 푸나: 1.x city.js 는 개별 .add() 114회로 복도 하나를 지어 드로우콜 467~499 를 썼다.
 * 오픈월드는 그 토대로 불가능하다(GAME_DESIGN_SPEC §7). 여기서는 청크 안 정적 메시를
 * **재질 계열별 1개 메시**로 합쳐 청크당 드로우콜을 한 자리로 떨어뜨린다.
 *
 * 색은 재질이 아니라 **정점 색(vertexColors)** 으로 싣는다. 그래야 팔레트가 달라도 한 번에 그린다.
 * 팔레트는 bricks.js COLORS 만 쓴다(CLAUDE.md §4 하드룰).
 * ========================================================================= */
(function (L) {
  'use strict';

  const _nm = new THREE.Matrix3();
  const _c = new THREE.Color();

  function Builder() {
    this.parts = [];      // { geo, mat, r, g, b }
    this.vertexCount = 0;
    this.triCount = 0;
  }

  /**
   * 병합 대기열에 하나 넣는다.
   * @param {THREE.BufferGeometry} geometry 원본 (변형하지 않는다)
   * @param {THREE.Matrix4} matrix 월드 배치
   * @param {number|THREE.Color} color 팔레트 색
   * @param {number} [su] UV U 배율 — 크기가 달라도 스터드 간격을 일정하게 유지
   * @param {number} [sv] UV V 배율
   */
  Builder.prototype.add = function (geometry, matrix, color, su, sv) {
    if (!geometry) return this;
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = geo.getAttribute('position');
    if (!pos) return this;
    _c.set(color);
    this.parts.push({
      geo,
      // 반드시 복사한다. 호출자(world.js pushBox 등)는 공유 스크래치 행렬을 재사용하므로
      // 참조로 담으면 청크의 모든 조각이 '마지막 행렬' 하나로 변환돼 한 점에 뭉친다.
      mat: matrix ? matrix.clone() : null,
      r: _c.r, g: _c.g, b: _c.b, own: geo !== geometry,
      su: su || 1, sv: sv === undefined ? (su || 1) : sv,
    });
    this.vertexCount += pos.count;
    this.triCount += pos.count / 3;
    return this;
  };

  /** 대기열을 단일 BufferGeometry 로 합친다. 비어 있으면 null. */
  Builder.prototype.build = function () {
    const n = this.vertexCount;
    if (!n) return null;

    const position = new Float32Array(n * 3);
    const normal = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const color = new Float32Array(n * 3);

    let v = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const geo = p.geo;
      const ap = geo.getAttribute('position');
      let an = geo.getAttribute('normal');
      if (!an) { geo.computeVertexNormals(); an = geo.getAttribute('normal'); }
      const au = geo.getAttribute('uv');
      const m = p.mat;
      if (m) _nm.getNormalMatrix(m);

      for (let k = 0; k < ap.count; k++, v++) {
        let x = ap.getX(k), y = ap.getY(k), z = ap.getZ(k);
        if (m) {
          const e = m.elements;
          const w = 1 / ((e[3] * x + e[7] * y + e[11] * z + e[15]) || 1);
          const tx = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
          const ty = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
          const tz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
          x = tx; y = ty; z = tz;
        }
        position[v * 3] = x; position[v * 3 + 1] = y; position[v * 3 + 2] = z;

        let nx = an.getX(k), ny = an.getY(k), nz = an.getZ(k);
        if (m) {
          const e = _nm.elements;
          const ax = e[0] * nx + e[3] * ny + e[6] * nz;
          const ay = e[1] * nx + e[4] * ny + e[7] * nz;
          const az = e[2] * nx + e[5] * ny + e[8] * nz;
          const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
          nx = ax / len; ny = ay / len; nz = az / len;
        }
        normal[v * 3] = nx; normal[v * 3 + 1] = ny; normal[v * 3 + 2] = nz;

        if (au) { uv[v * 2] = au.getX(k) * p.su; uv[v * 2 + 1] = au.getY(k) * p.sv; }

        color[v * 3] = p.r; color[v * 3 + 1] = p.g; color[v * 3 + 2] = p.b;
      }
      if (p.own) geo.dispose();
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(position, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(color, 3));
    out.computeBoundingSphere();

    this.parts.length = 0;
    return out;
  };

  /** 병합 지오메트리 전용 재질 — 플라스틱 광택 규칙(CLAUDE.md §4)을 지킨다. */
  function mergedMaterial(opts) {
    opts = opts || {};
    return new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: opts.shininess === undefined ? 42 : opts.shininess,
      specular: new THREE.Color(opts.specular === undefined ? 0x2a2a2a : opts.specular),
      flatShading: !!opts.flatShading,
    });
  }

  L.Merge = {
    builder: function () { return new Builder(); },
    material: mergedMaterial,
  };
})(window.LEGO);
