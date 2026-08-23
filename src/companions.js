/* =========================================================================
 * companions.js — 브릭 생물의 행동(만나기 · 친구 되기 · 따라오기)
 *
 * 하드 룰(CLAUDE.md 5장): 생물은 **공격 대상이 아니다**.
 *   · enemies.list 에 들어가지 않으므로 검·총·폭탄·두루마리에 맞지 않는다.
 *   · 플레이어를 때리지도 않는다. 놀라면 뒤로 폴짝 뛸 뿐이다.
 *   · 가까이 가면 도감에 "만났다"가 남고, 간식(모은 브릭)을 주면 친구가 된다.
 *
 * 성능
 *   · 마리당 드로우콜 3(몸·팔다리A·팔다리B). 동시 6마리 = 18.
 *   · 종별 지오메트리는 부팅 때 한 번 굽고 슬롯이 참조만 바꿔 쓴다.
 *   · update 안에서 new 금지 — 풀 + 스크래치 벡터만 쓴다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const MAX_LIVE = 6;         // 동시에 돌아다니는 마릿수 상한(드로우콜 예산)
  const SPAWN_MIN = 20;
  const SPAWN_MAX = 62;
  const CULL_DIST = 150;
  const MEET_DIST = 15;       // 이만큼 다가가면 도감에 남는다
  const TALK_DIST = 9;        // 친구 신청이 되는 거리
  const LEASH = 9;            // 집(스폰 지점) 주변을 이만큼만 돈다 — 건물에 안 낀다
  const CURIOUS = 30;         // 이 안에 들어오면 구경하러 다가온다 — 만나야 도감이 채워진다
  const FOLLOW_NEAR = 7;      // 친구가 화면을 가리지 않게 이만큼 떨어져 걷는다
  const FOLLOW_FAR = 42;      // 너무 뒤처지면 따라잡게 순간 이동한다

  function Companions(scene, world, dex) {
    this.scene = scene;
    this.world = world;
    this.dex = dex;
    this.hooks = { onMeet: null, onFriend: null, onDeny: null };
    this.follower = null;
    this.nearest = null;
    this.spawnTimer = 1.0;
    this.cullTimer = 2.0;
    this._pos = new THREE.Vector3();
    this._v = new THREE.Vector3();

    // 종별 지오메트리 — 부팅 때 전부 굽는다(프레임 중 생성 금지)
    this.geo = Object.create(null);
    const list = L.Creatures.SPECIES;
    for (let i = 0; i < list.length; i++) {
      this.geo[list[i].id] = L.CreatureMesh.build(list[i]);
    }

    // 슬롯 풀 — 종이 바뀌면 지오메트리 참조만 갈아 끼운다
    const material = L.CreatureMesh.material();
    this.list = [];
    for (let i = 0; i < MAX_LIVE + 1; i++) {   // +1 = 따라다니는 친구 자리
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.geo[list[0].id].body, material);
      body.castShadow = true;
      const limbA = new THREE.Mesh(this.geo[list[0].id].limbA, material);
      const limbB = new THREE.Mesh(this.geo[list[0].id].limbB, material);
      group.add(body, limbA, limbB);
      group.visible = false;
      scene.add(group);
      this.list.push({
        alive: false, sp: null, group, body, limbA, limbB,
        pos: new THREE.Vector3(), home: new THREE.Vector3(), face: 0,
        phase: 0, wander: 0, startle: 0, hop: 0,
        height: 4, radius: 1.6, hover: 0, gait: 'hop', scale: 1,
      });
    }
  }

  Companions.prototype.aliveCount = function () {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].alive) n++;
    return n;
  };

  /** 따라다니는 친구는 정원에 넣지 않는다 — 야생 개체가 줄어들면 심심해진다 */
  Companions.prototype.wildCount = function () {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (c.alive && c !== this.follower) n++;
    }
    return n;
  };

  Companions.prototype._free = function () {
    for (let i = 0; i < this.list.length; i++) {
      if (!this.list[i].alive) return this.list[i];
    }
    return null;
  };

  /** 한 마리를 그 자리에 내보낸다. species 를 주지 않으면 구역에 맞게 고른다. */
  Companions.prototype.spawnAt = function (species, pos) {
    const c = this._free();
    if (!c) return null;
    const geo = this.geo[species.id];
    if (!geo) return null;
    c.alive = true;
    c.sp = species;
    c.startle = 0;
    c.hop = 0;
    c.phase = Math.random() * 6.28;
    c.wander = 0.5 + Math.random() * 2;
    c.height = geo.height;
    c.radius = geo.radius * species.size;
    c.hover = geo.hover || 0;
    c.gait = geo.gait;
    c.scale = species.size;
    c.body.geometry = geo.body;
    c.limbA.geometry = geo.limbA;
    c.limbB.geometry = geo.limbB;
    c.limbA.position.copy(geo.pivotA);
    c.limbB.position.copy(geo.pivotB);
    c.limbA.visible = !!geo.limbA;
    c.limbB.visible = !!geo.limbB;
    c.pos.set(pos.x, this.world.curbY + c.hover * species.size, pos.z);
    c.home.copy(c.pos);
    c.group.position.copy(c.pos);
    c.group.scale.setScalar(species.size);
    c.group.visible = true;
    return c;
  };

  Companions.prototype.despawn = function (c) {
    if (!c.alive) return;
    c.alive = false;
    c.group.visible = false;
    if (this.follower === c) this.follower = null;
  };

  Companions.prototype.clear = function () {
    for (let i = 0; i < this.list.length; i++) this.despawn(this.list[i]);
    this.follower = null;
    this.nearest = null;
  };

  /** 무기를 휘두르면 근처 생물이 놀라 뒤로 뛴다 — 다치지는 않는다 */
  Companions.prototype.startle = function (pos, radius) {
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (!c.alive || c === this.follower) continue;
      const dx = c.pos.x - pos.x, dz = c.pos.z - pos.z;
      if (dx * dx + dz * dz < radius * radius) c.startle = 0.9;
    }
  };

  /**
   * 친구 신청. 가까운 생물에게 간식(모은 브릭)을 준다.
   * @returns {string} 'friend' | 'follow' | 'far' | 'poor'
   */
  Companions.prototype.befriend = function (player) {
    const c = this.nearest;
    if (!c || !c.alive) {
      if (this.hooks.onDeny) this.hooks.onDeny('가까이 다가가서 눌러 봐');
      return 'far';
    }
    const sp = c.sp;
    if (this.dex.isFriend(sp.dex)) {
      // 이미 친구다 — 같이 다닐 아이를 바꾼다
      this.follower = c;
      if (this.hooks.onFriend) this.hooks.onFriend(sp, false);
      return 'follow';
    }
    if (player.score < sp.cost) {
      if (this.hooks.onDeny) {
        this.hooks.onDeny(sp.name + '는 ' + sp.treat + '를 좋아해\n브릭 ' + sp.cost + '개가 필요해');
      }
      return 'poor';
    }
    player.score -= sp.cost;
    const fresh = this.dex.markFriend(sp);
    this.follower = c;
    c.hop = 0.7;                 // 기뻐서 폴짝
    if (this.hooks.onFriend) this.hooks.onFriend(sp, fresh);
    return 'friend';
  };

  /** HUD 가 그릴 안내 문구 (없으면 null) */
  Companions.prototype.prompt = function (player) {
    const c = this.nearest;
    if (!c || !c.alive) return null;
    const sp = c.sp;
    if (this.dex.isFriend(sp.dex)) {
      return this.follower === c ? ('💛 ' + sp.name + ' 와 함께 걷는 중') : ('🤝 F · ' + sp.name + ' 같이 가자');
    }
    if (player.score < sp.cost) return '🍪 ' + sp.name + ' · 브릭 ' + sp.cost + '개 모으면 친구가 된다';
    return '🤝 F · ' + sp.name + ' 에게 ' + sp.treat + ' 주기 (브릭 ' + sp.cost + ')';
  };

  // ------------------------------------------------------------------ 정원 유지
  Companions.prototype._spawnNear = function (playerPos, districtType, level) {
    if (this.wildCount() >= MAX_LIVE) return null;
    const pos = L.World.pickRoadPoint(this.world, playerPos.x, playerPos.z, SPAWN_MIN, SPAWN_MAX, this._pos);
    if (!pos) return null;
    return this.spawnAt(L.Creatures.pick(Math.random(), districtType, level), pos);
  };

  /** 구역에 막 들어섰을 때 몇 마리 바로 풀어 준다 — 텅 빈 채로 걷지 않게 */
  Companions.prototype.seed = function (playerPos, district, count) {
    let made = 0;
    for (let i = 0; i < count; i++) {
      if (this._spawnNear(playerPos, district.type, district.level)) made++;
    }
    this.spawnTimer = 1.4;
    return made;
  };

  Companions.prototype._cull = function (playerPos) {
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (!c.alive || c === this.follower) continue;
      const dx = c.pos.x - playerPos.x, dz = c.pos.z - playerPos.z;
      if (dx * dx + dz * dz > CULL_DIST * CULL_DIST) this.despawn(c);
    }
  };

  // ------------------------------------------------------------------ 한 마리 움직이기
  Companions.prototype._step = function (c, dt, playerPos, dist) {
    const sp = c.sp;
    const v = this._v;
    let moving = 0;

    if (c === this.follower) {
      // 친구는 플레이어를 따라온다. 너무 뒤처지면 앞질러 따라잡는다.
      if (dist > FOLLOW_FAR) {
        c.pos.set(playerPos.x + 4, c.pos.y, playerPos.z + 4);
      } else if (dist > FOLLOW_NEAR) {
        v.set(playerPos.x - c.pos.x, 0, playerPos.z - c.pos.z).normalize();
        const sprint = dist > 16 ? 1.6 : 1;
        c.pos.x += v.x * sp.speed * sprint * dt;
        c.pos.z += v.z * sp.speed * sprint * dt;
        moving = 1;
      }
      c.face = Math.atan2(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
    } else if (c.startle > 0) {
      // 놀랐다 — 플레이어 반대쪽으로 폴짝
      c.startle -= dt;
      v.set(c.pos.x - playerPos.x, 0, c.pos.z - playerPos.z);
      if (v.lengthSq() > 0.001) {
        v.normalize();
        c.pos.x += v.x * sp.speed * 1.5 * dt;
        c.pos.z += v.z * sp.speed * 1.5 * dt;
      }
      c.face = Math.atan2(v.x, v.z);
      moving = 1.4;
    } else {
      // 야생 — 집 주변을 어슬렁거리고, 너무 가까이 오면 조금 물러난다
      c.wander -= dt;
      if (c.wander <= 0) {
        c.wander = 1.6 + Math.random() * 2.6;
        c.face = Math.random() * Math.PI * 2;
      }
      const shy = dist < TALK_DIST * 0.7 ? sp.shy : 0;
      if (shy <= 0 && dist < CURIOUS && dist > TALK_DIST * 0.85) {
        // 구경하러 다가온다. 집도 같이 옮겨서 목줄에 걸리지 않게 한다.
        v.set(playerPos.x - c.pos.x, 0, playerPos.z - c.pos.z).normalize();
        c.pos.x += v.x * sp.speed * 0.5 * dt;
        c.pos.z += v.z * sp.speed * 0.5 * dt;
        c.home.copy(c.pos);
        c.face = Math.atan2(v.x, v.z);
        moving = 0.5;
      } else if (shy > 0) {
        v.set(c.pos.x - playerPos.x, 0, c.pos.z - playerPos.z);
        if (v.lengthSq() > 0.001) {
          v.normalize();
          c.pos.x += v.x * sp.speed * shy * dt;
          c.pos.z += v.z * sp.speed * shy * dt;
          c.face = Math.atan2(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
          moving = shy;
        }
      } else {
        c.pos.x += Math.sin(c.face) * sp.speed * 0.42 * dt;
        c.pos.z += Math.cos(c.face) * sp.speed * 0.42 * dt;
        moving = 0.42;
      }
      // 집에서 멀어지면 되돌아온다(도로 위에 머무는 값싼 방법)
      const hx = c.pos.x - c.home.x, hz = c.pos.z - c.home.z;
      const hd = Math.sqrt(hx * hx + hz * hz);
      if (hd > LEASH) {
        c.pos.x = c.home.x + (hx / hd) * LEASH;
        c.pos.z = c.home.z + (hz / hd) * LEASH;
        c.face = Math.atan2(-hx, -hz);
      }
    }
    this.world.clamp(c.pos);
    return moving;
  };

  /** 종류별 몸짓 — 걷기·뛰기·날개·회전 */
  Companions.prototype._animate = function (c, dt, moving) {
    const swing = Math.sin(c.phase * (6.5 + moving * 5));
    const base = this.world.curbY + c.hover * c.scale;
    if (c.gait === 'walk') {
      c.limbA.rotation.x = swing * (0.25 + moving * 0.4);
      c.limbB.rotation.x = -swing * (0.25 + moving * 0.4);
      c.pos.y = base + Math.abs(swing) * 0.12 * c.scale;
    } else if (c.gait === 'hop') {
      if (c.hop > 0) c.hop -= dt;
      const bounce = Math.abs(Math.sin(c.phase * (3.6 + moving * 3.4)));
      c.pos.y = base + bounce * (1.5 + (c.hop > 0 ? 1.6 : 0)) * c.scale;
      c.limbA.rotation.x = -bounce * 0.5;
      c.limbB.rotation.x = -bounce * 0.5;
      c.group.scale.set(c.scale * (1 + bounce * 0.06), c.scale * (1 - bounce * 0.1), c.scale * (1 + bounce * 0.06));
    } else if (c.gait === 'flap') {
      const flap = Math.sin(c.phase * (8 + moving * 6)) * 0.85;
      c.limbA.rotation.z = flap;
      c.limbB.rotation.z = -flap;
      c.pos.y = base + Math.sin(c.phase * 1.9) * 0.9 * c.scale;
    } else {
      c.limbA.rotation.y += dt * 1.5;
      c.limbB.rotation.y -= dt * 2.3;
      c.limbB.rotation.z = Math.sin(c.phase * 1.4) * 0.5;
      c.pos.y = base + Math.sin(c.phase * 1.6) * 1.1 * c.scale;
    }
    c.group.position.copy(c.pos);
    c.group.rotation.y = c.face;
  };

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @param {object} district { type, level } — 지금 구역(디렉터가 이미 계산해 둔 값)
   */
  Companions.prototype.update = function (dt, playerPos, district) {
    let best = null, bestD = TALK_DIST;

    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (!c.alive) continue;
      c.phase += dt;
      const dx = c.pos.x - playerPos.x, dz = c.pos.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // 도감 등록 — 가까이 간 것만으로 남는다(잡을 필요가 없다)
      if (dist < MEET_DIST && this.dex.markMet(c.sp) && this.hooks.onMeet) {
        this.hooks.onMeet(c.sp);
      }
      // 안내 문구는 야생 개체를 먼저 가리킨다. 따라오는 친구는 다른 후보가 없을 때만.
      if (dist < bestD) {
        if (c !== this.follower) { best = c; bestD = dist; }
        else if (!best) best = c;
      }

      const moving = this._step(c, dt, playerPos, dist);
      this._animate(c, dt, moving);
    }
    this.nearest = best;

    this.cullTimer -= dt;
    if (this.cullTimer <= 0) { this.cullTimer = 2.0; this._cull(playerPos); }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 1.3;
    this._spawnNear(playerPos, district.type, district.level);
  };

  L.Companions = Companions;
  L.COMPANION_CONST = { MAX_LIVE, MEET_DIST, TALK_DIST };
})(window.LEGO);
