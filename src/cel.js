/* =========================================================================
 * cel.js — 애니메이션(셀) 룩 도구상자
 *
 * 게임 본편은 PBR 플라스틱 룩이다. 단편 영화(story.html)는 같은 브릭 부품을
 * 애니메이션 톤으로 다시 칠한다: 계단식 명암(툰 밴딩) + 굵은 외곽선 +
 * 역광 림라이트 + 그라데이션 하늘. 색은 bricks.js 팔레트만 쓴다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  // ------------------------------------------------------------ 툰 그라데이션
  // 3~4 단계로 뚝뚝 끊기는 명암표. 셀 애니메이션의 "빛/그림자 두 장" 느낌.
  let gradientMap = null;
  function toonGradient() {
    if (gradientMap) return gradientMap;
    const steps = [86, 152, 208, 255];
    const cv = document.createElement('canvas');
    cv.width = steps.length; cv.height = 1;
    const g = cv.getContext('2d');
    for (let i = 0; i < steps.length; i++) {
      const v = steps[i];
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.fillRect(i, 0, 1, 1);
    }
    gradientMap = new THREE.CanvasTexture(cv);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    return gradientMap;
  }

  const toonCache = new Map();
  /** 팔레트 색 하나에 대한 툰 머티리얼(캐시). 같은 색은 같은 인스턴스를 쓴다. */
  function toon(color) {
    const key = 'c' + color;
    let m = toonCache.get(key);
    if (m) return m;
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    toonCache.set(key, m);
    return m;
  }

  const glowCache = new Map();
  /** 발광부(창·램프·엔진). 빛을 받지 않고 스스로 밝다 — 셀 룩의 하이라이트. */
  function glow(color, opacity) {
    const key = color + '|' + (opacity === undefined ? 1 : opacity);
    let m = glowCache.get(key);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color, toneMapped: false, fog: false,
      transparent: opacity !== undefined && opacity < 1,
      opacity: opacity === undefined ? 1 : opacity,
    });
    glowCache.set(key, m);
    return m;
  }

  // ------------------------------------------------------------ 외곽선
  // 뒤집힌 껍데기(inverted hull): 같은 메시를 조금 부풀려 뒷면만 검게 그린다.
  // 셰이더 없이 되고 file:// 에서도 안전하다. 드로우콜이 두 배가 되므로
  // 주인공(메크·파일럿·기계)에만 쓴다.
  let outlineMaterial = null;
  function outlineMat() {
    if (!outlineMaterial) {
      outlineMaterial = new THREE.MeshBasicMaterial({
        color: C.cineInk, side: THREE.BackSide, toneMapped: false, fog: false,
      });
    }
    return outlineMaterial;
  }

  /**
   * 그룹 아래 모든 메시에 외곽선 껍데기를 붙인다.
   * @param {THREE.Object3D} root
   * @param {number} thickness 로컬 단위 두께(0.02~0.06)
   */
  function outline(root, thickness) {
    const t = thickness === undefined ? 0.035 : thickness;
    const targets = [];
    root.traverse((o) => { if (o.isMesh && !o.userData.noOutline) targets.push(o); });
    for (const mesh of targets) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const r = mesh.geometry.boundingSphere.radius || 1;
      const shell = new THREE.Mesh(mesh.geometry, outlineMat());
      // 부피 대비 일정한 두께가 되게 반지름으로 환산한다(작은 부품이 뭉개지지 않게)
      shell.scale.setScalar(1 + t / Math.max(r, 0.12));
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.matrixAutoUpdate = false;
      shell.updateMatrix();
      shell.userData.noOutline = true;
      mesh.add(shell);
    }
    return root;
  }

  // ------------------------------------------------------------ 하늘
  /**
   * 그라데이션 하늘 돔. 위 → 아래 두 색을 canvas 로 굽고 안쪽에 붙인다.
   * @returns {{mesh: THREE.Mesh, setColors: function}}
   */
  function skyDome(radius) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshBasicMaterial({
        map: tex, side: THREE.BackSide, toneMapped: false, depthWrite: false, fog: false,
      })
    );
    mesh.renderOrder = -2;
    const top = new THREE.Color();
    const bottom = new THREE.Color();
    const mid = new THREE.Color();
    const haze = new THREE.Color();
    function setColors(topHex, midHex, bottomHex, hazeHex) {
      const g = cv.getContext('2d');
      top.setHex(topHex); mid.setHex(midHex); bottom.setHex(bottomHex);
      haze.setHex(hazeHex === undefined ? bottomHex : hazeHex);
      // 지평선(v=0.5) 바로 위에 따뜻한 띠가 오게 잡는다. 위는 아직 밤, 아래는 안개.
      const grad = g.createLinearGradient(0, 0, 0, cv.height);
      grad.addColorStop(0, '#' + top.getHexString());
      grad.addColorStop(0.40, '#' + mid.getHexString());
      grad.addColorStop(0.50, '#' + bottom.getHexString());
      grad.addColorStop(0.60, '#' + haze.getHexString());
      grad.addColorStop(1, '#' + haze.getHexString());
      g.fillStyle = grad;
      g.fillRect(0, 0, cv.width, cv.height);
      tex.needsUpdate = true;
    }
    return { mesh, setColors };
  }

  /**
   * 해 원반. 하늘 돔과 같은 리그에 넣어 카메라를 따라다니게 하면
   * 어디에 서 있든 같은 크기·같은 방향에 뜬다(진짜 먼 광원처럼).
   */
  function sunDisc(radius, color) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({
      color, toneMapped: false, fog: false, depthWrite: false, depthTest: false,
    }));
    m.renderOrder = -1;
    m.userData.noOutline = true;
    return m;
  }

  // ------------------------------------------------------------ 먼지·입자
  let dustTexture = null;
  function dustSprite() {
    if (dustTexture) return dustTexture;
    const S = 32;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    dustTexture = new THREE.CanvasTexture(cv);
    return dustTexture;
  }

  /**
   * 떠다니는 먼지. 위치 배열을 미리 잡고 프레임마다 값만 갱신한다(할당 금지).
   */
  function DustField(count, box, color, size) {
    this.count = count;
    this.box = box;
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.attribute = geo.getAttribute('position');
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: size || 0.5, map: dustSprite(), transparent: true,
      opacity: 0.55, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    }));
    this.points.frustumCulled = false;
    for (let i = 0; i < count; i++) this._respawn(i, true);
    this.attribute.needsUpdate = true;
  }
  DustField.prototype._respawn = function (i, anywhere) {
    const b = this.box, p = this.positions, s = this.speeds, k = i * 3;
    p[k] = b.x + (Math.random() - 0.5) * b.w;
    p[k + 1] = b.y + (anywhere ? Math.random() * b.h : 0);
    p[k + 2] = b.z + (Math.random() - 0.5) * b.d;
    s[k] = (Math.random() - 0.5) * 0.5;
    s[k + 1] = 0.18 + Math.random() * 0.5;
    s[k + 2] = (Math.random() - 0.5) * 0.5;
  };
  DustField.prototype.update = function (dt, wind) {
    const p = this.positions, s = this.speeds, b = this.box;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      p[k] += (s[k] + wind) * dt;
      p[k + 1] += s[k + 1] * dt;
      p[k + 2] += s[k + 2] * dt;
      if (p[k + 1] > b.y + b.h) this._respawn(i, false);
    }
    this.attribute.needsUpdate = true;
  };

  // ------------------------------------------------------------ 조명 리그
  /**
   * 셀 룩 3점 조명: 키(태양) · 필(하늘) · 역광 림.
   * 림라이트가 실루엣 가장자리에 밝은 띠를 만들어 애니메이션 느낌이 난다.
   */
  function lightRig(scene, opts) {
    const o = opts || {};
    const key = new THREE.DirectionalLight(o.keyColor || C.lookSun, o.keyIntensity || 1.5);
    key.position.set(-34, 42, 26);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -30;
    sc.near = 8; sc.far = 190;
    key.shadow.bias = -0.0007;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);

    const rim = new THREE.DirectionalLight(o.rimColor || C.cineRim, o.rimIntensity || 1.25);
    rim.position.set(38, 16, -44);
    scene.add(rim);

    const hemi = new THREE.HemisphereLight(o.skyColor || C.cineHaze, o.groundColor || C.cineNight, 0.55);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(C.white, 0.16);
    scene.add(amb);
    return { key, rim, hemi, amb };
  }

  /**
   * 게임 본편(PBR 플라스틱)용으로 만들어진 부품을 셀 룩으로 다시 칠한다.
   * 얼굴 인쇄처럼 텍스처가 있는 재질은 텍스처를 유지한 채 툰으로 바꾼다.
   */
  function celify(root) {
    const swapped = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material || o.userData.noOutline) return;
      const src = o.material;
      if (src.isMeshToonMaterial || src.isMeshBasicMaterial) return;
      let next = swapped.get(src);
      if (!next) {
        next = new THREE.MeshToonMaterial({
          color: src.color ? src.color.getHex() : C.white,
          gradientMap: toonGradient(),
          map: src.map || null,
          transparent: !!src.transparent,
          opacity: src.opacity === undefined ? 1 : src.opacity,
        });
        swapped.set(src, next);
      }
      o.material = next;
    });
    return root;
  }

  L.Cel = { toonGradient, toon, glow, outline, celify, skyDome, sunDisc, DustField, lightRig };
})(window.LEGO = window.LEGO || {});
