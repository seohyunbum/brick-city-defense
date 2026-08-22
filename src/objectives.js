/* =========================================================================
 * objectives.js — 몬스터가 무엇을 노리는가에 대한 단일 정본
 *
 * 오픈월드에는 지켜야 하는 거점도, 0 이 되면 지는 도시 무결도도 없다.
 * 몬스터는 플레이어를 노리고, 플레이어는 싸울지 지나칠지 고른다.
 *
 * 시민(city.npcs)은 아직 청크와 함께 스트리밍되지 않아 빈 배열이다.
 * 스트리밍이 붙으면 배트가 시민을 노리는 분기가 그대로 살아난다 —
 * 그때까지 이 모듈은 빈 목록 위에서 안전하게 아무 일도 하지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const CITIZEN_HITS = 2;

  function Objectives(city) {
    this.city = city;
    this.saved = 0;
    this.lost = 0;
    this.hooks = { onCitizenSafe: null, onCitizenLost: null };
    this._playerTarget = { kind: 'player', pos: null, citizen: null };
    this._citizenTarget = { kind: 'citizen', pos: null, citizen: null };
  }

  Objectives.prototype.startRun = function () {
    this.saved = 0;
    this.lost = 0;
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      npcs[i].status = 'active';
      npcs[i].hitsLeft = CITIZEN_HITS;
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

  /** 배트만 시민을 노린다. 시민이 없으면(현재) 전부 플레이어를 향한다. */
  Objectives.prototype.targetFor = function (enemy, playerPos) {
    this._playerTarget.pos = playerPos;
    if (enemy.type === 'bat' && this.city.npcs.length) {
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
    if (!target || target.kind !== 'citizen' || !target.citizen) return;
    const citizen = target.citizen;
    if (citizen.status !== 'active') return;
    citizen.hitsLeft -= amount;
    if (citizen.hitsLeft > 0) return;
    citizen.status = 'lost';
    citizen.fig.visible = false;
    this.lost++;
    if (this.hooks.onCitizenLost) this.hooks.onCitizenLost();
  };

  Objectives.prototype.updateCitizens = function (dt, enemies) {
    void dt; void enemies;
    // 시민 스트리밍이 붙기 전까지 할 일이 없다(빈 배열).
  };

  L.Objectives = Objectives;
})(window.LEGO);
