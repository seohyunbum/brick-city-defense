/* =========================================================================
 * player.js — 1인칭 플레이어 이동 · 시선 · 쿨다운 갱신
 *
 * game.js 에서 추출했다. 함수는 game 인스턴스를 `this` 로 받는 mixin 이므로
 * game.js 가 `Object.assign(Game.prototype, L.PlayerController)` 한다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const P = L.PLAYER;

  const PlayerController = {};

  /** 이동·시선·자원을 한 프레임 진행하고 이동 속도(0~1)를 돌려준다 */
  PlayerController.updatePlayer = function (dt) {
    const p = this.player;
    const inp = this.input;
    inp.sample();
    const look = inp.consumeLook(this._look);
    p.yaw += look.yaw;
    p.pitch = Math.max(-1.15, Math.min(0.95, p.pitch + look.pitch));

    // 이동(카메라 기준)
    let mx = inp.moveX, mz = inp.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const speed = (inp.sprint ? P.sprintSpeed : P.walkSpeed) * (p.channelTimer > 0 ? 0.55 : 1);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    // yaw 0 일 때 앞 = -Z  (앞 = (-sin, -cos), 오른쪽 = (cos, -sin))
    const vx = (mx * cos - mz * sin) * speed * dt;
    const vz = (-mz * cos - mx * sin) * speed * dt;
    p.pos.x += vx;
    p.pos.z += vz;

    // 도시 충돌 + 경계
    L.resolveCollision(p.pos, 2.0, this.city.colliders);
    const b = this.city.bounds;
    p.pos.x = Math.max(b.minX, Math.min(b.maxX, p.pos.x));
    p.pos.z = Math.max(b.minZ, Math.min(b.maxZ, p.pos.z));

    // 걸을 때 시선 흔들림
    const moving = len > 0.05;
    p.bob += dt * (moving ? (inp.sprint ? 13 : 9) : 2.2);
    const bobY = moving ? Math.sin(p.bob) * (inp.sprint ? 0.22 : 0.14) : Math.sin(p.bob) * 0.04;
    p.pos.y = P.eyeHeight + this.city.curbY;

    this.camera.position.set(p.pos.x, p.pos.y + bobY, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, Math.sin(p.bob * 0.5) * (moving ? 0.012 : 0.003));

    // 쿨다운·마나·콤보
    if (p.weaponCd > 0) p.weaponCd -= dt;
    for (const k in this.skillCd) if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    p.mana = Math.min(P.maxMana, p.mana + P.manaRegen * dt);
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.combo = 0;
    }

    // 공격 입력(누르고 있으면 연사)
    if (this.input.attackHeld) this.attack();
    if (this.input.castHeld) this.cast();

    return moving ? (inp.sprint ? 1 : 0.6) : 0;
  };

  L.PlayerController = PlayerController;
})(window.LEGO);
