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
   * @param {object} [opts]
   * @param {number[]} [opts.uv] 균일 UV 배율 [su, sv]
   * @param {number[][]} [opts.faceUV] 면별 UV 배율 — BoxGeometry 면 순서 +X,-X,+Y,-Y,+Z,-Z.
   *        크기가 다른 브릭에도 스터드 피치를 일정하게 유지하려면 면마다 배율이 달라야 한다.
   * @param {number[]} [opts.faces] 담을 면 인덱스 목록(BoxGeometry 전용). 생략하면 전부.
   *        상단면(스터드)과 측면(이음선)을 서로 다른 메시로 갈라 담는 데 쓴다.
   */
  Builder.prototype.add = function (geometry, matrix, color, opts) {
    if (!geometry) return this;
    opts = opts || {};
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = geo.getAttribute('position');
    if (!pos) return this;

    // 면 필터는 정점 구간으로 환산한다(비인덱스 BoxGeometry = 면당 6 정점)
    let ranges = null, count = pos.count;
    if (opts.faces) {
      ranges = [];
      count = 0;
      for (let i = 0; i < opts.faces.length; i++) {
        const f = opts.faces[i];
        const start = f * 6;
        if (start + 6 > pos.count) continue;
        ranges.push(start);
        count += 6;
      }
      if (!count) { if (geo !== geometry) geo.dispose(); return this; }
    }

    _c.set(color);
    this.parts.push({
      geo,
      // 반드시 복사한다. 호출자(world.js pushBox 등)는 공유 스크래치 행렬을 재사용하므로
      // 참조로 담으면 청크의 모든 조각이 '마지막 행렬' 하나로 변환돼 한 점에 뭉친다.
      mat: matrix ? matrix.clone() : null,
      r: _c.r, g: _c.g, b: _c.b, own: geo !== geometry,
      uv: opts.uv || null, faceUV: opts.faceUV || null, ranges,
    });
    this.vertexCount += count;
    this.triCount += count / 3;
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

      // 면 필터가 있으면 해당 정점만 뽑는다
      let emit = null;
      if (p.ranges) {
        emit = [];
        for (let q = 0; q < p.ranges.length; q++) {
          const st = p.ranges[q];
          for (let e = 0; e < 6; e++) emit.push(st + e);
        }
      }
      const total = emit ? emit.length : ap.count;

      for (let idx = 0; idx < total; idx++, v++) {
        const k = emit ? emit[idx] : idx;
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

        if (au) {
          let su = 1, sv = 1;
          if (p.faceUV) {
            const f = p.faceUV[(k / 6) | 0] || p.faceUV[0];
            su = f[0]; sv = f[1];
          } else if (p.uv) { su = p.uv[0]; sv = p.uv[1]; }
          uv[v * 2] = au.getX(k) * su;
          uv[v * 2 + 1] = au.getY(k) * sv;
        }

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

  /**
   * 브릭 표면 재질 — 병합 메시 하나에 스터드/이음선 텍스처와 PBR 플라스틱을 함께 싣는다.
   *
   * 왜 Phong 이 아니라 Physical 인가: lookdev.js 가 scene.environment 로 PMREM 반사를 깔아두는데,
   * 이는 Standard/Physical 계열에만 자동 적용된다. Phong 으로 두면 브릭 광택이 통째로 죽는다.
   *
   * repeat 는 (1,1)로 둔다 — 타일링 횟수는 이미 정점 UV 에 구워져 있다(faceUV).
   * @param {string} kind 'stud'(윗면 돌기) | 'tile'(측면 이음선)
   */
  function brickMaterial(kind, override) {
    const t = L.surfaceTextures(kind, 1, 1);
    const base = {
      vertexColors: true,
      map: t.map, bumpMap: t.bump,
      // 돌기는 요철로만 읽힌다(맵 자체는 거의 흰색). 약하면 브릭이 매끈한 상자로 보인다.
      bumpScale: kind === 'tile' ? 0.16 : 0.34,
      metalness: 0, roughness: kind === 'tile' ? 0.30 : 0.26,
      clearcoat: 0.68, clearcoatRoughness: 0.16,
      envMapIntensity: 0.58,
    };
    if (override) for (const k in override) base[k] = override[k];
    return new THREE.MeshPhysicalMaterial(base);
  }

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
    brickMaterial: brickMaterial,
  };
})(window.LEGO);
