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
      threat: el('threat-value'),
      score: el('score-value'),
      dex: el('dex-value'),
      prompt: el('interact-prompt'),
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
      bossName: el('boss-name'),
      startScreen: el('start-screen'),
      pauseScreen: el('pause-screen'),
      touch: el('touch'),
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

  /** 도감을 펼치면 HUD 를 눌러 둔다 — 글자가 겹쳐 읽기 어려워지지 않게 */
  HUD.prototype.showDex = function (visible) {
    this.dom.hud.classList.toggle('dimmed', !!visible);
    if (visible && this.dom.prompt) this.dom.prompt.classList.add('hidden');
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
    // 실내는 접두 아이콘으로 — ' · 실내' 를 붙이면 좁은 패널에서 두 줄로 깨진다
    const where = (s.indoors ? '🏠 ' : '') + (s.district || '브릭 시티');
    if (this.dom.district && where !== this._lastDistrict) {
      this._lastDistrict = where;
      this.dom.district.textContent = where;
    }
    this.dom.score.textContent = s.score;

    // 브릭 도감 진행도와 "F 로 친구 되기" 안내
    if (this.dom.dex && s.dexTotal) {
      const dexText = s.dexMet + ' / ' + s.dexTotal;
      if (dexText !== this._lastDex) { this._lastDex = dexText; this.dom.dex.textContent = dexText; }
    }
    if (this.dom.prompt && s.prompt !== this._lastPrompt) {
      this._lastPrompt = s.prompt;
      this.dom.prompt.textContent = s.prompt || '';
      this.dom.prompt.classList.toggle('hidden', !s.prompt);
    }
    this.dom.combo.textContent = s.combo > 1 ? ('x' + s.combo) : '0';

    // 위협 — 지금 구역이 안전한지, 얼마나 센 몬스터가 사는지 한눈에
    if (this.dom.threat && s.threat !== this._lastThreat) {
      this._lastThreat = s.threat;
      this.dom.threat.textContent = s.threat || '안전';
      this.dom.threat.classList.toggle('danger', !s.safe);
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
      const bossLabel = '👑 ' + (s.boss.lordName || s.boss.def.name);
      if (this.dom.bossName && bossLabel !== this._lastBossName) {
        this._lastBossName = bossLabel;
        this.dom.bossName.textContent = bossLabel;
      }
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
    set(this.dom.pauseScreen, name === 'pause');
  };

  L.HUD = HUD;
})(window.LEGO);
