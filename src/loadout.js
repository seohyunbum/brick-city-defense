/* =========================================================================
 * loadout.js — 장착 정본(single source of truth)
 *
 *  오른손(RIGHT_HAND) = 무기: 폭탄 · 검 · 총      → 키 1 2 3
 *  왼손(LEFT_HAND)   = 스킬 두루마리: 드래곤 파이어 · 메테오 · 파이어볼 → 키 4 5 6
 *
 * hands.js(모델) · hud.js(표시) · game.js(전투)가 모두 이 표만 본다.
 * 숫자를 바꾸면 세 곳이 같이 바뀐다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  /** 오른손 무기 */
  const WEAPONS = [
    {
      id: 'sword', name: '검', emoji: '🗡️', key: '1', hand: 'right',
      damage: 42, cooldown: 0.36, reach: 11, arc: 0.85,
      ammo: null, color: C.silver, hint: '가까운 몬스터를 한 번에 여러 마리 베기',
    },
    {
      id: 'blaster', name: '총', emoji: '🔫', key: '2', hand: 'right',
      damage: 20, cooldown: 0.17, speed: 150, ammoMax: 40, ammoPerPickup: 6,
      color: C.blue, hint: '스터드 탄을 빠르게 연사',
    },
    {
      id: 'bomb', name: '폭탄', emoji: '💣', key: '3', hand: 'right',
      damage: 70, cooldown: 0.95, speed: 52, ammoMax: 10, ammoPerPickup: 1,
      radius: 13, fuse: 1.5, color: C.black, hint: '던지면 터진다. 몰려온 무리에 강함',
    },
  ];

  /** 왼손 두루마리 스킬 */
  const SKILLS = [
    {
      id: 'dragonfire', name: '드래곤 파이어', emoji: '🐲', key: '4', hand: 'left',
      mana: 55, cooldown: 4.6, dps: 130, duration: 2.4, range: 40, cone: 0.42,
      color: 0xff3b00, glow: 0xffb03a, rune: 'dragon',
      hint: '브릭 드래곤 머리가 불을 계속 뿜는다(길게 유지)',
    },
    {
      id: 'meteor', name: '메테오', emoji: '☄️', key: '5', hand: 'left',
      mana: 42, cooldown: 3.4, damage: 150, radius: 20, delay: 1.0, dropHeight: 120,
      color: 0xff5a10, glow: 0xffd166, rune: 'meteor',
      hint: '조준한 곳에 거대한 브릭 운석이 떨어진다',
    },
    {
      id: 'fireball', name: '파이어볼', emoji: '🔥', key: '6', hand: 'left',
      mana: 16, cooldown: 0.62, damage: 60, radius: 7, speed: 78,
      color: 0xff7a18, glow: 0xffe08a, rune: 'fireball',
      hint: '값싸고 빠른 불덩이. 기본 공격 스킬',
    },
  ];

  /** 플레이어 기본 수치 */
  const PLAYER = {
    maxHearts: 5,
    maxMana: 100,
    manaRegen: 7.5,        // 초당
    manaPerStud: 9,
    walkSpeed: 22,
    sprintSpeed: 34,
    eyeHeight: 4.6,
    hurtInvuln: 1.1,       // 피격 후 무적 시간
    pickupRange: 4.2,
  };

  function byId(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  L.WEAPONS = WEAPONS;
  L.SKILLS = SKILLS;
  L.PLAYER = PLAYER;
  L.weaponById = (id) => byId(WEAPONS, id);
  L.skillById = (id) => byId(SKILLS, id);
})(window.LEGO);
