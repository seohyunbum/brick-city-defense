/* =========================================================================
 * tutorial.js — 첫 60초 안내 (UX·접근성 규격 §2)
 *
 * 규칙:
 *   · 읽어야만 넘어가는 wall of text 금지 — 한 줄과 행동 하나씩
 *   · 이미 해낸 조작은 다시 요구하지 않는다(둘러보기·걷기 진행도는 누적)
 *   · 15초 동안 진전이 없으면 키를 짚어 주는 힌트를 덧붙인다
 *   · 첫 안내에서는 검과 총만 가르친다(폭탄·두루마리 3종·보스는 나중에)
 *   · 언제든 Enter 또는 건너뛰기 버튼으로 빠져나갈 수 있다
 * 안내를 마치거나 건너뛰면 설정의 '처음 안내 보기'가 꺼져 다시 묻지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const HINT_AFTER = 15;   // 초 — 정체 판정. 규격의 "15초"는 실제 시계 시간이므로
                           // 프레임 시간(dt)이 아니라 벽시계로 잰다(느린 기기에서도 같다).

  function now() {
    return (window.performance && performance.now ? performance.now() : Date.now()) * 0.001;
  }

  // 진행도(핫패스에서 객체를 만들지 않으려고 모듈 변수를 클로저로 읽는다)
  let lookAmount = 0;
  let moved = 0;
  let elapsed = 0;         // 현재 단계에 머문 실제 시간(초)
  let stepStart = 0;
  let killMark = 0;

  let game = null;
  let active = false;
  let index = -1;
  let hintShown = false;
  let prevYaw = 0, prevPitch = 0, prevX = 0, prevZ = 0;

  let card = null, stepEl = null, textEl = null, hintEl = null;

  function kills() {
    return game ? game.player.kills - killMark : 0;
  }

  /** 플레이어 앞쪽(오른쪽 side 만큼 옆)에 슬라임 한 마리를 세운다 */
  function spawnAhead(distance, side) {
    const e = game.enemies.spawn('slime');
    if (!e) return null;
    const p = game.player.pos;
    const sin = Math.sin(game.player.yaw), cos = Math.cos(game.player.yaw);
    // player.js 와 같은 규약: 앞 = (-sin, -cos), 오른쪽 = (cos, -sin)
    const b = game.city.bounds;
    const x = p.x - sin * distance + cos * side;
    const z = p.z - cos * distance - sin * side;
    e.pos.set(
      Math.max(b.minX, Math.min(b.maxX, x)),
      game.city.curbY,
      Math.max(b.minZ, Math.min(b.maxZ, z))
    );
    e.group.position.copy(e.pos);
    return e;
  }

  /** 안내 단계 정본. progress 가 goal 에 닿으면 다음 단계로 넘어간다. */
  const STEPS = [
    {
      id: 'look',
      text: '🖱️ 마우스를 움직여 도시를 둘러보세요',
      hint: '마우스를 왼쪽·오른쪽으로 천천히 움직이면 고개가 돌아간다',
      goal: 2.4,
      progress: () => lookAmount,
    },
    {
      id: 'move',
      text: '🚶 걸어서 도시를 움직여 보세요',
      hint: () => {
        const S = L.Settings;
        return S.keyLabel(S.get('moveF')) + ' 앞 · ' + S.keyLabel(S.get('moveB')) + ' 뒤 · '
          + S.keyLabel(S.get('moveL')) + ' 왼쪽 · ' + S.keyLabel(S.get('moveR')) + ' 오른쪽. '
          + S.keyLabel(S.get('sprint')) + ' 를 누르면 달린다';
      },
      goal: 14,
      progress: () => moved,
    },
    {
      id: 'sword',
      text: '🗡️ 다가오는 브릭 슬라임을 검으로 베어 보세요',
      hint: '마우스 왼쪽 클릭이 공격이다. 슬라임이 가까이 올 때까지 기다려도 된다',
      goal: 1,
      progress: kills,
      enter: () => {
        game.hands.setWeapon(0);
        spawnAhead(24, -3);   // 다가올 시간을 주고 세운다(슬라임은 초당 13.5)
      },
    },
    {
      id: 'blaster',
      text: '🔫 2 번을 눌러 총을 들고 멀리 있는 슬라임을 맞혀 보세요',
      hint: '2 번 키로 총 · 마우스 왼쪽 클릭으로 연사. 파란 알맹이를 주우면 총알이 찬다',
      goal: 2,
      progress: kills,
      enter: () => {
        spawnAhead(38, -7);
        spawnAhead(42, 8);
      },
    },
    {
      id: 'ready',
      text: '🛡️ 잘했어요! 이제 시민을 지킬 시간이다',
      hint: '',
      goal: 2.6,
      progress: () => elapsed,
    },
  ];

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function build() {
    if (card) return;
    card = make('div', 'hidden');
    card.id = 'tutorial-card';
    stepEl = make('div', 'tut-step');
    textEl = make('div', 'tut-text');
    textEl.setAttribute('aria-live', 'polite');
    hintEl = make('div', 'tut-hint hidden');
    const skip = make('button', 'tut-skip', '건너뛰기 (Enter)');
    skip.type = 'button';
    skip.addEventListener('click', () => finish(false));
    card.append(stepEl, textEl, hintEl, skip);
    const app = document.getElementById('app') || document.body;
    app.appendChild(card);

    window.addEventListener('keydown', (e) => {
      if (!active || e.key !== 'Enter') return;
      if (document.body.classList.contains('screen-open')) return;
      finish(false);
      e.preventDefault();
    });
  }

  function render() {
    const step = STEPS[index];
    if (!step) return;
    stepEl.textContent = (index + 1) + ' / ' + STEPS.length;
    textEl.textContent = step.text;
    hintEl.textContent = typeof step.hint === 'function' ? step.hint() : step.hint;
    hintEl.classList.add('hidden');
    card.classList.remove('hidden');
  }

  function showHint() {
    const step = STEPS[index];
    if (!step || !step.hint) return;
    hintShown = true;
    hintEl.classList.remove('hidden');
  }

  function next() {
    index++;
    elapsed = 0;
    stepStart = now();
    hintShown = false;
    const step = STEPS[index];
    if (!step) {
      finish(true);
      return;
    }
    killMark = game.player.kills;
    if (step.enter) step.enter();
    render();
    game.sfx.pop();
  }

  /** 안내를 끝내고 진짜 웨이브를 연다 */
  function finish(completed) {
    if (!active) return;
    active = false;
    if (card) card.classList.add('hidden');
    game.enemies.clear();
    // 한 번 배운 조작을 다음 판에서 다시 요구하지 않는다
    L.Settings.set('tutorial', false);
    game.openWave();
  }

  /** game.start() 가 부른다. 안내를 맡으면 true(웨이브는 안내가 끝난 뒤 열린다). */
  function begin(instance) {
    game = instance;
    build();
    if (!L.Settings.get('tutorial')) {
      active = false;
      card.classList.add('hidden');
      return false;
    }
    active = true;
    index = -1;
    lookAmount = 0;
    moved = 0;
    elapsed = 0;
    stepStart = now();
    const p = game.player;
    prevYaw = p.yaw; prevPitch = p.pitch;
    prevX = p.pos.x; prevZ = p.pos.z;
    // 안내 중에는 웨이브가 돌지 않는다
    game.enemies.clear();
    next();
    return true;
  }

  /** 게임 루프에서 매 프레임 부른다 */
  function update(instance) {
    if (!active) return;
    game = instance;
    const p = game.player;
    lookAmount += Math.abs(p.yaw - prevYaw) + Math.abs(p.pitch - prevPitch);
    moved += Math.hypot(p.pos.x - prevX, p.pos.z - prevZ);
    prevYaw = p.yaw; prevPitch = p.pitch;
    prevX = p.pos.x; prevZ = p.pos.z;
    elapsed = now() - stepStart;

    const step = STEPS[index];
    if (!step) return;
    if (step.progress() >= step.goal) {
      next();
      return;
    }
    if (!hintShown && elapsed > HINT_AFTER) showHint();
  }

  L.Tutorial = {
    STEPS,
    begin,
    update,
    skip: () => finish(false),
    isActive: () => active,
    step: () => (active && STEPS[index] ? STEPS[index].id : null),
  };
})(window.LEGO);
