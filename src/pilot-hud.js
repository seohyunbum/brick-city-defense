/* =========================================================================
 * pilot-hud.js — 조종 모드 HUD (하트 · 총열 온도 · 웨이브 · 토스트)
 * 화면 표시만 담당한다. 규칙은 pilot.js 에 있다.
 * ========================================================================= */
(function (L) {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function PilotHUD() {
    this.root = el('pilot-hud');
    this.hearts = el('p-hearts');
    this.heatFill = el('p-heat-fill');
    this.heatText = el('p-heat-text');
    this.wave = el('p-wave');
    this.kills = el('p-kills');
    this.best = el('p-best');
    this.enemies = el('p-enemies');
    this.toastEl = el('p-toast');
    this.hurtEl = el('p-hurt');
    this.hitEl = el('p-hit');
    this.touch = el('pilot-touch');
    this._hearts = -1;
    this._toast = 0;
    this._hurt = 0;
    this._hit = 0;
  }

  PilotHUD.prototype.show = function (on) {
    this.root.classList.toggle('hidden', !on);
    if (this.touch) {
      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      this.touch.classList.toggle('hidden', !(on && isTouch));
    }
    if (!on) {
      this.toastEl.textContent = '';
      this.toastEl.classList.remove('on');
    }
  };

  PilotHUD.prototype.toast = function (text, seconds) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this._toast = seconds === undefined ? 1.8 : seconds;
  };

  PilotHUD.prototype.hurt = function () { this._hurt = 0.35; this.hurtEl.classList.add('on'); };
  PilotHUD.prototype.hitMark = function () { this._hit = 0.18; this.hitEl.classList.add('on'); };

  PilotHUD.prototype.update = function (dt, s) {
    if (s.hearts !== this._hearts) {
      this._hearts = s.hearts;
      this.hearts.textContent = '';
      for (let i = 0; i < s.maxHearts; i++) {
        const h = document.createElement('span');
        h.className = 'p-heart' + (i < s.hearts ? '' : ' out');
        h.textContent = i < s.hearts ? '🛡️' : '·';
        this.hearts.appendChild(h);
      }
    }
    this.heatFill.style.width = (s.heat * 100).toFixed(1) + '%';
    this.heatFill.classList.toggle('hot', s.overheated);
    this.heatText.textContent = s.overheated ? '총열 과열 — 식는 중'
      : s.heat > 0.6 ? '총열 뜨거움' : '총열 시원함';
    this.wave.textContent = String(s.wave);
    this.kills.textContent = String(s.kills);
    this.best.textContent = String(s.best);
    this.enemies.textContent = String(s.enemies);
    this.root.classList.toggle('repairing', s.repair > 0);

    if (this._toast > 0) {
      this._toast -= dt;
      if (this._toast <= 0) this.toastEl.classList.remove('on');
    }
    if (this._hurt > 0) {
      this._hurt -= dt;
      if (this._hurt <= 0) this.hurtEl.classList.remove('on');
    }
    if (this._hit > 0) {
      this._hit -= dt;
      if (this._hit <= 0) this.hitEl.classList.remove('on');
    }
  };

  L.PilotHUD = PilotHUD;
})(window.LEGO = window.LEGO || {});
