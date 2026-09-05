/* =========================================================================
 * city-anim.js — 살아 있는 도시: 헬리콥터 · 크레인 · 경광등 · 시민 미니피그
 *
 * game.js 에서 추출했다. game 인스턴스를 `this` 로 받는 mixin 이므로
 * game.js 가 `Object.assign(Game.prototype, L.CityAnim)` 한다.
 * 시민은 공격 대상이 아니라 몬스터가 가까우면 도망치는 보호 대상이다(CLAUDE.md §5).
 * ========================================================================= */
(function (L) {
  'use strict';

  const CityAnim = {};

  /** 헬리콥터·크레인·경광등·시민을 한 프레임 움직인다 */
  CityAnim.updateCity = function (dt) {
    const a = this.city.anim;
    this.time += dt;
    const t = this.time;

    // 헬리콥터: 도시 위를 크게 돈다
    if (a.heli) {
      const r = 78, sp = 0.12;
      a.heli.group.position.set(Math.cos(t * sp) * r, 58 + Math.sin(t * 0.4) * 3, -46 + Math.sin(t * sp) * r);
      a.heli.group.rotation.y = -t * sp + Math.PI / 2;
      a.heli.rotor.rotation.y += dt * 26;
      a.heli.tailRotor.rotation.x += dt * 30;
    }
    // 크레인 훅: 천천히 흔들린다
    if (a.crane) {
      a.crane.hook.rotation.z = Math.sin(t * 0.5) * 0.05;
      a.crane.group.rotation.y = Math.sin(t * 0.07) * 0.12;
    }
    // 경찰차 경광등 번쩍
    if (a.police) {
      const on = (t * 3) % 2 < 1;
      a.police.lights[0].material.color.setHex(on ? 0x63b3ff : 0x123a63);
      a.police.lights[1].material.color.setHex(on ? 0x123a63 : 0x63b3ff);
    }

    // 시민: 인도를 오가고, 몬스터가 가까우면 도망친다
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      n.phase += dt * 2.4;
      const near = this.enemies.hitTest(n.fig.position, 16);
      if (near) n.scared = 1.6;
      if (n.scared > 0) {
        n.scared -= dt;
        // 몬스터 반대쪽으로 종종걸음
        this._tmp.set(n.fig.position.x - (near ? near.pos.x : 0), 0, n.fig.position.z - (near ? near.pos.z : -1));
        if (this._tmp.lengthSq() < 0.01) this._tmp.set(0, 0, 1);
        this._tmp.normalize();
        n.fig.position.x += this._tmp.x * 15 * dt;
        n.fig.position.z += this._tmp.z * 15 * dt;
        n.fig.rotation.y = Math.atan2(this._tmp.x, this._tmp.z);
        L.animateWalk(n.fig, n.phase * 2.2, 1);
      } else if (n.patrol) {
        // 제자리 근처를 왕복
        n.fig.position.z += n.dir * 5.2 * dt;
        if (Math.abs(n.fig.position.z - n.home.y) > 7) n.dir *= -1;
        n.fig.position.x += (n.home.x - n.fig.position.x) * dt * 1.6;
        n.fig.rotation.y = n.dir > 0 ? 0 : Math.PI;
        L.animateWalk(n.fig, n.phase, 0.5);
      } else {
        L.animateWalk(n.fig, n.phase * 0.35, 0.06);
      }
      // 인도 밖으로 너무 나가지 않게
      const px = n.fig.position.x;
      if (Math.abs(px) < 14) n.fig.position.x = px < 0 ? -14 : 14;
      if (Math.abs(px) > 30) n.fig.position.x = px < 0 ? -30 : 30;
      if (n.fig.position.z > 38) n.fig.position.z = 38;
      if (n.fig.position.z < -60) n.fig.position.z = -60;
    }
  };

  L.CityAnim = CityAnim;
})(window.LEGO);
