/* =========================================================================
 * input.js — 키보드/마우스(포인터 락) + 폰 터치 조작
 * game.js 는 상태 플래그만 읽는다. 키 배정 정본은 loadout.js 의 key 값.
 * ========================================================================= */
(function (L) {
  'use strict';

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.moveX = 0;         // -1 왼 ~ +1 오른
    this.moveZ = 0;         // -1 뒤 ~ +1 앞
    this.sprint = false;
    this.attackHeld = false;
    this.castHeld = false;
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.locked = false;
    this.touchMode = false;
    this.hooks = {
      selectWeapon: null, selectSkill: null,
      swapWeapon: null, swapSkill: null,
      pause: null, resume: null,
    };
    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  Input.prototype._bindKeyboard = function () {
    const self = this;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { e.preventDefault(); return; }
      self.keys[e.code] = true;
      // 무기 1 2 3 / 두루마리 4 5 6
      for (let i = 0; i < L.WEAPONS.length; i++) {
        if (e.code === 'Digit' + L.WEAPONS[i].key && self.hooks.selectWeapon) self.hooks.selectWeapon(i);
      }
      for (let i = 0; i < L.SKILLS.length; i++) {
        if (e.code === 'Digit' + L.SKILLS[i].key && self.hooks.selectSkill) self.hooks.selectSkill(i);
      }
      if (e.code === 'KeyQ' && self.hooks.swapWeapon) self.hooks.swapWeapon(1);
      if (e.code === 'KeyE' && self.hooks.swapSkill) self.hooks.swapSkill(1);
      if (e.code === 'Space') { self.castHeld = true; e.preventDefault(); }
      if (e.code === 'Escape' && self.hooks.pause) self.hooks.pause();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      self.keys[e.code] = false;
      if (e.code === 'Space') self.castHeld = false;
    });
    window.addEventListener('blur', () => {
      self.keys = Object.create(null);
      self.attackHeld = self.castHeld = false;
    });
  };

  Input.prototype._bindMouse = function () {
    const self = this;
    const c = this.canvas;
    this.dragging = false;
    c.addEventListener('mousedown', (e) => {
      self.dragging = true;
      if (e.button === 0) self.attackHeld = true;
      if (e.button === 2) self.castHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      self.dragging = false;
      if (e.button === 0) self.attackHeld = false;
      if (e.button === 2) self.castHeld = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      // 포인터 락이 걸렸으면 그대로, 아니면 마우스를 누른 채 끌 때만 회전
      if (!self.locked && !self.dragging) return;
      self.yawDelta -= e.movementX * 0.0022;
      self.pitchDelta -= e.movementY * 0.0022;
    });
    window.addEventListener('wheel', (e) => {
      if (!self.locked) return;
      if (self.hooks.swapWeapon) self.hooks.swapWeapon(e.deltaY > 0 ? 1 : -1);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      self.locked = document.pointerLockElement === c;
      if (!self.locked) {
        self.attackHeld = self.castHeld = false;
        if (self.hooks.pause) self.hooks.pause(true);
      }
    });
  };

  Input.prototype.requestLock = function () {
    if (this.touchMode) return;
    const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  };

  Input.prototype._bindTouch = function () {
    const self = this;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    this.touchMode = true;

    // ---- 왼쪽 조이스틱
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    let stickId = -1;
    const R = 52;
    function stickMove(t) {
      const r = stick.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, R);
      dx = dx / len * clamped;
      dy = dy / len * clamped;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      self.moveX = dx / R;
      self.moveZ = -dy / R;
      self.sprint = clamped > R * 0.85;
    }
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      stickMove(t);
      e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === stickId) stickMove(e.changedTouches[i]);
      }
      e.preventDefault();
    }, { passive: false });
    function stickEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === stickId) {
          stickId = -1;
          self.moveX = self.moveZ = 0;
          self.sprint = false;
          knob.style.transform = 'translate(0,0)';
        }
      }
    }
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);

    // ---- 화면 드래그로 둘러보기
    let lookId = -1, lastX = 0, lastY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== lookId) continue;
        self.yawDelta -= (t.clientX - lastX) * 0.0055;
        self.pitchDelta -= (t.clientY - lastY) * 0.0055;
        lastX = t.clientX; lastY = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => { lookId = -1; });

    // ---- 공격/시전 버튼
    function holdButton(id, set) {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { set(true); e.preventDefault(); }, { passive: false });
      b.addEventListener('touchend', (e) => { set(false); e.preventDefault(); }, { passive: false });
      b.addEventListener('touchcancel', () => set(false));
    }
    holdButton('btn-attack', (v) => { self.attackHeld = v; });
    holdButton('btn-skill', (v) => { self.castHeld = v; });

    const bw = document.getElementById('btn-swap-weapon');
    const bs = document.getElementById('btn-swap-skill');
    if (bw) bw.addEventListener('click', () => self.hooks.swapWeapon && self.hooks.swapWeapon(1));
    if (bs) bs.addEventListener('click', () => self.hooks.swapSkill && self.hooks.swapSkill(1));
  };

  /** 프레임 시작에서 이동 축 계산 */
  Input.prototype.sample = function () {
    if (!this.touchMode) {
      const k = this.keys;
      this.moveZ = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      this.moveX = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      this.sprint = !!(k.ShiftLeft || k.ShiftRight);
    }
  };

  /** 회전 델타를 소비(누적값을 비운다) */
  Input.prototype.consumeLook = function (out) {
    out.yaw = this.yawDelta;
    out.pitch = this.pitchDelta;
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return out;
  };

  L.Input = Input;
})(window.LEGO);
