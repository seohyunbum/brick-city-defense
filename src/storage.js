/* 점수 저장 adapter. 브라우저가 localStorage를 차단해도 게임 부팅은 계속된다. */
(function (L) {
  'use strict';

  const memory = Object.create(null);

  function read(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? memory[key] : value;
    } catch (err) {
      return memory[key];
    }
  }

  function write(key, value) {
    const text = String(value);
    memory[key] = text;
    try {
      window.localStorage.setItem(key, text);
      return true;
    } catch (err) {
      return false;
    }
  }

  function getNumber(key, legacyKey) {
    let value = read(key);
    if ((value === undefined || value === null) && legacyKey) {
      value = read(legacyKey);
      const migrated = Number(value);
      if (Number.isFinite(migrated) && migrated >= 0) write(key, Math.floor(migrated));
    }
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  function setNumber(key, value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return false;
    return write(key, Math.floor(number));
  }

  function getString(key, fallback) {
    const value = read(key);
    return typeof value === 'string' ? value : (fallback === undefined ? null : fallback);
  }

  function setString(key, value) {
    return write(key, value);
  }

  /** 저장된 JSON 을 읽는다. 없거나 손상됐으면 null 을 준다(호출자가 default 로 복구). */
  function getJSON(key) {
    const text = getString(key);
    if (text === null) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function setJSON(key, value) {
    let text;
    try {
      text = JSON.stringify(value);
    } catch (err) {
      return false;
    }
    return write(key, text);
  }

  L.Storage = {
    getNumber,
    setNumber,
    getString,
    setString,
    getJSON,
    setJSON,
    _memory: memory,
  };
})(window.LEGO);
