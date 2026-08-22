/* =========================================================================
 * progression.js — 구역의 주인을 잡으면 받는 강화
 * 웨이브 사이 모달은 없다. 보상은 그 자리에서 즉시 적용된다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const GRANTS = ['ammo', 'mana', 'heart'];

  function Progression(player) {
    this.player = player;
    this.choiceCount = 0;
  }

  Progression.prototype.reset = function () {
    this.choiceCount = 0;
  };

  /** 주인을 잡을 때마다 다른 보상이 순서대로 온다 */
  Progression.prototype.award = function () {
    const p = this.player;
    const kind = GRANTS[this.choiceCount % GRANTS.length];
    this.choiceCount++;
    if (kind === 'ammo') {
      p.ammo.blaster = L.weaponById('blaster').ammoMax;
      p.ammo.bomb = L.weaponById('bomb').ammoMax;
      return '📦 탄약이 가득 찼다';
    }
    if (kind === 'mana') {
      p.mana = L.PLAYER.maxMana;
      p.manaRegenBonus = Math.min(3, p.manaRegenBonus + 0.75);
      return '✨ 마나 재생이 빨라졌다';
    }
    p.hearts = Math.min(L.PLAYER.maxHearts, p.hearts + 2);
    return '❤️ 체력을 되찾았다';
  };

  L.Progression = Progression;
})(window.LEGO);
