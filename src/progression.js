/* =========================================================================
 * progression.js — 웨이브 사이 지원 선택과 런내 강화 규칙
 * ========================================================================= */
(function (L) {
  'use strict';

  function Progression(player, objectives) {
    this.player = player;
    this.objectives = objectives;
    this.choiceCount = 0;
  }

  Progression.prototype.reset = function () {
    this.choiceCount = 0;
  };

  Progression.prototype.choose = function (kind) {
    const p = this.player;
    let message = '';
    if (kind === 'ammo') {
      p.ammo.blaster = L.weaponById('blaster').ammoMax;
      p.ammo.bomb = L.weaponById('bomb').ammoMax;
      message = '📦 탄약 보급 완료';
    } else if (kind === 'repair') {
      const repaired = this.objectives.repair(18);
      message = repaired ? ('🔧 도시 무결도 +' + repaired) : '🔧 도시는 이미 튼튼하다';
    } else if (kind === 'mana') {
      p.mana = L.PLAYER.maxMana;
      p.manaRegenBonus = Math.min(3, p.manaRegenBonus + 0.75);
      message = '✨ 마나 재생 강화';
    } else {
      return '';
    }
    this.choiceCount++;
    return message;
  };

  L.Progression = Progression;
})(window.LEGO);
