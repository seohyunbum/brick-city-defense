/* =========================================================================
 * audio.js — WebAudio 로 즉석 합성하는 효과음(파일 없음)
 * 첫 클릭 이후에만 소리가 난다(브라우저 정책). 조용히 실패해도 게임은 돈다.
 * ========================================================================= */
(function (L) {
  'use strict';

  function Sfx() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  Sfx.prototype.resume = function () {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) { this.enabled = false; }
  };

  /** 기본 음 하나 */
  Sfx.prototype.tone = function (o) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.5 : o.vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  };

  /** 잡음(폭발·불) */
  Sfx.prototype.noise = function (dur, vol, freq) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 900, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol === undefined ? 0.5 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  };

  Sfx.prototype.shoot = function () { this.tone({ type: 'square', f0: 900, f1: 260, dur: 0.09, vol: 0.22 }); };
  Sfx.prototype.sword = function () { this.tone({ type: 'triangle', f0: 320, f1: 1400, dur: 0.13, vol: 0.24 }); };
  Sfx.prototype.throwBomb = function () { this.tone({ type: 'sine', f0: 220, f1: 520, dur: 0.16, vol: 0.22 }); };
  Sfx.prototype.boom = function () { this.noise(0.55, 0.55, 1200); this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.4, vol: 0.3 }); };
  Sfx.prototype.cast = function () { this.tone({ type: 'sawtooth', f0: 180, f1: 980, dur: 0.28, vol: 0.2 }); };
  Sfx.prototype.flame = function () { this.noise(0.18, 0.16, 700); };
  Sfx.prototype.hurt = function () { this.tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.3, vol: 0.3 }); };
  Sfx.prototype.pickup = function () { this.tone({ type: 'square', f0: 700, f1: 1300, dur: 0.09, vol: 0.16 }); };
  Sfx.prototype.pop = function () { this.tone({ type: 'square', f0: 480, f1: 160, dur: 0.11, vol: 0.18 }); };
  Sfx.prototype.wave = function () {
    this.tone({ type: 'square', f0: 520, f1: 780, dur: 0.16, vol: 0.2 });
    const self = this;
    setTimeout(() => self.tone({ type: 'square', f0: 780, f1: 1180, dur: 0.22, vol: 0.2 }), 150);
  };
  Sfx.prototype.gameOver = function () {
    this.tone({ type: 'sawtooth', f0: 420, f1: 90, dur: 0.9, vol: 0.3 });
  };

  L.Sfx = Sfx;
})(window.LEGO);
