/* =========================================================================
 * director.js — 오픈월드 진행 담당(웨이브 디렉터의 대체물)
 *
 * 웨이브는 없다. 대신 "구역마다 정원을 유지한다".
 *   · 광장·학교·놀이터·경찰서·소방서 = 안전지대. 몬스터가 아예 안 나온다.
 *   · 그 밖의 구역은 중심에서 멀수록 위협 등급이 오르고 정원·구성이 달라진다.
 *   · 고정 랜드마크(크레인·항구)에 다가가면 그 구역의 주인이 나온다.
 *   · 플레이어에게서 멀어진 몬스터는 조용히 회수한다(보상 없음).
 *
 * game.js 는 지휘자이므로 이 규칙을 들고 있지 않는다(CLAUDE.md 2장).
 * ========================================================================= */
(function (L) {
  'use strict';

  const WC = L.WORLD_CONST;
  const LOT = WC.LOT;

  // 안전지대 — 아이가 언제든 돌아올 곳이 있어야 한다(UX_ACCESSIBILITY_CHILD_SAFETY)
  const SAFE = { plaza: 1, school: 1, playground: 1, police: 1, fire: 1 };

  // 구역별 정원과 몬스터 구성. mix 는 가중치 목록(같은 값을 여러 번 넣어 확률을 준다)
  const PROFILE = {
    downtown: { max: 6, mix: ['slime', 'slime', 'bat'] },
    market: { max: 5, mix: ['slime', 'slime', 'bat'] },
    apartment: { max: 5, mix: ['slime', 'bat', 'golem'] },
    house: { max: 4, mix: ['slime', 'slime', 'bat'] },
    park: { max: 4, mix: ['slime', 'bat'] },
    garage: { max: 5, mix: ['slime', 'golem'] },
    construction: { max: 6, mix: ['golem', 'golem', 'slime', 'bat'] },
    farm: { max: 4, mix: ['slime', 'bat'] },
    harbor: { max: 6, mix: ['bat', 'bat', 'slime', 'golem'] },
    beach: { max: 3, mix: ['slime', 'bat'] },
  };
  const DEFAULT_PROFILE = { max: 4, mix: ['slime', 'bat'] };

  // 구역의 주인 — districts.js 의 고정 랜드마크 부지에만 산다
  const LORDS = {
    '-8:-8': { name: '크레인 드래곤', type: 'dragon', scale: 1.15, hpMul: 1.0, speedMul: 0.95 },
    '12:0': { name: '항구 드래곤', type: 'dragon', scale: 1.0, hpMul: 0.85, speedMul: 1.1 },
    '-12:-2': { name: '먼바다 드래곤', type: 'dragon', scale: 1.0, hpMul: 0.85, speedMul: 1.1 },
  };

  const SPAWN_MIN = 34;      // 플레이어 코앞에 튀어나오지 않게
  const SPAWN_MAX = 62;      // 너무 멀면 영영 안 만난다
  const CULL_DIST = 190;     // 이보다 멀어지면 회수
  const LORD_TRIGGER = 72;   // 주인이 깨어나는 거리
  const LORD_COOLDOWN = 150; // 잡은 뒤 다시 나올 때까지(초)

  /** 중심에서 멀수록 위험하다 — 걸어서 도달하는 거리가 곧 난이도 곡선이다 */
  function levelAt(lotX, lotZ) {
    const ring = Math.max(Math.abs(lotX), Math.abs(lotZ));
    return 1 + Math.min(3, Math.floor(ring / 4));
  }

  function Director(world, enemies) {
    this.world = world;
    this.enemies = enemies;
    this.hooks = { onDistrict: null, onLord: null };
    this._pos = new THREE.Vector3();
    this.reset();
  }

  Director.prototype.reset = function () {
    this.lotX = null;
    this.lotZ = null;
    this.type = 'plaza';
    this.label = '브릭 시티';
    this.level = 1;
    this.safe = true;
    this.spawnTimer = 1.4;
    this.cullTimer = 2.0;
    this.lordCd = {};
    this.lordKey = null;
  };

  /** 현재 구역 프로필 — HUD 와 스폰 규칙이 같은 값을 본다 */
  Director.prototype.profile = function () {
    return this.safe ? null : (PROFILE[this.type] || DEFAULT_PROFILE);
  };

  Director.prototype.threatLabel = function () {
    if (this.safe) return '안전';
    return '위험 ' + this.level;
  };

  /**
   * 도로 위 한 점을 고른다. 건물 안에 몬스터를 낳지 않으려고
   * 가까운 도로 중심선으로 붙인 뒤 콜라이더 여유를 확인한다.
   */
  Director.prototype._pickSpawn = function (px, pz, out) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const d = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      let x = px + Math.cos(a) * d;
      let z = pz + Math.sin(a) * d;
      // 가까운 쪽 도로 중심선으로 스냅 (도로는 부지 경계 x=k*LOT, z=k*LOT 위에 있다)
      const nx = Math.round(x / LOT) * LOT;
      const nz = Math.round(z / LOT) * LOT;
      if (Math.abs(x - nx) < Math.abs(z - nz)) x = nx; else z = nz;
      out.set(x, this.world.curbY, z);
      this.world.clamp(out);
      if (Math.abs(out.x - px) < SPAWN_MIN * 0.5 && Math.abs(out.z - pz) < SPAWN_MIN * 0.5) continue;
      const cols = this.world.collidersNear(out.x, out.z);
      let gap = Infinity;
      for (let i = 0; i < cols.length; i++) {
        const o = cols[i];
        const g = Math.max(Math.abs(out.x - o.x) - o.hx, Math.abs(out.z - o.z) - o.hz);
        if (g < gap) gap = g;
      }
      if (gap > 3.4) return out;
    }
    return null;
  };

  Director.prototype._pickType = function (profile) {
    const mix = profile.mix;
    return mix[Math.floor(Math.random() * mix.length)];
  };

  /** 구역 안에 살아 있는(주인 제외) 마릿수 */
  Director.prototype._population = function () {
    const list = this.enemies.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.alive && !e.isLord) n++;
    }
    return n;
  };

  /** 구역에 막 들어섰을 때 몇 마리 바로 풀어 준다 — 텅 빈 채로 기다리지 않게 */
  Director.prototype._seed = function (playerPos, count) {
    const profile = this.profile();
    if (!profile) return 0;
    let made = 0;
    for (let i = 0; i < count; i++) {
      if (this._population() >= profile.max) break;
      const pos = this._pickSpawn(playerPos.x, playerPos.z, this._pos);
      if (!pos) continue;
      if (this.enemies.spawnAt(this._pickType(profile), pos, { level: this.level })) made++;
    }
    this.spawnTimer = 1.6;
    return made;
  };

  /** 멀리 떨어진 몬스터 회수 — 풀이 남의 구역 몬스터로 막히지 않게 */
  Director.prototype._cull = function (playerPos) {
    const list = this.enemies.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const dx = e.pos.x - playerPos.x, dz = e.pos.z - playerPos.z;
      if (dx * dx + dz * dz > CULL_DIST * CULL_DIST) this.enemies.despawn(e);
    }
  };

  /** 고정 랜드마크의 주인 — 다가가면 깨어나고, 잡으면 한동안 안 나온다 */
  Director.prototype._updateLord = function (dt, playerPos) {
    for (const k in this.lordCd) {
      if (this.lordCd[k] > 0) this.lordCd[k] -= dt;
    }
    if (this.safe) return;   // 안전지대에는 주인도 오지 않는다
    if (this.enemies.boss && this.enemies.boss.alive) return;
    for (const key in LORDS) {
      if ((this.lordCd[key] || 0) > 0) continue;
      const parts = key.split(':');
      const cx = Number(parts[0]) * LOT + LOT / 2;
      const cz = Number(parts[1]) * LOT + LOT / 2;
      const dx = playerPos.x - cx, dz = playerPos.z - cz;
      if (dx * dx + dz * dz > LORD_TRIGGER * LORD_TRIGGER) continue;
      const def = LORDS[key];
      this._pos.set(cx, this.world.curbY, cz);
      const lord = this.enemies.spawnAt(def.type, this._pos, {
        lord: true, level: this.level + 1,
        scale: def.scale, hpMul: def.hpMul, speedMul: def.speedMul,
      });
      if (lord) {
        lord.lordName = def.name;
        this.lordCd[key] = LORD_COOLDOWN;
        if (this.hooks.onLord) this.hooks.onLord(def.name);
      }
      return;
    }
  };

  Director.prototype.update = function (dt, playerPos) {
    const lx = Math.floor(playerPos.x / LOT);
    const lz = Math.floor(playerPos.z / LOT);
    if (lx !== this.lotX || lz !== this.lotZ) {
      this.lotX = lx; this.lotZ = lz;
      this.type = L.Districts.typeAt(this.world.seed, lx, lz);
      this.label = L.Districts.labelAt(this.world.seed, lx, lz);
      this.level = levelAt(lx, lz);
      this.safe = !!SAFE[this.type];
      if (this.hooks.onDistrict) this.hooks.onDistrict(this.label, this.threatLabel(), this.safe);
      if (!this.safe && this._population() < 2) this._seed(playerPos, 3);
    }

    this.cullTimer -= dt;
    if (this.cullTimer <= 0) { this.cullTimer = 2.0; this._cull(playerPos); }

    this._updateLord(dt, playerPos);

    const profile = this.profile();
    if (!profile) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.9;
    if (this._population() >= profile.max) return;
    const pos = this._pickSpawn(playerPos.x, playerPos.z, this._pos);
    if (!pos) return;
    this.enemies.spawnAt(this._pickType(profile), pos, { level: this.level });
  };

  L.Director = Director;
})(window.LEGO);
