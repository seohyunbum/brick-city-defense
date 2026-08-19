/* =========================================================================
 * postfx.js — 매크로 사진 느낌을 내는 후처리 (three 코어만 사용, 외부 모듈 없음)
 *
 * 실물 레고 사진의 핵심은 "접사 렌즈의 얕은 심도"다.
 *   · 초점 거리 주변은 또렷, 멀어질수록 뭉개짐(보케)
 *   · 화면 가장자리 살짝 어두워짐(비네팅)
 *   · 필름 같은 약한 채도·대비 보정
 *
 * 구현: 도시 씬을 렌더타겟에 그리고, 깊이 텍스처로 흐림 반경을 계산해
 * 전체화면 사각형에 한 패스로 합성한다. 1인칭 두 팔은 이 뒤에 또렷하게 덧그린다.
 * 깊이 텍스처를 못 쓰는 기기에서는 스스로 꺼진다(게임은 그대로 돌아간다).
 * ========================================================================= */
(function (L) {
  'use strict';

  const VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}',
  ].join('\n');

  const FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D tColor;',
    'uniform sampler2D tDepth;',
    'uniform vec2 uTexel;',      // 1 / 해상도
    'uniform float uNear;',
    'uniform float uFar;',
    'uniform float uFocus;',     // 초점까지의 거리(월드 단위)
    'uniform float uAperture;',  // 조리개(클수록 많이 흐려진다)
    'uniform float uMaxBlur;',   // 최대 흐림 반경(픽셀)
    'uniform float uVignette;',
    'uniform float uSaturation;',

    // 깊이 텍스처 → 카메라로부터의 실제 거리
    'float eyeDepth(vec2 uv) {',
    '  float z = texture2D(tDepth, uv).x;',
    '  float ndc = z * 2.0 - 1.0;',
    '  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));',
    '}',

    // 흐림 반경(착란원). 가까운 쪽은 절반만 흐리게 해서 조작감을 지킨다.
    'float coc(float d) {',
    '  float diff = d - uFocus;',
    '  float c = uAperture * abs(diff) / max(d, 1.0);',
    '  if (diff < 0.0) c *= 0.45;',
    '  return clamp(c, 0.0, 1.0);',
    '}',

    'void main() {',
    '  float d = eyeDepth(vUv);',
    '  float r = coc(d) * uMaxBlur;',
    '  vec3 sum = texture2D(tColor, vUv).rgb;',
    '  float wsum = 1.0;',
    '  if (r > 0.4) {',
    // 황금각 나선 16탭 — 적은 샘플로도 보케가 고르게 퍼진다
    '    const float GA = 2.39996323;',
    '    for (int i = 0; i < 16; i++) {',
    '      float fi = float(i) + 0.5;',
    '      float ang = fi * GA;',
    '      float rad = r * sqrt(fi / 16.0);',
    '      vec2 off = vec2(cos(ang), sin(ang)) * rad * uTexel;',
    '      vec2 suv = clamp(vUv + off, vec2(0.001), vec2(0.999));',
    '      float sd = eyeDepth(suv);',
    '      float sr = coc(sd) * uMaxBlur;',
    // 또렷한 앞쪽 물체가 뒤로 번지지 않게 가중치를 준다
    '      float w = (sd >= d - 0.5) ? 1.0 : clamp(sr / max(rad, 0.001), 0.0, 1.0);',
    '      sum += texture2D(tColor, suv).rgb * w;',
    '      wsum += w;',
    '    }',
    '  }',
    '  vec3 col = sum / wsum;',
    // 렌더타겟은 선형(linear) 색으로 들어온다. 흐림은 선형에서 계산하고
    // 마지막에 직접 sRGB 로 변환한다(안 하면 화면이 어둡게 죽는다).
    // 채도·비네팅 (필름 느낌)
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(lum), col, uSaturation);',
    '  vec2 p = vUv - 0.5;',
    '  float vig = 1.0 - uVignette * dot(p, p) * 2.2;',
    '  col *= clamp(vig, 0.0, 1.0);',
    '  col = mix(col * 12.92, 1.055 * pow(max(col, vec3(0.0)), vec3(0.41666)) - 0.055, step(0.0031308, col));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  function PostFX(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = true;
    this.focus = 34;
    this._focusSmooth = 34;

    // 깊이 텍스처를 지원하지 않으면 조용히 포기한다
    const gl = renderer.getContext();
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!isWebGL2 && !renderer.extensions.get('WEBGL_depth_texture')) {
      this.enabled = false;
      return;
    }

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    // r150 은 렌더타겟에 항상 선형 색을 쓴다 → 후처리 셰이더가 직접 sRGB 로 바꾼다
    this.target.texture.encoding = THREE.LinearEncoding;
    this.target.texture.generateMipmaps = false;
    const depth = new THREE.DepthTexture(2, 2);
    depth.format = THREE.DepthFormat;
    depth.type = isWebGL2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
    this.target.depthTexture = depth;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: depth },
        uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uFocus: { value: 34 },
        uAperture: { value: 0.62 },
        uMaxBlur: { value: 7.5 },
        uVignette: { value: 0.18 },
        uSaturation: { value: 1.12 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  PostFX.prototype.resize = function (w, h, pixelRatio) {
    if (!this.enabled) return;
    this._lastSize = { w, h, pixelRatio };
    const q = this.scale === undefined ? 1 : this.scale;
    const pw = Math.max(2, Math.floor(w * pixelRatio * q));
    const ph = Math.max(2, Math.floor(h * pixelRatio * q));
    this.target.setSize(pw, ph);
    this.material.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    // 해상도가 커지면 픽셀 단위 흐림 반경도 같이 커져야 보이는 결과가 같다
    this.material.uniforms.uMaxBlur.value = 7.5 * (ph / 900);
    this.material.uniforms.uNear.value = this.camera.near;
    this.material.uniforms.uFar.value = this.camera.far;
  };

  /** 느린 기기용: 후처리 해상도를 낮춘다(1 → 0.7 → 끄기) */
  PostFX.prototype.setScale = function (scale) {
    if (!this.enabled) return;
    this.scale = scale;
    if (this._lastSize) this.resize(this._lastSize.w, this._lastSize.h, this._lastSize.pixelRatio);
  };

  /** 초점 거리를 부드럽게 따라가게 한다(조준 중인 대상은 또렷하게) */
  PostFX.prototype.setFocus = function (distance, dt) {
    const target = Math.max(8, Math.min(160, distance));
    const k = Math.min(1, dt * 4.5);
    this._focusSmooth += (target - this._focusSmooth) * k;
    this.focus = this._focusSmooth;
    if (this.enabled) this.material.uniforms.uFocus.value = this._focusSmooth;
  };

  /** 도시 씬을 렌더타겟에 그린다 */
  PostFX.prototype.renderWorld = function (scene) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.clear();
      r.render(scene, this.camera);
      return;
    }
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, this.camera);
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.orthoCamera);
  };

  L.PostFX = PostFX;
})(window.LEGO);
