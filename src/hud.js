/* =========================================================================
 * hud.js — DOM HUD. loadout.js 표를 그대로 그린다.
 * 왼쪽 슬롯 = 왼손 두루마리, 오른쪽 슬롯 = 오른손 무기 (화면 배치도 손 위치대로)
 * ========================================================================= */
(function (L) {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function HUD() {
    this.dom = {
      hud: el('hud'),
      wave: el('wave-value'),
      left: el('left-value'),
      score: el('score-value'),
      combo: el('combo-value'),
      comboPanel: el('combo-panel'),
      hearts: el('hearts'),
      manaFill: el('mana-fill'),
      manaText: el('mana-text'),
      leftRow: el('left-row'),
      rightRow: el('right-row'),
      toast: el('toast'),
      hitmark: el('hitmark'),
      hurt: el('hurt-flash'),
      bossBar: el('boss-bar'),
      bossFill: el('boss-fill'),
      startScreen: el('start-screen'),
      overScreen: el('over-screen'),
      pauseScreen: el('pause-screen'),
      overWave: el('over-wave'),
      overScore: el('over-score'),
      overKills: el('over-kills'),
      overBest: el('over-best'),
      overTitle: el('over-title'),
      touch: el('touch'),
    };
    this.slots = { right: [], left: [] };
    this._buildSlots(this.dom.rightRow, L.WEAPONS, 'right');
    this._buildSlots(this.dom.leftRow, L.SKILLS, 'left');
    this._toastTimer = 0;
    this._hitTimer = 0;
    this._comboTimer = 0;
    this._lastHearts = -1;
  }

  HUD.prototype._buildSlots = function (row, items, side) {
    row.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML =
        '<div class="key">' + it.key + '</div>' +
        '<div class="emoji">' + it.emoji + '</div>' +
        '<div class="name">' + it.name + '</div>' +
        '<div class="meta"></div>' +
        '<div class="cd"></div>';
      row.appendChild(d);
      this.slots[side].push({ root: d, meta: d.querySelector('.meta'), cd: d.querySelector('.cd'), def: it });
    }
  };

  HUD.prototype.show = function (visible) {
    this.dom.hud.classList.toggle('hidden', !visible);
  };

  HUD.prototype.showTouch = function (visible) {
    this.dom.touch.classList.toggle('hidden', !visible);
  };

  /** 매 프레임 갱신 (state = game 이 넘겨주는 값 묶음) */
  HUD.prototype.update = function (dt, s) {
    this.dom.wave.textContent = s.wave;
    this.dom.left.textContent = s.remaining;
    this.dom.score.textContent = s.score;
    this.dom.combo.textContent = s.combo > 1 ? ('x' + s.combo) : '0';

    // 하트
    if (s.hearts !== this._lastHearts) {
      this._lastHearts = s.hearts;
      const max = L.PLAYER.maxHearts;
      let html = '';
      for (let i = 0; i < max; i++) {
        html += '<div class="heart' + (i < s.hearts ? '' : ' empty') + '">' +
          (i < s.hearts ? '❤️' : '🤍') + '</div>';
      }
      this.dom.hearts.innerHTML = html;
    }

    // 마나
    const mp = Math.max(0, Math.min(1, s.mana / L.PLAYER.maxMana));
    this.dom.manaFill.style.width = (mp * 100).toFixed(1) + '%';
    this.dom.manaText.textContent = Math.round(s.mana) + ' / ' + L.PLAYER.maxMana;

    // 오른손 무기 슬롯
    for (let i = 0; i < this.slots.right.length; i++) {
      const slot = this.slots.right[i];
      const active = i === s.weaponIndex;
      slot.root.classList.toggle('active', active);
      const def = slot.def;
      if (def.ammoMax !== undefined) {
        const ammo = s.ammo[def.id] || 0;
        slot.meta.textContent = ammo + ' / ' + def.ammoMax;
        slot.root.classList.toggle('empty', ammo <= 0);
      } else {
        slot.meta.textContent = '무한';
        slot.root.classList.remove('empty');
      }
      const cd = active ? Math.max(0, s.weaponCd) / def.cooldown : 0;
      slot.cd.style.height = (cd * 100).toFixed(0) + '%';
    }

    // 왼손 두루마리 슬롯
    for (let i = 0; i < this.slots.left.length; i++) {
      const slot = this.slots.left[i];
      const active = i === s.skillIndex;
      slot.root.classList.toggle('active', active);
      const def = slot.def;
      slot.meta.textContent = '마나 ' + def.mana;
      const cdLeft = s.skillCd[def.id] || 0;
      slot.cd.style.height = ((cdLeft / def.cooldown) * 100).toFixed(0) + '%';
      slot.root.classList.toggle('empty', s.mana < def.mana || cdLeft > 0);
    }

    // 보스 체력
    if (s.boss) {
      this.dom.bossBar.classList.remove('hidden');
      this.dom.bossFill.style.width = (Math.max(0, s.boss.hp / s.boss.maxHp) * 100).toFixed(1) + '%';
    } else {
      this.dom.bossBar.classList.add('hidden');
    }

    // 타이머류
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.dom.toast.classList.remove('on');
    }
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this.dom.hitmark.classList.remove('on');
    }
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) this.dom.comboPanel.classList.remove('pop');
    }
  };

  HUD.prototype.toast = function (text, seconds) {
    this.dom.toast.textContent = text;
    this.dom.toast.classList.add('on');
    this._toastTimer = seconds || 1.8;
  };

  HUD.prototype.hitMark = function () {
    this.dom.hitmark.classList.add('on');
    this._hitTimer = 0.12;
  };

  HUD.prototype.comboPop = function () {
    this.dom.comboPanel.classList.add('pop');
    this._comboTimer = 0.14;
  };

  HUD.prototype.hurt = function () {
    const h = this.dom.hurt;
    h.classList.add('on');
    setTimeout(() => h.classList.remove('on'), 90);
  };

  HUD.prototype.screen = function (name) {
    this.dom.startScreen.classList.toggle('hidden', name !== 'start');
    this.dom.overScreen.classList.toggle('hidden', name !== 'over');
    this.dom.pauseScreen.classList.toggle('hidden', name !== 'pause');
  };

  HUD.prototype.gameOver = function (s) {
    this.dom.overWave.textContent = s.wave;
    this.dom.overScore.textContent = s.score;
    this.dom.overKills.textContent = s.kills;
    this.dom.overBest.textContent = s.best;
    this.dom.overTitle.textContent = s.win ? '도시를 지켜냈다! 🎉' : '도시가 무너졌다…';
    this.screen('over');
  };

  L.HUD = HUD;
})(window.LEGO);
