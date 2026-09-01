/* =========================================================================
 * boot.js — 부팅: game 생성 → 설정 연결 → 실패 시 아이가 읽을 수 있는 안내
 *
 * 기술 예외 문자열은 console 로만 보내고 화면에는 행동 가능한 한 문장을 쓴다
 * (UX·아동안전 규격 §9). 마지막에 로드되는 파일이다.
 * ========================================================================= */
(function (L) {
  'use strict';

  function showFailure(err) {
    console.error(err);
    const screen = document.getElementById('start-screen');
    if (!screen) return;
    screen.textContent = '';
    const sheet = document.createElement('div');
    sheet.className = 'sheet small';
    const title = document.createElement('h2');
    title.textContent = '게임을 시작할 수 없었다';
    const detail = document.createElement('p');
    detail.className = 'sub';
    detail.textContent = '창을 닫고 게임을 다시 열어 주세요.';
    sheet.append(title, detail);
    screen.appendChild(sheet);
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      const game = new L.Game();
      window.LEGO_GAME = game;
      window.BRICK_GAME = game;
      // 저장된 설정을 게임과 문서에 적용하고 설정 화면을 잇는다
      L.Settings.attach(game);
      L.SettingsUI.install(game);
    } catch (err) {
      showFailure(err);
    }
  });
})(window.LEGO);
