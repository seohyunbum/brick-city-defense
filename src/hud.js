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
      compass: el('compass-value'),
      district: el('district-value'),
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
      cityPanel: el('city-panel'),
      cityFill: el('city-fill'),
      cityValue: el('city-value'),
      citizenValue: el('citizen-value'),
      startScreen: el('start-screen'),
      overScreen: el('over-screen'),
      pauseScreen: el('pause-screen'),
      supportScreen: el('support-screen'),
      overWave: el('over-wave'),
      overScore: el('over-score'),
      overKills: el('over-kills'),
      overBest: el('over-best'),
      overTitle: el('over-title'),
      touch: el('touch'),
      overCity: el('over-city'),
      overSaved: el('over-saved'),
      overLost: el('over-lost'),
    };
    this.slots = { right: [], left: [] };
    this._buildSlots(this.dom.rightRow, L.WEAPONS, 'right');
    this._buildSlots(this.dom.leftRow, L.SKILLS, 'left');
    this._toastTimer = 0;
    this._hitTimer = 0;
    this._comboTimer = 0;
    this._lastHearts = -1;
    this._lastIntegrity = -1;
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
  const COMPASS = ['북', '북서', '서', '남서', '남', '남동', '동', '북동'];

  /** yaw -> 방위. 규약: 앞 = (-sin(yaw), -cos(yaw)), -Z 를 북으로 본다. */
  function compassOf(yaw) {
    const TAU = Math.PI * 2;
    let a = yaw % TAU;
    if (a < 0) a += TAU;
    return COMPASS[Math.round(a / (Math.PI / 4)) % 8];
  }

  HUD.prototype.update = function (dt, s) {
    // 오픈월드 HUD — 길을 잃지 않게 방향과 현재 구역을 항상 보여준다(SPEC 10장)
    if (this.dom.compass) {
      const c = compassOf(s.yaw || 0);
      if (c !== this._lastCompass) { this._lastCompass = c; this.dom.compass.textContent = c; }
    }
    if (this.dom.district && s.district !== this._lastDistrict) {
      this._lastDistrict = s.district;
      this.dom.district.textContent = s.district || '브릭 시티';
    }
    this.dom.score.textContent = s.score;
    this.dom.combo.textContent = s.combo > 1 ? ('x' + s.combo) : '0';

    // 도시 무결도·시민 대피 패널은 몬스터 이벤트 전용이라 오픈월드 기본 HUD 에서 뺐다.
    // 이벤트가 붙으면 다시 살린다(SPEC 9장). 그때까지는 null 가드로 안전하게 지나간다.
    if (this.dom.cityFill && s.integrity !== this._lastIntegrity) {
      this._lastIntegrity = s.integrity;
      const cityRatio = Math.max(0, Math.min(1, s.integrity / s.maxIntegrity));
      this.dom.cityFill.style.width = (cityRatio * 100).toFixed(1) + '%';
      this.dom.cityValue.textContent = s.integrity + ' / ' + s.maxIntegrity;
      this.dom.cityFill.classList.toggle('warning', cityRatio <= 0.5 && cityRatio > 0.25);
      this.dom.cityFill.classList.toggle('danger', cityRatio <= 0.25);
    }
    if (this.dom.citizenValue) {
      this.dom.citizenValue.textContent = s.citizensSaved + ' / ' + s.citizensTotal +
        (s.citizensLost ? (' · 실패 ' + s.citizensLost) : '');
    }

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

  HUD.prototype.cityHurt = function () {
    const panel = this.dom.cityPanel;
    if (!panel) return;          // 오픈월드 기본 HUD 에는 무결도 패널이 없다
    panel.classList.add('hurt');
    setTimeout(() => panel.classList.remove('hurt'), 180);
  };

  HUD.prototype.screen = function (name) {
    const set = (node, on) => { if (node) node.classList.toggle('hidden', !on); };
    set(this.dom.startScreen, name === 'start');
    set(this.dom.overScreen, name === 'over');
    set(this.dom.pauseScreen, name === 'pause');
    set(this.dom.supportScreen, name === 'support');
  };

  HUD.prototype.gameOver = function (s) {
    if (!this.dom.overWave) return;   // 오픈월드에는 게임오버가 없다(SPEC 9장)
    this.dom.overWave.textContent = s.wave;
    this.dom.overScore.textContent = s.score;
    this.dom.overKills.textContent = s.kills;
    this.dom.overBest.textContent = s.best;
    this.dom.overCity.textContent = s.integrity + ' / ' + s.maxIntegrity;
    this.dom.overSaved.textContent = s.saved;
    this.dom.overLost.textContent = s.lost;
    this.dom.overTitle.textContent = s.win ? '도시를 지켜냈다! 🎉' :
      (s.reason === 'city' ? '도시 무결도가 0이 됐다…' : '수호자가 쓰러졌다…');
    this.screen('over');
  };

  L.HUD = HUD;
})(window.LEGO);
