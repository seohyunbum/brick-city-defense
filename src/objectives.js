/* =========================================================================
 * objectives.js — 도시 무결도·시민 대피·적 방어 목표 규칙의 단일 정본
 *
 * 시민은 플레이어 공격 판정에 들어가지 않는다. 몬스터의 역할에 따라
 * 플레이어·경찰 거점·시민 중 목표가 달라지고, 보호 결과가 승패와 점수에 반영된다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const MAX_INTEGRITY = 100;
  const CITIZEN_HITS = 2;
  const CITIZEN_LOSS_DAMAGE = 10;
  const SAFE_X = 28.5;
  const SAFE_Z = 37;

  function Objectives(city) {
    this.city = city;
    this.maxIntegrity = MAX_INTEGRITY;
    this.integrity = MAX_INTEGRITY;
    this.saved = 0;
    this.lost = 0;
    this.waveSaved = 0;
    this.waveLost = 0;
    this.wave = 1;
    this.failed = false;
    this.hooks = {
      onDamage: null,
      onCitizenSafe: null,
      onCitizenLost: null,
      onFailure: null,
    };

    this._tmp = new THREE.Vector3();
    this._playerTarget = { kind: 'player', pos: null, citizen: null };
    this._outpostTarget = {
      kind: 'outpost',
      pos: new THREE.Vector3(17, city.curbY, 10),
      citizen: null,
    };
    this._citizenTarget = { kind: 'citizen', pos: null, citizen: null };

    for (let i = 0; i < city.npcs.length; i++) {
      const n = city.npcs[i];
      n.status = 'active';
      n.hitsLeft = CITIZEN_HITS;
    }
  }

  Objectives.prototype.startRun = function () {
    this.integrity = this.maxIntegrity;
    this.saved = 0;
    this.lost = 0;
    this.failed = false;
    this.startWave(1);
  };

  Objectives.prototype.startWave = function (wave) {
    this.wave = wave;
    this.waveSaved = 0;
    this.waveLost = 0;
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      n.status = 'active';
      n.hitsLeft = CITIZEN_HITS;
      n.scared = 0;
      n.fig.visible = true;
      n.fig.position.set(n.home.x, this.city.curbY, n.home.y);
      n.fig.rotation.y = n.dir > 0 ? 0 : Math.PI;
    }
  };

  Objectives.prototype.activeCitizens = function () {
    let count = 0;
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) if (npcs[i].status === 'active') count++;
    return count;
  };

  Objectives.prototype._nearestCitizen = function (pos) {
    let best = null;
    let bestD2 = Infinity;
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.status !== 'active') continue;
      const dx = n.fig.position.x - pos.x;
      const dz = n.fig.position.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { best = n; bestD2 = d2; }
    }
    return best;
  };

  /** 역할이 읽히도록 골렘=거점, 배트=시민, 일부 슬라임=거점으로 고정한다. */
  Objectives.prototype.targetFor = function (enemy, playerPos) {
    this._playerTarget.pos = playerPos;
    if (enemy.def.boss) return this._playerTarget;
    if (enemy.type === 'golem' || (enemy.type === 'slime' && enemy.spawnOrder % 3 === 2)) {
      return this._outpostTarget;
    }
    if (enemy.type === 'bat') {
      const citizen = this._nearestCitizen(enemy.pos);
      if (citizen) {
        this._citizenTarget.pos = citizen.fig.position;
        this._citizenTarget.citizen = citizen;
        return this._citizenTarget;
      }
    }
    return this._playerTarget;
  };

  Objectives.prototype.damageTarget = function (target, amount) {
    if (!target || this.failed) return;
    if (target.kind === 'outpost') {
      this.damageCity(Math.max(1, Math.ceil(amount * 1.5)), 'outpost');
      return;
    }
    if (target.kind !== 'citizen' || !target.citizen || target.citizen.status !== 'active') return;
    const citizen = target.citizen;
    citizen.hitsLeft--;
    citizen.scared = 2.2;
    if (citizen.hitsLeft > 0) return;
    citizen.status = 'lost';
    citizen.fig.visible = false;
    this.lost++;
    this.waveLost++;
    if (this.hooks.onCitizenLost) this.hooks.onCitizenLost(citizen);
    this.damageCity(CITIZEN_LOSS_DAMAGE, 'citizen');
  };

  Objectives.prototype.damageCity = function (amount, source) {
    if (this.failed || amount <= 0) return 0;
    const before = this.integrity;
    this.integrity = Math.max(0, before - Math.round(amount));
    const applied = before - this.integrity;
    if (applied && this.hooks.onDamage) this.hooks.onDamage(source || 'outpost', applied);
    if (this.integrity === 0 && !this.failed) {
      this.failed = true;
      if (this.hooks.onFailure) this.hooks.onFailure('city');
    }
    return applied;
  };

  Objectives.prototype.repair = function (amount) {
    if (this.failed || amount <= 0) return 0;
    const before = this.integrity;
    this.integrity = Math.min(this.maxIntegrity, before + Math.round(amount));
    return this.integrity - before;
  };

  Objectives.prototype._safeCitizen = function (citizen) {
    if (citizen.status !== 'active') return false;
    citizen.status = 'safe';
    citizen.fig.visible = false;
    this.saved++;
    this.waveSaved++;
    if (this.hooks.onCitizenSafe) this.hooks.onCitizenSafe(citizen);
    return true;
  };

  /** 기존 시민 이동을 game.js에서 추출. 위협을 피해 바깥 안전 구역으로 대피한다. */
  Objectives.prototype.updateCitizens = function (dt, enemies) {
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.status !== 'active') continue;
      n.phase += dt * 2.4;
      const near = enemies.hitTest(n.fig.position, 16);
      if (near) n.scared = 1.6;
      if (n.scared > 0) {
        n.scared -= dt;
        if (near) this._tmp.set(n.fig.position.x - near.pos.x, 0, n.fig.position.z - near.pos.z);
        else this._tmp.set(n.fig.position.x < 0 ? -1 : 1, 0, 0.25);
        if (this._tmp.lengthSq() < 0.01) this._tmp.set(n.fig.position.x < 0 ? -1 : 1, 0, 0);
        this._tmp.normalize();
        n.fig.position.x += this._tmp.x * 15 * dt;
        n.fig.position.z += this._tmp.z * 15 * dt;
        n.fig.rotation.y = Math.atan2(this._tmp.x, this._tmp.z);
        L.animateWalk(n.fig, n.phase * 2.2, 1);
      } else if (n.patrol) {
        n.fig.position.z += n.dir * 5.2 * dt;
        if (Math.abs(n.fig.position.z - n.home.y) > 7) n.dir *= -1;
        n.fig.position.x += (n.home.x - n.fig.position.x) * dt * 1.6;
        n.fig.rotation.y = n.dir > 0 ? 0 : Math.PI;
        L.animateWalk(n.fig, n.phase, 0.5);
      } else {
        L.animateWalk(n.fig, n.phase * 0.35, 0.06);
      }

      const px = n.fig.position.x;
      if (Math.abs(px) < 14) n.fig.position.x = px < 0 ? -14 : 14;
      if (Math.abs(px) > 30) n.fig.position.x = px < 0 ? -30 : 30;
      if (n.fig.position.z > 38) n.fig.position.z = 38;
      if (n.fig.position.z < -60) n.fig.position.z = -60;
      if (Math.abs(n.fig.position.x) >= SAFE_X || n.fig.position.z >= SAFE_Z) this._safeCitizen(n);
    }
  };

  Objectives.prototype.completeWave = function () {
    let protectedCount = 0;
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.status !== 'active') continue;
      n.status = 'protected';
      this.saved++;
      this.waveSaved++;
      protectedCount++;
    }
    return {
      protected: protectedCount,
      evacuated: this.waveSaved - protectedCount,
      lost: this.waveLost,
      integrity: this.integrity,
    };
  };

  L.Objectives = Objectives;
})(window.LEGO);
