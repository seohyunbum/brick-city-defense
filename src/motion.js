/* =========================================================================
 * motion.js — 자연스러운 움직임 도구상자 (순수 수학, 부수효과 없음)
 *
 * "실제같은" 움직임은 등속 직선이 아니라 (1) 가속·감속, (2) 관성으로 끌려오는
 * 지연, (3) 멈출 때의 잔진동, (4) 앞선 부위를 뒤 부위가 따라가는 시차에서 나온다.
 * 여기에 그 네 가지를 담아두고, 연출(story86.js)과 리깅(mech86.js)이 가져다 쓴다.
 *
 * 핫패스 규칙: update 계열은 객체를 만들지 않는다. 상태는 생성 시 한 번만 잡는다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const clamp01 = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  /** 구간 [a,b] 를 0..1 로 정규화 */
  const range01 = (v, a, b) => (b === a ? 0 : clamp01((v - a) / (b - a)));

  // ---------------------------------------------------------------- 이징
  // 카메라·연출용. 이름은 "가속(in) / 감속(out)" 기준.
  const Ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    // 살짝 지나갔다 돌아오는 마무리 — 무게가 있는 물체의 정지에 쓴다
    outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    // 접지 충격처럼 툭 떨어졌다 튀는 마무리
    outBounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d; return n * t * t + 0.984375;
    },
  };

  /**
   * 프레임률에 안 흔들리는 지수 감쇠 추종.
   * lambda 가 클수록 빨리 붙는다(= 뻣뻣하다). 시선·줌처럼 "따라오는" 값에 쓴다.
   */
  function damp(current, target, lambda, dt) {
    return target + (current - target) * Math.exp(-lambda * dt);
  }

  /** 각도용 감쇠 추종 — ±π 경계에서 반대로 돌지 않는다 */
  function dampAngle(current, target, lambda, dt) {
    let d = (target - current) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return current + d * (1 - Math.exp(-lambda * dt));
  }

  /**
   * 2차 스프링(임계감쇠 근처). 목표가 갑자기 바뀌어도 속도가 이어지므로
   * 관성·오버슛·잔진동이 자연스럽게 생긴다.
   * @param {number} value 초깃값
   * @param {number} freq  고유진동수(Hz 감각). 6~14 사이가 카메라에 알맞다
   * @param {number} zeta  감쇠비. 1 = 오버슛 없음, 0.6 = 한 번 지나갔다 온다
   */
  function Spring(value, freq, zeta) {
    this.value = value || 0;
    this.velocity = 0;
    this.freq = freq === undefined ? 8 : freq;
    this.zeta = zeta === undefined ? 1 : zeta;
  }
  Spring.prototype.set = function (value) { this.value = value; this.velocity = 0; return this; };
  Spring.prototype.update = function (target, dt) {
    // 큰 dt 에서 발산하지 않게 잘라 쓴다(탭 전환 복귀 등)
    if (dt > 0.05) dt = 0.05;
    const w = this.freq * Math.PI * 2;
    const a = -2 * this.zeta * w * this.velocity - w * w * (this.value - target);
    this.velocity += a * dt;
    this.value += this.velocity * dt;
    return this.value;
  };

  /** 세 축 스프링 — THREE.Vector3 를 새로 만들지 않고 목표를 스칼라로 받는다 */
  function Spring3(freq, zeta) {
    this.x = new Spring(0, freq, zeta);
    this.y = new Spring(0, freq, zeta);
    this.z = new Spring(0, freq, zeta);
  }
  Spring3.prototype.set = function (x, y, z) { this.x.set(x); this.y.set(y); this.z.set(z); return this; };
  Spring3.prototype.update = function (tx, ty, tz, dt) {
    this.x.update(tx, dt); this.y.update(ty, dt); this.z.update(tz, dt);
    return this;
  };
  /** 결과를 기존 Vector3 에 쓴다(할당 금지) */
  Spring3.prototype.writeTo = function (v) { v.set(this.x.value, this.y.value, this.z.value); return v; };

  /**
   * 결정적 1D 값 노이즈. 손으로 든 카메라의 미세한 흔들림처럼
   * "랜덤인데 부드러운" 값이 필요할 때 쓴다. seed 가 같으면 항상 같은 결과다.
   */
  function Noise1D(seed) {
    this.seed = (seed === undefined ? 1 : seed) | 0;
  }
  Noise1D.prototype._hash = function (i) {
    let h = (i * 374761393 + this.seed * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff * 2 - 1;
  };
  /** t 는 초 단위. 정수 구간마다 새 값이 나오고 사이는 부드럽게 잇는다 */
  Noise1D.prototype.at = function (t) {
    const i = Math.floor(t);
    const f = smoothstep(t - i);
    return lerp(this._hash(i), this._hash(i + 1), f);
  };
  /** 옥타브를 겹쳐 자연스러운 손떨림 — 큰 흔들림 위에 잔떨림 */
  Noise1D.prototype.fbm = function (t) {
    return this.at(t) * 0.62 + this.at(t * 2.17 + 11.3) * 0.26 + this.at(t * 4.31 + 27.9) * 0.12;
  };

  /**
   * 키프레임 트랙. keys = [{ t, v, ease }] (t 오름차순, ease 는 다음 키로 가는 이징).
   * 카메라 위치처럼 "연출가가 찍은 값"을 시간으로 뽑아낸다.
   */
  function Track(keys) {
    this.keys = keys;
  }
  Track.prototype.at = function (time) {
    const k = this.keys;
    if (time <= k[0].t) return k[0].v;
    const last = k[k.length - 1];
    if (time >= last.t) return last.v;
    for (let i = 0; i < k.length - 1; i++) {
      const a = k[i], b = k[i + 1];
      if (time > b.t) continue;
      const e = a.ease || Ease.inOutCubic;
      return lerp(a.v, b.v, e(range01(time, a.t, b.t)));
    }
    return last.v;
  };

  /**
   * 보행 위상. 0..1 을 돌며, duty 만큼이 접지(stance)다.
   * @returns {number} 0..1 (leg 별 offset 적용 후)
   */
  function gaitPhase(time, cadence, offset) {
    const p = time * cadence + (offset || 0);
    return p - Math.floor(p);
  }

  /**
   * 다리 하나의 발 궤적. 접지 구간에서는 몸 기준으로 뒤로 밀리고(=발은 땅에 붙어 있고),
   * 유각 구간에서는 앞으로 넘어온다. 넘어올 때의 높이는 앞이 낮고 뒤가 높은 비대칭 아치 —
   * 실제 보행의 발은 들 때 빠르게 들고 디딜 때 천천히 내린다.
   * @param {object} out {x, y} 에 결과를 쓴다(할당 금지)
   */
  function footCycle(out, phase, stride, lift, duty) {
    duty = duty === undefined ? 0.62 : duty;
    if (phase < duty) {
      const t = phase / duty;
      out.x = stride * (0.5 - t);
      out.y = 0;
      out.contact = 1;
    } else {
      const t = (phase - duty) / (1 - duty);
      out.x = stride * (-0.5 + Ease.inOutCubic(t));
      // 앞쪽이 높은 아치: 들어올림은 급하게, 착지는 완만하게
      out.y = lift * Math.sin(Math.PI * Math.pow(t, 0.78));
      out.contact = 0;
    }
    return out;
  }

  /**
   * 2관절 IK. 엉덩이(원점)에서 목표까지 허벅지·정강이로 닿는 각도를 푼다.
   * 평면 IK 이므로 다리를 옆으로 벌리는 각(yaw)은 호출부가 따로 준다.
   * @param {object} out {hip, knee} 라디안
   */
  function ik2(out, targetX, targetY, upper, lower) {
    let d = Math.hypot(targetX, targetY);
    const maxD = (upper + lower) * 0.999;
    const minD = Math.abs(upper - lower) * 1.001 + 1e-4;
    if (d > maxD) d = maxD;
    if (d < minD) d = minD;
    // 코사인 법칙
    const cosKnee = clamp((upper * upper + lower * lower - d * d) / (2 * upper * lower), -1, 1);
    const cosHip = clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1);
    const toTarget = Math.atan2(targetX, -targetY);   // -Y 가 아래(다리가 뻗는 쪽)
    out.hip = toTarget - Math.acos(cosHip);
    out.knee = Math.PI - Math.acos(cosKnee);
    return out;
  }

  L.Motion = {
    clamp, clamp01, lerp, smoothstep, range01,
    Ease, damp, dampAngle, Spring, Spring3, Noise1D, Track,
    gaitPhase, footCycle, ik2,
  };
})(window.LEGO = window.LEGO || {});
