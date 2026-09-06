/* =========================================================================
 * story-app.js — 단편 재생기: 렌더러 · 루프 · 자막 · 컨트롤
 * story.html 을 더블클릭(file://)하면 바로 돈다. 서버·빌드·CDN 없음.
 * ========================================================================= */
(function (L) {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function App() {
    const canvas = el('stage');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // 셀 룩은 톤매핑을 걸지 않는다 — 색이 눕지 않아야 애니메이션 느낌이 산다
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;   // 두 프레임에 한 번만 갱신
    this._shadowTick = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 700);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.story = new L.Story86(this.scene, { reduceMotion: !!reduce });

    this.playing = false;
    this.subtitles = true;
    this.mode = 'film';      // film | pilot
    this.pilot = null;
    this.lastT = 0;
    this._caption = el('caption');
    this._progress = el('progress-fill');
    this._title = el('titlecard');
    this._playBtn = el('btn-play');
    this._reduceBtn = el('btn-reduce');
    this._subBtn = el('btn-subtitle');
    this._playMode = el('btn-play-mode');

    this.setReduceMotion(!!reduce);
    this._wire();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  App.prototype._wire = function () {
    const self = this;
    el('btn-start').addEventListener('click', () => {
      el('intro').classList.add('hidden');
      self.play();
    });
    el('btn-start-play').addEventListener('click', () => {
      el('intro').classList.add('hidden');
      self.enterPilot();
    });
    el('btn-play-mode').addEventListener('click', () => {
      if (self.mode === 'pilot') self.exitPilot();
      else self.enterPilot();
    });
    this._playBtn.addEventListener('click', () => (self.playing ? self.pause() : self.play()));
    el('btn-restart').addEventListener('click', () => self.restart());
    this._reduceBtn.addEventListener('click', () => self.setReduceMotion(!self.story.reduceMotion));
    this._subBtn.addEventListener('click', () => self.setSubtitles(!self.subtitles));
    // 장면 건너뛰기 칩
    const chips = el('chips');
    let start = 0;
    for (let i = 0; i < L.Story86.SHOTS.length; i++) {
      const shot = L.Story86.SHOTS[i];
      const at = start;
      start += shot.dur;
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = (i + 1) + '. ' + shot.captions[0].text.slice(0, 8) + '…';
      b.addEventListener('click', () => { self.seek(at); self.play(); });
      chips.appendChild(b);
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && self.mode === 'pilot') { self.exitPilot(); return; }
      if (self.mode === 'pilot') return;     // 조종 중에는 재생 단축키를 쓰지 않는다
      if (e.key === ' ') { e.preventDefault(); self.playing ? self.pause() : self.play(); }
      else if (e.key === 'r' || e.key === 'R') self.restart();
      else if (e.key === 'ArrowRight') self.seek(self.story.time + 5);
      else if (e.key === 'ArrowLeft') self.seek(self.story.time - 5);
    });
  };

  App.prototype.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  App.prototype.play = function () {
    if (this.story.finished) this.story.seek(0);
    this.playing = true;
    this._playBtn.textContent = '⏸ 멈춤';
    this._title.classList.add('hidden');
  };
  App.prototype.pause = function () {
    this.playing = false;
    this._playBtn.textContent = '▶ 이어서';
  };
  App.prototype.restart = function () {
    this.story.reset();
    this.story.seek(0);
    this._title.classList.add('hidden');
    this.play();
  };
  App.prototype.seek = function (t) {
    this.story.seek(t);
    this._title.classList.add('hidden');
  };
  App.prototype.setReduceMotion = function (on) {
    this.story.reduceMotion = on;
    this._reduceBtn.textContent = on ? '🐢 모션 줄이기 · 켬' : '🐢 모션 줄이기 · 끔';
    this._reduceBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  App.prototype.setSubtitles = function (on) {
    this.subtitles = on;
    this._subBtn.textContent = on ? '💬 자막 · 켬' : '💬 자막 · 끔';
    this._subBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    this._caption.classList.toggle('off', !on);
  };

  /** 단편 → 조종 모드. 무대(세트)는 그대로 두고 배우만 치운다. */
  App.prototype.enterPilot = function () {
    if (this.mode === 'pilot') return;
    this.pause();
    if (!this.pilot) this.pilot = new L.Pilot(this.story, this.camera, this.canvas);
    this.pilot.hooks.onPause = () => this.exitPilot();
    this.mode = 'pilot';
    this.camera.fov = 68;
    this.camera.updateProjectionMatrix();
    this._title.classList.add('hidden');
    this._caption.textContent = '';
    document.body.classList.add('mode-pilot');
    this._playMode.textContent = '🎬 단편으로 돌아가기';
    this.pilot.enter();
  };

  App.prototype.exitPilot = function () {
    if (this.mode !== 'pilot') return;
    this.pilot.exit();
    this.mode = 'film';
    document.body.classList.remove('mode-pilot');
    this._playMode.textContent = '🕹️ 86호기 조종하기';
    if (document.exitPointerLock) document.exitPointerLock();
    // 단편은 처음 컷 구도로 돌아간다(배우도 그 컷 자리로 다시 선다)
    this.story.reset();
    this.story.seek(0);
    this.story.update(0, this.camera);
    this.story.time = 0;
    this._syncCaption();
  };

  App.prototype._loop = function (nowMs) {
    requestAnimationFrame(this._loop);
    const now = nowMs * 0.001;
    let dt = this.lastT ? now - this.lastT : 0.016;
    this.lastT = now;
    if (dt > 0.05) dt = 0.05;

    if (this.mode === 'pilot') {
      this.pilot.update(dt);
      this._shadowTick = (this._shadowTick + 1) % 2;
      this.renderer.shadowMap.needsUpdate = this._shadowTick === 0;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.playing) {
      const before = this.story.finished;
      this.story.update(dt, this.camera);
      this._syncCaption();
      this._progress.style.width = (this.story.time / this.story.duration * 100).toFixed(2) + '%';
      if (!before && this.story.finished) this._end();
    } else if (this.story.shotIndex < 0) {
      // 시작 전: 첫 컷 구도를 미리 잡아 둔다(검은 화면 대신 그림을 보여 준다)
      this.story.update(0, this.camera);
      this.story.time = 0;
      this._syncCaption();
    }

    this._shadowTick = (this._shadowTick + 1) % 2;
    this.renderer.shadowMap.needsUpdate = this._shadowTick === 0;
    this.renderer.render(this.scene, this.camera);
  };

  App.prototype._syncCaption = function () {
    if (this._caption.textContent !== this.story.caption) {
      this._caption.textContent = this.story.caption;
      // 자막이 바뀔 때 짧게 떠오르는 페이드 — 반복 점멸이 아니라 한 번씩만
      this._caption.classList.remove('pop');
      void this._caption.offsetWidth;
      this._caption.classList.add('pop');
    }
  };

  App.prototype._end = function () {
    this.pause();
    // 타이틀 카드 뒤에 마지막 자막이 겹쳐 보이지 않게 지운다
    this._caption.textContent = '';
    this.story.caption = '';
    this._title.classList.remove('hidden');
  };

  window.addEventListener('DOMContentLoaded', () => {
    try {
      window.BRICK_STORY = new App();
    } catch (err) {
      console.error(err);
      const intro = el('intro');
      if (intro) {
        intro.textContent = '';
        const box = document.createElement('div');
        box.className = 'sheet';
        const h = document.createElement('h1');
        h.textContent = '단편을 재생할 수 없었다';
        const p = document.createElement('p');
        p.textContent = String(err && err.message ? err.message : err);
        box.append(h, p);
        intro.appendChild(box);
      }
    }
  });

  L.StoryApp = App;
})(window.LEGO = window.LEGO || {});
