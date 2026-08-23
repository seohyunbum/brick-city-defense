/* =========================================================================
 * creatures.js — 브릭 도감 생물 정본(single source of truth)
 *
 * 무엇인가: 도시에 사는 "브릭 생물" 36종. 잡는 게 아니라 만나고 친구가 되는 대상이다.
 *   · 공격 대상이 아니다. 무기·두루마리로 다치지 않는다(아동안전 5장).
 *   · 12 가족 × 3 단계. 같은 가족은 색·속성을 공유하고 단계가 오르면 커진다.
 *   · 이름·모양은 이 저장소에서 만든 독립 창작물이다. 특정 완구사·게임의
 *     캐릭터·세트명·리핑 자산을 쓰지 않는다(CLAUDE.md 4·6장).
 *
 * 이 표만 정본이다. creature-mesh.js(모양) · companions.js(행동) · dex.js(도감 UI)
 * 는 전부 여기 숫자를 읽는다. 색은 bricks.js COLORS 팔레트만 쓴다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  /** 속성 12종 — 이름·아이콘·팔레트 3색(몸/무늬/장식) */
  const TYPES = {
    fire: { name: '불', icon: '🔥', body: C.red, accent: C.orange, trim: C.yellow },
    water: { name: '물', icon: '💧', body: C.azure, accent: C.blue, trim: C.glass },
    grass: { name: '풀', icon: '🌿', body: C.green, accent: C.brightGreen, trim: C.lime },
    bolt: { name: '번개', icon: '⚡', body: C.yellow, accent: C.gold, trim: C.white },
    rock: { name: '돌', icon: '🪨', body: C.darkGray, accent: C.lightGray, trim: C.brown },
    wind: { name: '바람', icon: '🍃', body: C.white, accent: C.lime, trim: C.lightGray },
    ice: { name: '얼음', icon: '❄️', body: C.glass, accent: C.azure, trim: C.white },
    light: { name: '빛', icon: '✨', body: C.gold, accent: C.yellow, trim: C.white },
    metal: { name: '철', icon: '🔧', body: C.silver, accent: C.lightGray, trim: C.darkGray },
    sand: { name: '모래', icon: '🏜️', body: C.tan, accent: C.darkTan, trim: C.hay },
    sky: { name: '하늘', icon: '☁️', body: C.sandBlue, accent: C.glass, trim: C.white },
    night: { name: '밤', icon: '🌙', body: C.purple, accent: C.magenta, trim: C.darkBlue },
  };

  /**
   * 가족 12개. 한 줄이 3종(1·2·3단계)을 만든다.
   *   names  : 단계별 이름
   *   plans  : 단계별 몸 구성(creature-mesh.js 가 아는 이름)
   *   crest  : 머리 장식 — 실루엣을 서로 다르게 만드는 값
   *   tail   : 꼬리 모양
   *   habitat: 이 가족이 사는 구역(districts.js typeAt 값)
   *   treat  : 좋아하는 간식 — 친구가 될 때 HUD 에 뜬다
   *   flavor : 도감 한 줄 설명(단계별)
   */
  const FAMILIES = [
    {
      key: 'spark', type: 'fire', crest: 'horn', tail: 'flame',
      names: ['톡불이', '불똥이', '화르릉'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['downtown', 'garage', 'construction', 'market'],
      treat: '🍞 바삭 브릭',
      flavor: [
        '따뜻한 브릭 위에서 톡톡 튄다. 손을 대도 미지근하다.',
        '꼬리에 작은 불씨를 달고 다니며 밤길을 비춰 준다.',
        '숨을 쉬면 등의 브릭이 주황색으로 달아오른다.',
      ],
    },
    {
      key: 'drop', type: 'water', crest: 'fin', tail: 'long',
      names: ['방울이', '물참방', '파도둥이'],
      plans: ['blob', 'quad', 'serpent'],
      habitat: ['harbor', 'beach', 'park', 'plaza'],
      treat: '🧊 얼음 조각',
      flavor: [
        '물웅덩이에 앉아 있으면 거의 안 보인다. 밟히기 전에 폴짝 뛴다.',
        '등지느러미로 물을 튀겨 인사한다. 옷이 좀 젖는다.',
        '항구 방파제를 따라 길게 헤엄친다. 파도 소리를 흉내 낸다.',
      ],
    },
    {
      key: 'sprout', type: 'grass', crest: 'leaf', tail: 'stub',
      names: ['새싹콩', '잎사귀', '숲지기'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['park', 'farm', 'school', 'house'],
      treat: '🥕 브릭 당근',
      flavor: [
        '화단에 앉아 햇볕을 쬔다. 물을 주면 잎이 한 칸 자란다.',
        '네 발로 밭을 돌며 벌레 모양 브릭을 골라낸다.',
        '오래된 나무 옆에 서서 공원을 지킨다. 어깨에 이끼가 자란다.',
      ],
    },
    {
      key: 'zap', type: 'bolt', crest: 'antenna', tail: 'fork',
      names: ['찌릿콩', '번쩍이', '우르릉'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['downtown', 'garage', 'construction', 'apartment'],
      treat: '🔋 브릭 건전지',
      flavor: [
        '가로등 아래에서 정전기를 모은다. 만지면 머리카락이 선다.',
        '달릴 때 발끝에서 노란 불꽃이 튄다. 아주 빠르다.',
        '가슴의 브릭이 번쩍이면 근처 전구가 같이 깜빡인다.',
      ],
    },
    {
      key: 'pebble', type: 'rock', crest: 'spike', tail: 'none',
      names: ['돌멩', '바위덩', '산더미'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['construction', 'garage', 'beach', 'house'],
      treat: '🧱 낡은 브릭 한 줌',
      flavor: [
        '가만히 있으면 진짜 돌처럼 보인다. 인도 턱에 자주 앉아 있다.',
        '느리지만 절대 넘어지지 않는다. 등에 올라타면 태워 준다.',
        '어깨로 무너진 벽을 받쳐 준다. 공사장 아저씨들의 친구.',
      ],
    },
    {
      key: 'breeze', type: 'wind', crest: 'ring', tail: 'fan',
      names: ['살랑이', '휘리릭', '회오리'],
      plans: ['orb', 'wing', 'wing'],
      habitat: ['plaza', 'park', 'playground', 'beach'],
      treat: '🎐 종이 바람개비',
      flavor: [
        '공중에 붕 떠서 천천히 돈다. 머리 위 고리가 풍향계다.',
        '광장 위를 낮게 날며 낙엽을 모아 놓는다.',
        '빙글빙글 돌며 날아간다. 모자를 조심하는 게 좋다.',
      ],
    },
    {
      key: 'frost', type: 'ice', crest: 'spike', tail: 'stub',
      names: ['살얼음', '고드름', '눈보라'],
      plans: ['blob', 'serpent', 'biped'],
      habitat: ['harbor', 'beach', 'apartment', 'downtown'],
      treat: '🍧 브릭 팥빙수',
      flavor: [
        '이른 아침 창틀에 붙어 반짝인다. 해가 나면 그늘로 숨는다.',
        '몸이 투명한 브릭으로 되어 있어 뒤가 비친다.',
        '지나간 자리에 하얀 브릭 가루가 조금 남는다.',
      ],
    },
    {
      key: 'glim', type: 'light', crest: 'ring', tail: 'none',
      names: ['반짝콩', '별빛이', '햇살등'],
      plans: ['orb', 'orb', 'wing'],
      habitat: ['plaza', 'school', 'downtown', 'police'],
      treat: '🍯 반짝 꿀단지',
      flavor: [
        '어두운 골목에서 혼자 빛난다. 길 잃은 아이를 따라온다.',
        '밤이 되면 도시 위로 올라가 별처럼 떠 있다.',
        '날개를 펴면 가로등 세 개 몫으로 밝다.',
      ],
    },
    {
      key: 'bolt2', type: 'metal', crest: 'horn', tail: 'stub',
      names: ['나사돌이', '톱니바퀴', '강철브릭'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['garage', 'construction', 'harbor', 'fire'],
      treat: '⚙️ 기름 한 방울',
      flavor: [
        '정비소 바닥을 굴러다닌다. 떨어진 나사를 주워 모은다.',
        '몸에 달린 톱니가 맞물려 돌아간다. 소리가 규칙적이다.',
        '팔이 스패너로 되어 있어 고장 난 차를 같이 고쳐 준다.',
      ],
    },
    {
      key: 'dune', type: 'sand', crest: 'ear', tail: 'long',
      names: ['모래알', '사구다리', '모래탑'],
      plans: ['blob', 'quad', 'biped'],
      habitat: ['beach', 'farm', 'park', 'house'],
      treat: '🥔 브릭 감자',
      flavor: [
        '모래 속에 반쯤 묻혀서 잔다. 발끝만 보인다.',
        '긴 다리로 뜨거운 모래를 성큼성큼 건넌다.',
        '스스로 몸을 쌓아 올렸다가 다시 무너뜨리며 논다.',
      ],
    },
    {
      key: 'cloud', type: 'sky', crest: 'none', tail: 'fan',
      names: ['구름솜', '뭉게뭉게', '비구름'],
      plans: ['orb', 'wing', 'wing'],
      habitat: ['apartment', 'downtown', 'harbor', 'playground'],
      treat: '🍚 하얀 브릭 떡',
      flavor: [
        '손바닥에 올라올 만큼 작은 구름이다. 아주 가볍다.',
        '지붕 높이에서 둥둥 떠다니며 그늘을 만들어 준다.',
        '기분이 좋으면 아주 작은 비를 뿌린다. 무지개가 남는다.',
      ],
    },
    {
      key: 'dusk', type: 'night', crest: 'ear', tail: 'long',
      names: ['그림솜', '밤나래', '달그늘'],
      plans: ['blob', 'wing', 'serpent'],
      habitat: ['apartment', 'house', 'park', 'school'],
      treat: '🫐 밤빛 열매',
      flavor: [
        '그림자 속에 앉아 있다. 눈만 노랗게 보인다.',
        '해가 지면 조용히 날아올라 도시를 한 바퀴 돈다.',
        '달빛을 등에 얹고 길게 흐른다. 보면 잠이 잘 온다.',
      ],
    },
  ];

  // 단계별 공통 수치 — 단계가 오르면 커지고, 덜 겁내고, 간식이 더 든다
  const STAGE = [
    { size: 0.62, speed: 7.6, shy: 0.62, cost: 10, minLevel: 1, rarity: '흔함' },
    { size: 0.95, speed: 9.4, shy: 0.42, cost: 20, minLevel: 1, rarity: '보통' },
    { size: 1.34, speed: 8.0, shy: 0.24, cost: 35, minLevel: 2, rarity: '귀함' },
  ];

  // ------------------------------------------------------------------ 표 펼치기
  const SPECIES = [];
  const BY_ID = Object.create(null);
  for (let f = 0; f < FAMILIES.length; f++) {
    const fam = FAMILIES[f];
    const t = TYPES[fam.type];
    for (let s = 0; s < 3; s++) {
      const st = STAGE[s];
      const species = {
        id: fam.key + (s + 1),
        dex: SPECIES.length + 1,
        name: fam.names[s],
        family: fam.key,
        familyNames: fam.names,
        stage: s + 1,
        type: fam.type,
        typeName: t.name,
        icon: t.icon,
        plan: fam.plans[s],
        crest: fam.crest,
        tail: fam.tail,
        body: t.body,
        accent: t.accent,
        trim: t.trim,
        size: st.size,
        speed: st.speed,
        shy: st.shy,
        cost: st.cost,
        minLevel: st.minLevel,
        rarity: st.rarity,
        habitat: fam.habitat,
        treat: fam.treat,
        flavor: fam.flavor[s],
      };
      SPECIES.push(species);
      BY_ID[species.id] = species;
    }
  }

  /** 이 구역에 사는 종을 고른다. 없으면 아무 1단계나(도시 어디서든 한 마리는 만난다) */
  function pick(rand, districtType, level) {
    const roll = rand === undefined ? Math.random() : rand;
    const lv = level || 1;
    const home = [];
    const rest = [];
    for (let i = 0; i < SPECIES.length; i++) {
      const sp = SPECIES[i];
      if (sp.minLevel > lv) continue;
      if (sp.habitat.indexOf(districtType) >= 0) home.push(sp);
      else if (sp.stage === 1) rest.push(sp);
    }
    // 사는 구역이면 그 가족이 78%, 아니면 지나가던 1단계
    const table = (home.length && (roll < 0.78 || !rest.length)) ? home : (rest.length ? rest : SPECIES);
    return table[Math.floor(Math.random() * table.length)];
  }

  L.Creatures = {
    TYPES,
    SPECIES,
    count: SPECIES.length,
    byId: function (id) { return BY_ID[id] || null; },
    byDex: function (dex) { return SPECIES[dex - 1] || null; },
    pick,
  };
})(window.LEGO);
