/* =========================================================================
 * combat.js — 전투 규칙(오른손 무기 · 왼손 두루마리)
 *
 * game.js 는 지휘자다(CLAUDE.md 2장). 규칙은 여기 있고, game.js 는 이 파일을
 * Game.prototype 에 붙여 쓴다. 숫자 정본은 loadout.js 다.
 *
 * 브릭 생물(companions.js)은 여기서 절대 피해를 받지 않는다 — 무기 판정은
 * enemies 목록만 본다. 근처에서 무기를 휘두르면 놀라 뒤로 뛸 뿐이다(아동안전 5장).
 * ========================================================================= */
(function (L) {
  'use strict';

  L.Combat = { install };

  function install(Game) {
    /** 카메라가 보는 방향 (정규화, 스크래치 재사용) */
    Game.prototype.aimDir = function () {
      return this.camera.getWorldDirection(this._dir);
    };

    /** 조준선이 땅에 닿는 지점(메테오 목표) */
    Game.prototype.aimGround = function (out) {
      const dir = this.aimDir();
      const p = this.player.pos;
      const groundY = this.city.curbY;
      if (dir.y < -0.06) {
        const t = Math.min(150, (p.y - groundY) / -dir.y);
        out.set(p.x + dir.x * t, groundY, p.z + dir.z * t);
      } else {
        out.set(p.x + dir.x * 60, groundY, p.z + dir.z * 60);
      }
      return out;
    };

    /** 오른손 공격 */
    Game.prototype.attack = function () {
      const p = this.player;
      const w = this.hands.currentWeapon();
      if (p.weaponCd > 0) return;
      if (w.ammoMax !== undefined && (p.ammo[w.id] || 0) <= 0) {
        this.hud.toast('탄약 없음! 파란 스터드를 주워라', 1.0);
        p.weaponCd = 0.4;
        return;
      }
      p.weaponCd = w.cooldown;
      this.hands.playAttack();
      // 브릭 생물은 맞지 않는다 — 근처에 있으면 놀라 뒤로 뛴다(아동안전 5장)
      this.companions.startle(p.pos, 16);
      const dir = this.aimDir();

      if (w.id === 'sword') {
        this.sfx.sword();
        const hits = this.enemies.damageCone(p.pos, dir, w.reach, Math.cos(w.arc), w.damage);
        if (hits) {
          this.hud.hitMark();
          this._tmp.copy(p.pos).addScaledVector(dir, 6);
          this.fx.debrisBurst(this._tmp, L.COLORS.silver, 3, 8);
        }
      } else if (w.id === 'blaster') {
        p.ammo.blaster--;
        this.sfx.shoot();
        this.hands.getMuzzleWorld(this._tmp);
        this.fx.shoot('stud', this._tmp, dir, {
          speed: w.speed, dmg: w.damage, life: 1.8, spin: 6,
        });
      } else if (w.id === 'bomb') {
        p.ammo.bomb--;
        this.sfx.throwBomb();
        this.hands.getMuzzleWorld(this._tmp);
        this.fx.shoot('bomb', this._tmp, dir, {
          speed: w.speed, dmg: w.damage, radius: w.radius, gravity: 62,
          fuse: w.fuse, life: w.fuse + 0.1, up: 12, spin: 3,
        });
      }
    };

    /** 왼손 두루마리 시전 */
    Game.prototype.cast = function () {
      const p = this.player;
      const s = this.hands.currentSkill();
      if (this.skillCd[s.id] > 0 || p.channelTimer > 0) return;
      if (p.mana < s.mana) {
        this.hud.toast('마나 부족! 노란 스터드를 주워라', 1.0);
        this.skillCd[s.id] = 0.35;
        return;
      }
      p.mana -= s.mana;
      this.skillCd[s.id] = s.cooldown;
      this.sfx.cast();
      const dir = this.aimDir();

      if (s.id === 'fireball') {
        this.hands.playCast(0);
        this.hands.getScrollWorld(this._tmp);
        this.fx.shoot('fireball', this._tmp, dir, {
          speed: s.speed, dmg: s.damage, radius: s.radius, life: 3.2,
        });
      } else if (s.id === 'meteor') {
        this.hands.playCast(0);
        this.aimGround(this._aim);
        this.fx.meteor(this._aim, s);
        this.hud.toast('☄️ 메테오!', 0.9);
      } else if (s.id === 'dragonfire') {
        this.hands.playCast(s.duration);
        p.channelTimer = s.duration;
        p.channelSkill = s;
        this.hud.toast('🐲 드래곤 파이어!', 0.9);
      }
    };

    /** 드래곤 파이어 유지 시전 처리 */
    Game.prototype.updateChannel = function (dt) {
      const p = this.player;
      if (p.channelTimer <= 0) return;
      const s = p.channelSkill;
      p.channelTimer -= dt;
      const dir = this.aimDir();
      this.hands.getScrollWorld(this._tmp);
      this._tmp.addScaledVector(dir, 3.5);   // 조금 앞에서 뿜어 시야를 덜 가린다
      // 불꽃 분사
      for (let i = 0; i < 4; i++) this.fx.flame(this._tmp, dir, 0.22);
      if (Math.random() < 0.35) this.sfx.flame();
      // 부채꼴 지속 피해
      const hits = this.enemies.damageCone(p.pos, dir, s.range, Math.cos(s.cone), s.dps * dt);
      if (hits) this.hud.hitMark();
      if (p.channelTimer <= 0) { p.channelTimer = 0; p.channelSkill = null; }
    };

    /** 조준선 앞에 있는 몬스터까지의 거리(없으면 0) — 접사 초점을 맞추는 데 쓴다 */
    Game.prototype.aimDistance = function () {
      const dir = this.aimDir();
      const p = this.player.pos;
      let best = 0, bestDot = 0.986;   // 화면 가운데 근처만
      const list = this.enemies.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        this._tmp2.set(e.pos.x - p.x, (e.pos.y + e.radius * 0.6) - p.y, e.pos.z - p.z);
        const d = this._tmp2.length();
        if (d < 3) continue;
        this._tmp2.divideScalar(d);
        const dot = this._tmp2.dot(dir);
        if (dot > bestDot) { bestDot = dot; best = d; }
      }
      return best;
    };
  }
})(window.LEGO);
