/* =========================================================================
 * settings-ui.js — 설정 화면. settings.js 의 표(GROUPS)만 읽어 DOM 을 만든다.
 *
 * 키보드만으로 완주할 수 있어야 한다: Tab 이동 · Enter/Space 실행 ·
 * 화살표로 값 조절(range) · Escape 로 닫기. 열려 있는 동안 초점은 시트 안에 머문다.
 * 항목을 여기서 하드코딩하지 않는다 — 새 설정은 settings.js 의 표에만 추가한다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const S = L.Settings;
  const FOCUSABLE = 'button, input, select, [tabindex]:not([tabindex="-1"])';

  let root = null;
  let sheet = null;
  let game = null;
  let opened = false;
  let returnTo = 'start';
  let lastFocus = null;
  const controls = [];   // { item, sync }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatRange(item, value) {
    const text = item.step < 1 ? Number(value).toFixed(1) : String(Math.round(value));
    return text + (item.unit || '');
  }

  /** 켜기/끄기 스위치 */
  function toggleControl(item) {
    const btn = make('button', 'set-switch');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    function sync() {
      const on = S.get(item.id);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('on', !!on);
      btn.textContent = on ? '켜짐' : '꺼짐';
    }
    btn.addEventListener('click', () => { S.set(item.id, !S.get(item.id)); syncAll(); });
    sync();
    return { node: btn, sync };
  }

  /** 값 몇 개 중 하나 고르기 */
  function choiceControl(item) {
    const wrap = make('div', 'set-choice');
    wrap.setAttribute('role', 'group');
    const buttons = [];
    for (let i = 0; i < item.choices.length; i++) {
      const choice = item.choices[i];
      const btn = make('button', 'set-chip', choice.label);
      btn.type = 'button';
      btn.addEventListener('click', () => { S.set(item.id, choice.value); syncAll(); });
      wrap.appendChild(btn);
      buttons.push({ btn, value: choice.value });
    }
    function sync() {
      const current = S.get(item.id);
      for (let i = 0; i < buttons.length; i++) {
        const active = buttons[i].value === current;
        buttons[i].btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        buttons[i].btn.classList.toggle('on', active);
      }
    }
    sync();
    return { node: wrap, sync };
  }

  /** 슬라이더 */
  function rangeControl(item) {
    const wrap = make('div', 'set-range');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(item.min);
    input.max = String(item.max);
    input.step = String(item.step);
    const out = make('output', 'set-value');
    function sync() {
      const value = S.get(item.id);
      input.value = String(value);
      out.textContent = formatRange(item, value);
    }
    input.addEventListener('input', () => { S.set(item.id, input.value); syncAll(); });
    wrap.append(input, out);
    sync();
    return { node: wrap, sync, input };
  }

  /** 키 재배정: 누르면 다음 키 입력을 기다린다. 충돌은 저장 전에 알린다. */
  function keyControl(item) {
    const wrap = make('div', 'set-key');
    const btn = make('button', 'set-chip');
    btn.type = 'button';
    const warn = make('span', 'set-warn hidden');
    let listening = false;

    function sync() {
      btn.textContent = listening ? '키를 눌러 주세요…' : S.keyLabel(S.get(item.id));
      btn.classList.toggle('listening', listening);
      btn.setAttribute('aria-label', item.label + ' 키: ' + S.keyLabel(S.get(item.id)));
    }
    function warnText(text) {
      warn.textContent = text;
      warn.classList.remove('hidden');
    }
    function stop() {
      listening = false;
      window.removeEventListener('keydown', onKey, true);
      sync();
    }
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') { stop(); return; }
      if (S.BLOCKED_KEYS.test(e.code)) { warnText('이 키는 바꿀 수 없다'); return; }
      const clash = S.keyConflict(item.id, e.code);
      if (clash) { warnText(S.ITEMS[clash].label + ' 이(가) 이미 쓰는 키다'); return; }
      warn.classList.add('hidden');
      S.set(item.id, e.code);
      stop();
      syncAll();
    }
    btn.addEventListener('click', () => {
      if (listening) { stop(); return; }
      listening = true;
      warn.classList.add('hidden');
      sync();
      window.addEventListener('keydown', onKey, true);
    });
    wrap.append(btn, warn);
    sync();
    return { node: wrap, sync, button: btn };
  }

  function buildItem(item) {
    const row = make('div', 'set-row');
    const label = make('label', 'set-label', item.label);
    const id = 'set-' + item.id;
    label.setAttribute('for', id);
    row.appendChild(label);

    const built = item.type === 'toggle' ? toggleControl(item)
      : item.type === 'choice' ? choiceControl(item)
        : item.type === 'key' ? keyControl(item)
          : rangeControl(item);
    const target = built.input || built.button || built.node;
    target.id = id;
    if (!built.input) {
      // 버튼/버튼 묶음은 label for= 로 이어지지 않으므로 직접 이름을 준다
      target.setAttribute('aria-label', item.label);
    }
    if (item.hint) {
      const hint = make('p', 'set-hint', item.hint);
      hint.id = id + '-hint';
      target.setAttribute('aria-describedby', hint.id);
      row.append(built.node, hint);
    } else {
      row.appendChild(built.node);
    }
    controls.push(built);
    return row;
  }

  function build() {
    if (root) return;
    root = make('div', 'screen hidden');
    root.id = 'settings-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'settings-title');

    sheet = make('div', 'sheet settings-sheet');
    const title = make('h2', null, '⚙️ 설정');
    title.id = 'settings-title';
    const sub = make('p', 'sub', '바꾸면 바로 적용되고 다음에도 그대로 열린다.');
    sheet.append(title, sub);

    const body = make('div', 'settings-body');
    for (let g = 0; g < S.GROUPS.length; g++) {
      const group = S.GROUPS[g];
      const box = make('fieldset', 'set-group');
      box.appendChild(make('legend', null, (group.emoji ? group.emoji + ' ' : '') + group.title));
      if (group.hint) box.appendChild(make('p', 'set-group-hint', group.hint));
      for (let i = 0; i < group.items.length; i++) box.appendChild(buildItem(group.items[i]));
      body.appendChild(box);
    }
    sheet.appendChild(body);

    const actions = make('div', 'settings-actions');
    const resetBtn = make('button', 'ghost', '기본값으로');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => { S.reset(); syncAll(); });
    const closeBtn = make('button', null, '닫기');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => closeScreen());
    actions.append(resetBtn, closeBtn);
    sheet.appendChild(actions);

    root.appendChild(sheet);
    root.addEventListener('keydown', onKeyDown);
    const app = document.getElementById('app') || document.body;
    app.appendChild(root);
  }

  function syncAll() {
    for (let i = 0; i < controls.length; i++) controls[i].sync();
    refreshKeyHints();
  }

  /** 시작 화면의 조작 안내를 실제 배정된 키로 맞춘다 */
  function refreshKeyHints() {
    const text = {
      move: () => [S.get('moveF'), S.get('moveL'), S.get('moveB'), S.get('moveR')].map(S.keyLabel).join(' '),
      sprint: () => S.keyLabel(S.get('sprint')),
      swap: () => S.keyLabel(S.get('nextWeapon')) + ' / ' + S.keyLabel(S.get('nextSkill')),
      cast: () => S.keyLabel(S.get('cast')),
    };
    const nodes = document.querySelectorAll('[data-keyhint]');
    for (let i = 0; i < nodes.length; i++) {
      const fn = text[nodes[i].getAttribute('data-keyhint')];
      if (fn) nodes[i].textContent = fn();
    }
  }

  /** 초점을 시트 안에 가둔다(Tab 이 게임 뒤편으로 빠져나가지 않게) */
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      closeScreen();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = sheet.querySelectorAll(FOCUSABLE);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    } else if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    }
  }

  function openScreen() {
    build();
    if (opened) return;
    opened = true;
    returnTo = game && game.state === 'pause' ? 'pause' : 'start';
    lastFocus = document.activeElement;
    if (game && game.hud) game.hud.screen(null);
    syncAll();
    root.classList.remove('hidden');
    document.body.classList.add('screen-open');
    const first = sheet.querySelector(FOCUSABLE);
    if (first) first.focus();
  }

  function closeScreen() {
    if (!opened) return;
    opened = false;
    root.classList.add('hidden');
    if (game && game.hud) game.hud.screen(returnTo);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /** game 을 연결하고 시작·일시정지 화면의 설정 버튼을 잇는다 */
  function install(instance) {
    game = instance;
    build();
    refreshKeyHints();
    const ids = ['settings-btn', 'pause-settings-btn'];
    for (let i = 0; i < ids.length; i++) {
      const btn = document.getElementById(ids[i]);
      if (btn) btn.addEventListener('click', () => openScreen());
    }
  }

  L.SettingsUI = {
    install,
    open: openScreen,
    close: closeScreen,
    isOpen: () => opened,
    element: () => root,
  };
})(window.LEGO);
