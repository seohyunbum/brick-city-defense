/* =========================================================================
 * legion.js — 스크랩 군단: 무인 기계 무리와 웨이브 디렉터
 *
 * 아동안전(CLAUDE.md 5장): 사람도 동물도 아닌 3각 기계다. 유혈 없음.
 * 쓰러지면 브릭이 팝 하고 흩어진다(BrickBurst). 무리는 조종석의 시민을 노리지 않고
 * 86호기의 장갑을 들이받을 뿐이며, 맞아도 게임은 끝나지 않는다(pilot.js 가 수리한다).
 *
 * 유닛은 전부 미리 만들어 두고 껐다 켠다(풀링). update 안에서 새 객체를 만들지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const M = L.Motion;

  const STOP_RANGE = 8.2;      // 이 거리 안에서는 더 다가오지 않고 들이받는다
  const HIT_INTERVAL = 1.5;    // 한 대가 장갑을 때리는 간격(초)
  const SEPARATION = 6.0;      // 서로 겹치지 않게 밀어내는 거리

  /**
   * @param {THREE.Scene} scene
   * @param {object} burst  story-set 의 BrickBurst — 쓰러질 때 브릭을 뿌린다
   * @param {object} opts { cap, rng }
   */
  function Legion(scene, burst, opts) {
    const o = opts || {};
    const rng = o.rng || L.RNG.mulberry32(8686);
    this.burst = burst;
    this.cap = o.cap === undefined ? 10 : o.cap;
    this.units = [];
    for (let i = 0; i < this.cap; i++) {
      const group = L.StorySet.scrapWalker(rng);
      group.visible = false;
      scene.add(group);
      this.units.push({
        group, alive: false, hp: 0, speed: 3.4, phase: rng() * 6.3,
        hitTimer: 0, flash: 0,
      });
    }
    this.hooks = { onHitPlayer: null, onDown: null };
    this.wave = 0;
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.restTimer = 0;
    this.clock = 0;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._ray = new THREE.Vector3();
  }

  Legion.prototype.reset = function () {
    for (let i = 0; i < this.units.length; i++) {
      this.units[i].alive = false;
      this.units[i].group.visible = false;
    }
    this.wave = 0;
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.clock = 0;
  };

  Legion.prototype.aliveCount = function () {
    let n = 0;
    for (let i = 0; i < this.units.length; i++) if (this.units[i].alive) n++;
    return n;
  };

  /** 다음 웨이브 예약 — 실제 등장은 한 대씩 시간차를 두고 이뤄진다 */
  Legion.prototype.startWave = function (aroundPos) {
    this.wave++;
    this.spawnLeft = Math.min(this.cap, 2 + this.wave);
    this.spawnTimer = 0;
    this._around = aroundPos;
    return this.wave;
  };

  Legion.prototype._spawnOne = function (aroundPos) {
    let unit = null;
    for (let i = 0; i < this.units.length; i++) {
      if (!this.units[i].alive) { unit = this.units[i]; break; }
    }
    if (!unit) return null;
    // 플레이어 주위 먼 고리에서 걸어 들어온다(등 뒤에서 갑자기 튀어나오지 않게 앞쪽 위주)
    const a = (Math.random() - 0.5) * Math.PI * 1.4;
    const r = 62 + Math.random() * 26;
    unit.group.position.set(aroundPos.x + Math.sin(a) * r, 0, aroundPos.z - Math.cos(a) * r);
    unit.group.visible = true;
    unit.alive = true;
    unit.hp = 2 + Math.floor(this.wave / 3);      // 웨이브가 오를수록 조금 단단해진다
    unit.speed = 3.0 + Math.min(2.2, this.wave * 0.18);
    unit.hitTimer = 0;
    return unit;
  };

  Legion.prototype.update = function (dt, targetPos) {
    this.clock += dt;
    // ----- 등장 예약 소화
    if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this._spawnOne(this._around || targetPos)) this.spawnLeft--;
        this.spawnTimer = 0.55;
      }
    }

    const v = this._v, w = this._w;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      const g = u.group;

      v.set(targetPos.x - g.position.x, 0, targetPos.z - g.position.z);
      const dist = v.length() || 1;
      v.multiplyScalar(1 / dist);

      // 서로 밀어내기 — 한 점에 뭉쳐 겹치는 걸 막는다
      w.set(0, 0, 0);
      for (let n = 0; n < this.units.length; n++) {
        if (n === i || !this.units[n].alive) continue;
        const other = this.units[n].group.position;
        const dx = g.position.x - other.x, dz = g.position.z - other.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > SEPARATION * SEPARATION || d2 < 1e-4) continue;
        const d = Math.sqrt(d2);
        w.x += dx / d * (SEPARATION - d) / SEPARATION;
        w.z += dz / d * (SEPARATION - d) / SEPARATION;
      }

      const closing = dist > STOP_RANGE ? 1 : 0;
      g.position.x += (v.x * closing * u.speed + w.x * 2.2) * dt;
      g.position.z += (v.z * closing * u.speed + w.z * 2.2) * dt;
      g.rotation.y = M.dampAngle(g.rotation.y, Math.atan2(v.x, v.z) + Math.PI, 6, dt);

      // 다리 셔플 + 몸통 들썩임(멈춰 있을 때는 조용하다)
      const t = this.clock;
      const legs = g.userData.legs;
      const gait = closing ? 5.2 : 1.6;
      for (let n = 0; n < legs.length; n++) {
        legs[n].group.rotation.x = legs[n].base + Math.sin(t * gait + legs[n].phase * 6.3) * (closing ? 0.36 : 0.12);
      }
      g.position.y = Math.abs(Math.sin(t * gait + u.phase)) * (closing ? 0.24 : 0.08);

      // 붙으면 장갑을 들이받는다
      if (u.hitTimer > 0) u.hitTimer -= dt;
      if (dist <= STOP_RANGE + 1.2 && u.hitTimer <= 0) {
        u.hitTimer = HIT_INTERVAL;
        if (this.hooks.onHitPlayer) this.hooks.onHitPlayer(1, g.position);
      }
    }
  };

  /** 한 대에게 피해를 준다. 0 이 되면 브릭으로 흩어진다. */
  Legion.prototype.hurt = function (unit, dmg) {
    if (!unit.alive) return false;
    unit.hp -= dmg;
    if (unit.hp > 0) {
      // 맞은 표시: 작은 브릭이 튄다
      this.burst.pop(unit.group.position.x, 3.2, unit.group.position.z, 3, 3.5);
      return false;
    }
    unit.alive = false;
    unit.group.visible = false;
    this.burst.pop(unit.group.position.x, 2.8, unit.group.position.z, 16, 7);
    if (this.hooks.onDown) this.hooks.onDown(unit);
    return true;
  };

  /**
   * 기관총 히트스캔. 광선에 가장 먼저 닿는 한 대를 찾는다.
   * @param {THREE.Vector3} origin  총구
   * @param {THREE.Vector3} dir     정규화된 방향
   * @returns {object|null} { unit, distance }
   */
  Legion.prototype.raycast = function (origin, dir, maxDist, radius) {
    const r = radius === undefined ? 2.2 : radius;
    let best = null;
    let bestT = maxDist;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      const p = u.group.position;
      this._ray.set(p.x - origin.x, p.y + 3.4 - origin.y, p.z - origin.z);
      const t = this._ray.dot(dir);
      if (t < 0 || t > bestT) continue;
      // 광선에서 유닛 중심까지의 수직 거리
      const px = this._ray.x - dir.x * t;
      const py = this._ray.y - dir.y * t;
      const pz = this._ray.z - dir.z * t;
      if (px * px + py * py + pz * pz > r * r) continue;
      best = u;
      bestT = t;
    }
    return best ? { unit: best, distance: bestT } : null;
  };

  /**
   * 칼 부채꼴. 앞쪽 일정 각도 안, 일정 거리 안의 기계를 모두 벤다.
   * @returns {number} 쓰러뜨린 수
   */
  Legion.prototype.sweep = function (origin, forward, range, cosHalf, dmg) {
    let downed = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      const p = u.group.position;
      this._ray.set(p.x - origin.x, 0, p.z - origin.z);
      const d = this._ray.length();
      if (d > range || d < 1e-3) continue;
      this._ray.multiplyScalar(1 / d);
      if (this._ray.x * forward.x + this._ray.z * forward.z < cosHalf) continue;
      if (this.hurt(u, dmg)) downed++;
    }
    return downed;
  };

  L.Legion = Legion;
})(window.LEGO = window.LEGO || {});
