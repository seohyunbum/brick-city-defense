/* =========================================================================
 * audio.js — WebAudio 로 즉석 합성하는 효과음(파일 없음)
 * 첫 클릭 이후에만 소리가 난다(브라우저 정책). 조용히 실패해도 게임은 돈다.
 * 잡음 버퍼는 1회 만들고 voice cap으로 오디오 노드 폭주를 막는다.
 * ========================================================================= */
(function (L) {
  'use strict';

  function Sfx() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.noiseBuffer = null;
    this.activeVoices = 0;
    this.maxVoices = 24;
    this.lastFlameAt = -Infinity;
    // 설정 화면이 바꾸는 값. ctx 가 아직 없으면 기억만 해두고 resume 에서 반영한다.
    this.mix = { master: 0.32, sfx: 1, mute: false };
    this.sfxBus = null;
    // 소리를 글자로 보여주는 자막 연결점(boot.js 가 HUD 로 잇는다).
    // 소리가 꺼져 있거나 WebAudio 가 없어도 자막은 나와야 하므로 재생과 분리한다.
    this.onCue = null;
  }

  /** 중요한 소리 하나를 글자로 알린다 */
  Sfx.prototype.cue = function (text) {
    if (this.onCue) this.onCue(text);
  };

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  /** 전체/효과음 음량과 음소거를 적용한다 */
  Sfx.prototype.setMix = function (master, sfx, mute) {
    if (master !== undefined) this.mix.master = clamp01(master);
    if (sfx !== undefined) this.mix.sfx = clamp01(sfx);
    if (mute !== undefined) this.mix.mute = !!mute;
    if (!this.master) return;
    this.master.gain.value = this.mix.mute ? 0 : this.mix.master;
    if (this.sfxBus) this.sfxBus.gain.value = this.mix.sfx;
  };

  Sfx.prototype.resume = function () {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        // 효과음 전용 버스 → 전체 음량. 나중에 BGM/앰비언스 버스를 나란히 붙인다.
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.setMix();
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) { this.enabled = false; }
  };

  Sfx.prototype.trackVoice = function (node) {
    if (this.activeVoices >= this.maxVoices) return false;
    this.activeVoices++;
    const self = this;
    node.onended = function () {
      self.activeVoices = Math.max(0, self.activeVoices - 1);
    };
    return true;
  };

  /** 기본 음 하나 */
  Sfx.prototype.tone = function (o) {
    if (!this.enabled || !this.ctx || this.activeVoices >= this.maxVoices) return;
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator();
    if (!this.trackVoice(osc)) return;
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.5 : o.vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
    osc.connect(g); g.connect(this.sfxBus || this.master);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  };

  /** 잡음(폭발·불). 공용 1초 buffer에 gain envelope를 적용한다. */
  Sfx.prototype.noise = function (dur, vol, freq) {
    if (!this.enabled || !this.ctx || !this.noiseBuffer || this.activeVoices >= this.maxVoices) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    if (!this.trackVoice(src)) return;
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 900, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol === undefined ? 0.5 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus || this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  Sfx.prototype.shoot = function () { this.tone({ type: 'square', f0: 900, f1: 260, dur: 0.09, vol: 0.22 }); };
  Sfx.prototype.sword = function () { this.tone({ type: 'triangle', f0: 320, f1: 1400, dur: 0.13, vol: 0.24 }); };
  Sfx.prototype.throwBomb = function () { this.tone({ type: 'sine', f0: 220, f1: 520, dur: 0.16, vol: 0.22 }); };
  Sfx.prototype.boom = function () {
    this.cue('💥 쾅!');
    this.noise(0.55, 0.55, 1200);
    this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.4, vol: 0.3 });
  };
  Sfx.prototype.cast = function () { this.tone({ type: 'sawtooth', f0: 180, f1: 980, dur: 0.28, vol: 0.2 }); };
  Sfx.prototype.flame = function () {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFlameAt < 0.08) return;
    this.lastFlameAt = now;
    this.noise(0.18, 0.16, 700);
  };
  Sfx.prototype.hurt = function () {
    this.cue('💔 맞았다!');
    this.tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.3, vol: 0.3 });
  };
  Sfx.prototype.pickup = function () { this.tone({ type: 'square', f0: 700, f1: 1300, dur: 0.09, vol: 0.16 }); };
  Sfx.prototype.pop = function () { this.tone({ type: 'square', f0: 480, f1: 160, dur: 0.11, vol: 0.18 }); };
  Sfx.prototype.wave = function () {
    this.cue('📣 웨이브 신호');
    this.tone({ type: 'square', f0: 520, f1: 780, dur: 0.16, vol: 0.2 });
    const self = this;
    setTimeout(() => self.tone({ type: 'square', f0: 780, f1: 1180, dur: 0.22, vol: 0.2 }), 150);
  };
  Sfx.prototype.gameOver = function () {
    this.cue('🔔 게임 끝 소리');
    this.tone({ type: 'sawtooth', f0: 420, f1: 90, dur: 0.9, vol: 0.3 });
  };

  L.Sfx = Sfx;
})(window.LEGO);
