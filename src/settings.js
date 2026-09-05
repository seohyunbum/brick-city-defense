/* =========================================================================
 * settings.js — 설정 정본: 스키마 · 기본값 · 검증 · 저장 · 런타임 적용
 *
 * 이 표(GROUPS)가 저장 형식과 설정 화면을 동시에 만든다. 화면을 그리는 쪽
 * (settings-ui.js)은 표만 읽고 항목을 하드코딩하지 않는다.
 * 저장이 막히거나 값이 손상돼도 기본값으로 복구하고 게임은 계속 돈다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const KEY = 'brickcity-settings-v1';

  /** 설정 항목 정본. type = choice | range | toggle */
  const GROUPS = [
    {
      id: 'screen', title: '화면', emoji: '🖥️',
      items: [
        {
          id: 'quality', type: 'choice', label: '그림 품질', def: 'auto',
          choices: [
            { value: 'auto', label: '자동' },
            { value: 'high', label: '높음' },
            { value: 'low', label: '낮음' },
          ],
          hint: '자동은 느려지면 스스로 낮춘다. 낮음은 심도 흐림을 끈다.',
        },
        {
          id: 'uiScale', type: 'choice', label: '글자·버튼 크기', def: 100,
          choices: [
            { value: 80, label: '80%' },
            { value: 100, label: '100%' },
            { value: 125, label: '125%' },
            { value: 150, label: '150%' },
          ],
          hint: '화면이 작으면 크게 키워 쓴다.',
        },
      ],
    },
    {
      id: 'camera', title: '카메라', emoji: '🎥',
      items: [
        {
          id: 'sensitivity', type: 'range', label: '마우스 감도', def: 1,
          min: 0.5, max: 2, step: 0.1, unit: '배',
          hint: '작게 하면 천천히 돌아본다.',
        },
        {
          id: 'fov', type: 'range', label: '시야각', def: 70,
          min: 60, max: 100, step: 1, unit: '°',
          hint: '넓으면 더 많이 보이고, 좁으면 멀리 잘 보인다.',
        },
        { id: 'invertY', type: 'toggle', label: '위아래 반대로 보기', def: false },
      ],
    },
    {
      id: 'motion', title: '흔들림 줄이기', emoji: '🌊',
      items: [
        {
          id: 'reducedMotion', type: 'toggle', label: '어지러움 줄이기', def: false,
          hint: '켜면 걸을 때 흔들림과 화면 반짝임을 거의 없앤다.',
        },
        { id: 'headBob', type: 'toggle', label: '걸을 때 화면 흔들림', def: true },
        { id: 'hurtFlash', type: 'toggle', label: '맞았을 때 화면 반짝임', def: true },
        {
          id: 'dof', type: 'toggle', label: '멀리 흐리게(심도)', def: true,
          hint: '끄면 화면 전체가 또렷해진다.',
        },
      ],
    },
    {
      id: 'audio', title: '소리', emoji: '🔊',
      items: [
        { id: 'mute', type: 'toggle', label: '소리 끄기', def: false },
        { id: 'master', type: 'range', label: '전체 소리', def: 32, min: 0, max: 100, step: 5, unit: '%' },
        { id: 'sfxVolume', type: 'range', label: '효과음', def: 100, min: 0, max: 100, step: 5, unit: '%' },
      ],
    },
    {
      id: 'access', title: '보기 도움', emoji: '👀',
      items: [
        {
          id: 'highContrast', type: 'toggle', label: '진한 대비', def: false,
          hint: '글자와 칸 테두리를 더 진하게 만든다.',
        },
        { id: 'boldCrosshair', type: 'toggle', label: '조준점 굵게', def: false },
      ],
    },
    {
      id: 'play', title: '게임', emoji: '🎮',
      items: [
        {
          id: 'tutorial', type: 'toggle', label: '처음 안내 보기', def: true,
          hint: '켜면 다음 판을 시작할 때 조작 안내를 처음부터 다시 보여 준다.',
        },
        {
          id: 'difficulty', type: 'choice', label: '난이도', def: 'normal',
          choices: [
            { value: 'easy', label: '쉬움' },
            { value: 'normal', label: '기본' },
          ],
          hint: L.DIFFICULTY.easy.hint + ' (쉬움)',
        },
      ],
    },
  ];

  // 빠른 조회 색인
  const ITEMS = Object.create(null);
  for (let g = 0; g < GROUPS.length; g++) {
    const items = GROUPS[g].items;
    for (let i = 0; i < items.length; i++) ITEMS[items[i].id] = items[i];
  }

  const listeners = [];
  let game = null;
  let values = Object.create(null);

  /** 저장값 하나를 스키마에 맞게 고친다. 이상한 값은 기본값으로 돌린다. */
  function coerce(item, raw) {
    if (item.type === 'toggle') {
      if (raw === true || raw === false) return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return item.def;
    }
    if (item.type === 'choice') {
      for (let i = 0; i < item.choices.length; i++) {
        if (item.choices[i].value === raw) return raw;
      }
      return item.def;
    }
    // range
    const n = Number(raw);
    if (!Number.isFinite(n)) return item.def;
    const clamped = Math.max(item.min, Math.min(item.max, n));
    const steps = Math.round((clamped - item.min) / item.step);
    return Math.round((item.min + steps * item.step) * 100) / 100;
  }

  /** 저장값이 없을 때는 OS 의 '동작 줄이기' 설정을 존중한다 */
  function osReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (err) {
      return false;
    }
  }

  function defaults() {
    const out = Object.create(null);
    for (const id in ITEMS) out[id] = ITEMS[id].def;
    out.reducedMotion = osReducedMotion();
    return out;
  }

  function load() {
    const stored = L.Storage.getJSON(KEY);
    values = defaults();
    if (stored) {
      for (const id in ITEMS) {
        if (Object.prototype.hasOwnProperty.call(stored, id)) values[id] = coerce(ITEMS[id], stored[id]);
      }
    }
    return values;
  }

  function save() {
    const plain = {};
    for (const id in values) plain[id] = values[id];
    return L.Storage.setJSON(KEY, plain);
  }

  function get(id) {
    return values[id];
  }

  function set(id, raw) {
    const item = ITEMS[id];
    if (!item) return undefined;
    const next = coerce(item, raw);
    if (values[id] === next) return next;
    values[id] = next;
    save();
    applyAll();
    for (let i = 0; i < listeners.length; i++) listeners[i](id, next);
    return next;
  }

  function reset() {
    values = defaults();
    save();
    applyAll();
    for (let i = 0; i < listeners.length; i++) listeners[i](null, null);
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function snapshot() {
    const out = {};
    for (const id in values) out[id] = values[id];
    return out;
  }

  // ------------------------------------------------------------ 파생 값
  /** 마우스 감도 배수 */
  function sensitivity() { return values.sensitivity; }
  /** 위아래 반전 부호 */
  function pitchSign() { return values.invertY ? -1 : 1; }
  /** 걸을 때 흔들림 배수. 어지러움 줄이기는 기본의 15%만 남긴다. */
  function bobScale() {
    if (values.reducedMotion) return 0.15;
    return values.headBob ? 1 : 0;
  }
  /** 피격 화면 반짝임을 쓸지 */
  function flashOn() { return values.hurtFlash && !values.reducedMotion; }
  /** 심도 흐림을 쓸지 (어지러움 줄이기가 켜지면 함께 끈다) */
  function dofOn() { return values.dof && !values.reducedMotion; }
  /** 현재 난이도 표 */
  function difficulty() { return L.DIFFICULTY[values.difficulty] || L.DIFFICULTY.normal; }
  /** 화면 비율을 고려한 카메라 FOV (폰 세로에서는 조금 넓힌다) */
  function fovFor(aspect) {
    const base = values.fov;
    return aspect < 1 ? Math.min(100, base + 12) : base;
  }

  // ------------------------------------------------------------ 적용
  /** 문서(글자 크기·대비·모션·조준점)에 적용 */
  function applyDocument() {
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--ui-scale', (values.uiScale / 100).toFixed(2));
    root.dataset.contrast = values.highContrast ? 'high' : 'normal';
    root.dataset.motion = values.reducedMotion ? 'reduced' : 'full';
    root.dataset.crosshair = values.boldCrosshair ? 'bold' : 'normal';
  }

  /** 게임 런타임(후처리·소리·품질·FOV)에 적용 */
  function applyGame() {
    if (!game) return;
    if (game.post && game.post.setDof) game.post.setDof(dofOn());
    if (game.sfx && game.sfx.setMix) {
      game.sfx.setMix(values.master / 100, values.sfxVolume / 100, values.mute);
    }
    applyQuality();
    if (game.resize) game.resize();
  }

  /** 품질 모드. 자동은 game 의 프레임 감시에 맡기고, 수동은 후처리만 바꾼다. */
  function applyQuality() {
    const post = game.post;
    game.autoQuality = values.quality === 'auto';
    if (values.quality === 'low') {
      if (post && post.setEnabled) post.setEnabled(false);
      return;
    }
    if (post && post.setEnabled) post.setEnabled(true);
    if (post && post.setScale) post.setScale(1);
    // 자동으로 돌아오면 감시 상태도 처음부터 다시 센다
    game._qualityStep = 0;
    game._slowWindows = 0;
  }

  function applyAll() {
    applyDocument();
    applyGame();
  }

  /** game 인스턴스를 연결하고 저장된 설정을 즉시 적용한다 */
  function attach(instance) {
    game = instance;
    applyAll();
  }

  load();

  L.Settings = {
    KEY,
    GROUPS,
    ITEMS,
    get,
    set,
    reset,
    load,
    save,
    subscribe,
    snapshot,
    attach,
    applyDocument,
    applyAll,
    sensitivity,
    pitchSign,
    bobScale,
    flashOn,
    dofOn,
    difficulty,
    fovFor,
  };
})(window.LEGO);
