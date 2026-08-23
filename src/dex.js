/* =========================================================================
 * dex.js — 브릭 도감: 무엇을 만났고 누가 친구가 됐는지
 *
 * 기록은 localStorage 에 남지만, 차단돼도 게임은 그대로 돌아간다
 * (storage.js 가 메모리로 받아 준다 — QA 게이트 항목).
 * 저장 형식: 종 번호를 30비트씩 끊은 비트마스크 숫자. Storage 는 숫자만 다룬다.
 *
 * 화면(#dex-screen)은 이 표를 그대로 그린다. 아직 못 만난 칸은 이름을 감춰서
 * "다음엔 뭘 만날까" 가 남게 한다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const BITS = 30;                 // 숫자 하나에 담는 종 수(안전한 정수 범위)
  const MET_KEY = 'brickdex-met-';
  const FRIEND_KEY = 'brickdex-friend-';

  function chunks() {
    return Math.ceil(L.Creatures.count / BITS) || 1;
  }

  function loadMask(prefix) {
    const out = [];
    for (let i = 0; i < chunks(); i++) out.push(L.Storage.getNumber(prefix + i));
    return out;
  }

  function hasBit(mask, index) {
    const c = Math.floor(index / BITS);
    return !!(mask[c] & (1 << (index % BITS)));
  }

  function setBit(mask, index) {
    const c = Math.floor(index / BITS);
    if (mask[c] & (1 << (index % BITS))) return false;
    mask[c] |= (1 << (index % BITS));
    return true;
  }

  function Dex() {
    this.met = loadMask(MET_KEY);
    this.friend = loadMask(FRIEND_KEY);
    this.visible = false;
    this.onClose = null;      // game.js 가 HUD 를 되돌리려고 붙인다
    this.dom = null;
    this.cells = [];
    this._build();
    this.refresh();
  }

  Dex.prototype._save = function (prefix, mask, index) {
    L.Storage.setNumber(prefix + Math.floor(index / BITS), mask[Math.floor(index / BITS)]);
  };

  /** 종 번호(1부터)로 묻는다 */
  Dex.prototype.isMet = function (dex) { return hasBit(this.met, dex - 1); };
  Dex.prototype.isFriend = function (dex) { return hasBit(this.friend, dex - 1); };

  Dex.prototype.metCount = function () {
    let n = 0;
    for (let i = 0; i < L.Creatures.count; i++) if (hasBit(this.met, i)) n++;
    return n;
  };

  Dex.prototype.friendCount = function () {
    let n = 0;
    for (let i = 0; i < L.Creatures.count; i++) if (hasBit(this.friend, i)) n++;
    return n;
  };

  /** 처음 만났으면 true */
  Dex.prototype.markMet = function (species) {
    const fresh = setBit(this.met, species.dex - 1);
    if (fresh) {
      this._save(MET_KEY, this.met, species.dex - 1);
      this.refresh();
    }
    return fresh;
  };

  /** 처음 친구가 됐으면 true */
  Dex.prototype.markFriend = function (species) {
    this.markMet(species);
    const fresh = setBit(this.friend, species.dex - 1);
    if (fresh) {
      this._save(FRIEND_KEY, this.friend, species.dex - 1);
      this.refresh();
    }
    return fresh;
  };

  /** 테스트·초기화용 — 기록을 모두 지운다 */
  Dex.prototype.clear = function () {
    for (let i = 0; i < chunks(); i++) {
      this.met[i] = 0;
      this.friend[i] = 0;
      L.Storage.setNumber(MET_KEY + i, 0);
      L.Storage.setNumber(FRIEND_KEY + i, 0);
    }
    this.refresh();
  };

  // ------------------------------------------------------------------ 화면
  Dex.prototype._build = function () {
    const screen = document.getElementById('dex-screen');
    if (!screen) return;
    const grid = screen.querySelector('.dex-grid');
    const count = screen.querySelector('.dex-count');
    if (!grid) return;
    grid.textContent = '';
    const list = L.Creatures.SPECIES;
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      const cell = document.createElement('div');
      cell.className = 'dex-cell';
      const no = document.createElement('div');
      no.className = 'dex-no';
      no.textContent = '#' + String(sp.dex).padStart(2, '0');
      const icon = document.createElement('div');
      icon.className = 'dex-icon';
      icon.textContent = sp.icon;
      const name = document.createElement('div');
      name.className = 'dex-name';
      const type = document.createElement('div');
      type.className = 'dex-type';
      const note = document.createElement('div');
      note.className = 'dex-note';
      cell.append(no, icon, name, type, note);
      grid.appendChild(cell);
      this.cells.push({ root: cell, name, type, note, sp });
    }
    const close = screen.querySelector('#dex-close-btn');
    if (close) {
      const self = this;
      close.addEventListener('click', function () {
        self.show(false);
        if (self.onClose) self.onClose();
      });
    }
    this.dom = { screen, grid, count };
  };

  /** 칸 상태를 기록에 맞춘다 */
  Dex.prototype.refresh = function () {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const met = this.isMet(c.sp.dex);
      const friend = this.isFriend(c.sp.dex);
      c.root.classList.toggle('met', met);
      c.root.classList.toggle('friend', friend);
      c.name.textContent = met ? c.sp.name : '? ? ?';
      c.type.textContent = met ? (c.sp.typeName + ' · ' + c.sp.rarity) : '아직 못 만났다';
      c.note.textContent = friend ? ('💛 친구 · ' + c.sp.treat) : (met ? c.sp.flavor : '');
    }
    if (this.dom && this.dom.count) {
      this.dom.count.textContent =
        '만난 생물 ' + this.metCount() + ' / ' + L.Creatures.count +
        '   ·   친구 ' + this.friendCount();
    }
  };

  Dex.prototype.show = function (on) {
    this.visible = !!on;
    if (this.dom && this.dom.screen) this.dom.screen.classList.toggle('hidden', !this.visible);
    if (this.visible) this.refresh();
  };

  Dex.prototype.toggle = function () {
    this.show(!this.visible);
    return this.visible;
  };

  L.Dex = Dex;
})(window.LEGO);
