/* =========================================================================
 * fx.js — 발사체·폭발·브릭 파편·불꽃·스터드 수집품 (전부 풀링)
 *
 * 규칙(핫패스): update 안에서 new 금지. 미리 만든 풀에서 꺼내 쓰고 되돌린다.
 * 레고답게: 몬스터가 터지면 피가 아니라 "브릭 조각"이 팝 하고 흩어진다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const GRAVITY = 62;

  function FX(scene) {
    this.scene = scene;
    this.hooks = {
      damageArea: null,     // (pos, radius, dmg) => void
      hitPlayer: null,      // (dmg, pos) => void
      onImpact: null,       // (pos, kind) => void
    };
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this.time = 0;

    // ---------------- 발사체 풀
    this.projectiles = [];
    this._makeProjectilePool('stud', 40, () => {
      const g = L.roundStud(C.yellow, 1.1);
      return g;
    });
    this._makeProjectilePool('bomb', 10, () => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(L.sph(0.8, 12), L.mat(0x22303a));
      const spark = new THREE.Mesh(L.sph(0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
      spark.position.y = 1.1;
      g.add(ball, spark);
      g.userData.spark = spark;
      return g;
    });
    this._makeProjectilePool('fireball', 18, () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(L.sph(0.9, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      const shell = new THREE.Mesh(L.sph(1.5, 12), new THREE.MeshBasicMaterial({
        color: 0xff7a18, transparent: true, opacity: 0.62,
      }));
      g.add(core, shell);
      g.userData.shell = shell;
      return g;
    });
    this._makeProjectilePool('meteor', 4, () => {
      const g = new THREE.Group();
      const rock = new THREE.Mesh(L.box(6, 6, 6), L.mat(C.reddishBrown, 'matte'));
      const rock2 = new THREE.Mesh(L.box(4, 4, 4), L.mat(C.brown, 'matte'));
      rock2.position.set(2.2, 1.8, -1.6);
      const rock3 = new THREE.Mesh(L.box(3, 3, 3), L.mat(C.darkTan, 'matte'));
      rock3.position.set(-2.4, -1.4, 1.8);
      const fire = new THREE.Mesh(L.sph(5.4, 14), new THREE.MeshBasicMaterial({
        color: 0xff5a10, transparent: true, opacity: 0.5,
      }));
      const trail = new THREE.Mesh(L.cyl(0.6, 4.2, 16, 10), new THREE.MeshBasicMaterial({
        color: 0xffb03a, transparent: true, opacity: 0.4,
      }));
      trail.position.y = 9;
      g.add(rock, rock2, rock3, fire, trail);
      return g;
    });
    this._makeProjectilePool('enemyfire', 24, () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(L.sph(0.8, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      const shell = new THREE.Mesh(L.sph(1.3, 10), new THREE.MeshBasicMaterial({
        color: 0xc21a09, transparent: true, opacity: 0.6,
      }));
      g.add(core, shell);
      return g;
    });

    // ---------------- 폭발 풀
    this.explosions = [];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(L.sph(1, 14), new THREE.MeshBasicMaterial({
        color: 0xffb03a, transparent: true, opacity: 0.62,
      }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.18, 8, 26), new THREE.MeshBasicMaterial({
        color: 0xff7a18, transparent: true, opacity: 0.9,
      }));
      ring.rotation.x = Math.PI / 2;
      const inner = new THREE.Mesh(L.sph(0.6, 12), new THREE.MeshBasicMaterial({
        color: 0xfff3c4, transparent: true, opacity: 1,
      }));
      g.add(ball, ring, inner);
      g.visible = false;
      scene.add(g);
      this.explosions.push({ alive: false, t: 0, dur: 0.5, radius: 8, group: g, ball, ring, inner });
    }

    // ---------------- 브릭 파편 풀
    this.debris = [];
    const debrisGeos = [L.box(0.9, 0.55, 0.9), L.box(1.3, 0.6, 0.7), L.box(0.7, 0.7, 0.7)];
    for (let i = 0; i < 190; i++) {
      const m = new THREE.Mesh(debrisGeos[i % 3], L.mat(C.lightGray));
      m.visible = false;
      m.castShadow = false;
      scene.add(m);
      this.debris.push({
        alive: false, mesh: m, t: 0, life: 1,
        vel: new THREE.Vector3(), spin: new THREE.Vector3(),
      });
    }

    // ---------------- 불꽃(드래곤 파이어) 풀
    this.flames = [];
    for (let i = 0; i < 54; i++) {
      const m = new THREE.Mesh(L.sph(1, 8), new THREE.MeshBasicMaterial({
        color: 0xff7a18, transparent: true, opacity: 0.8,
      }));
      m.visible = false;
      scene.add(m);
      this.flames.push({ alive: false, mesh: m, t: 0, life: 0.55, vel: new THREE.Vector3(), size: 1 });
    }

    // ---------------- 스터드 수집품 풀
    this.studs = [];
    for (let i = 0; i < 48; i++) {
      const g = L.roundStud(C.yellow, 1.4);
      g.visible = false;
      scene.add(g);
      this.studs.push({
        alive: false, group: g, t: 0, vel: new THREE.Vector3(), grounded: false, kind: 'mana',
      });
    }

    // ---------------- 메테오 예고 표식
    this.marks = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 32), new THREE.MeshBasicMaterial({
        color: 0xff5a10, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      }));
      ring.rotation.x = -Math.PI / 2;
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 24), new THREE.MeshBasicMaterial({
        color: 0xffd166, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      }));
      ring2.rotation.x = -Math.PI / 2;
      g.add(ring, ring2);
      g.visible = false;
      scene.add(g);
      this.marks.push({ alive: false, group: g, t: 0, dur: 1, radius: 10, ring, ring2 });
    }
  }

  FX.prototype._makeProjectilePool = function (kind, count, maker) {
    for (let i = 0; i < count; i++) {
      const g = maker();
      g.visible = false;
      this.scene.add(g);
      this.projectiles.push({
        alive: false, kind, group: g, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        t: 0, life: 3, dmg: 0, radius: 0, gravity: 0, spin: 0, owner: 'player', fuse: 0,
      });
    }
  };

  FX.prototype._freeProjectile = function (kind) {
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.alive && p.kind === kind) return p;
    }
    return null;
  };

  /** 발사체 발사. dir 은 정규화된 방향. */
  FX.prototype.shoot = function (kind, pos, dir, o) {
    const p = this._freeProjectile(kind);
    if (!p) return null;
    o = o || {};
    p.alive = true;
    p.t = 0;
    p.life = o.life === undefined ? 3.2 : o.life;
    p.dmg = o.dmg || 0;
    p.radius = o.radius || 0;
    p.gravity = o.gravity || 0;
    p.owner = o.owner || 'player';
    p.fuse = o.fuse || 0;
    p.spin = o.spin || 0;
    p.pos.copy(pos);
    p.vel.copy(dir).multiplyScalar(o.speed || 100);
    if (o.up) p.vel.y += o.up;
    p.group.position.copy(pos);
    p.group.visible = true;
    p.group.scale.setScalar(o.scale === undefined ? 1 : o.scale);
    return p;
  };

  /** 메테오: 하늘에서 목표점으로 떨어뜨린다 */
  FX.prototype.meteor = function (target, skill) {
    const mark = this._freeSlot(this.marks);
    if (mark) {
      mark.alive = true;
      mark.t = 0;
      mark.dur = skill.delay;
      mark.radius = skill.radius;
      mark.group.position.set(target.x, target.y + 0.35, target.z);
      mark.group.visible = true;
      mark.group.scale.setScalar(skill.radius * 0.5);
    }
    const p = this._freeProjectile('meteor');
    if (!p) return null;
    p.alive = true;
    p.t = 0;
    p.life = skill.delay + 0.4;
    p.dmg = skill.damage;
    p.radius = skill.radius;
    p.gravity = 0;
    p.owner = 'player';
    p.fuse = 0;
    p.spin = 2.4;
    p.pos.set(target.x - 14, target.y + skill.dropHeight, target.z - 22);
    p.vel.set(14 / skill.delay, -skill.dropHeight / skill.delay, 22 / skill.delay);
    p.group.position.copy(p.pos);
    p.group.visible = true;
    return p;
  };

  FX.prototype._freeSlot = function (arr) {
    for (let i = 0; i < arr.length; i++) if (!arr[i].alive) return arr[i];
    return null;
  };

  /** 폭발 이펙트(피해 판정은 hooks.damageArea 가 한다) */
  FX.prototype.explode = function (pos, radius, color, dmg) {
    const e = this._freeSlot(this.explosions);
    if (e) {
      e.alive = true;
      e.t = 0;
      e.dur = 0.42 + radius * 0.012;
      e.radius = radius;
      e.group.position.copy(pos);
      e.group.visible = true;
      e.ball.material.color.setHex(color || 0xffb03a);
      e.ring.material.color.setHex(color || 0xff7a18);
    }
    this.debrisBurst(pos, C.orange, Math.min(18, 6 + Math.round(radius)), radius * 1.6);
    if (dmg && this.hooks.damageArea) this.hooks.damageArea(pos, radius, dmg);
  };

  /** 브릭 파편 팝 */
  FX.prototype.debrisBurst = function (pos, color, count, power) {
    for (let i = 0; i < count; i++) {
      const d = this._freeSlot(this.debris);
      if (!d) return;
      d.alive = true;
      d.t = 0;
      d.life = 0.9 + Math.random() * 0.8;
      d.mesh.material = L.mat(color);
      d.mesh.position.copy(pos);
      d.mesh.visible = true;
      d.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2;
      const up = 0.5 + Math.random() * 0.9;
      const sp = (power || 14) * (0.4 + Math.random() * 0.7);
      d.vel.set(Math.cos(a) * sp, up * sp, Math.sin(a) * sp);
      d.spin.set(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5);
    }
  };

  /** 드래곤 파이어 불꽃 한 뭉치 */
  FX.prototype.flame = function (pos, dir, spread) {
    const f = this._freeSlot(this.flames);
    if (!f) return;
    f.alive = true;
    f.t = 0;
    f.life = 0.34 + Math.random() * 0.3;
    f.size = 0.7 + Math.random() * 1.1;
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    f.mesh.material.color.setHex(Math.random() < 0.4 ? 0xffd166 : 0xff5a10);
    f.mesh.material.opacity = 0.85;
    const s = spread || 0.16;
    f.vel.copy(dir).multiplyScalar(52 + Math.random() * 26);
    f.vel.x += (Math.random() - 0.5) * 52 * s;
    f.vel.y += (Math.random() - 0.5) * 52 * s;
    f.vel.z += (Math.random() - 0.5) * 52 * s;
  };

  /** 몬스터가 떨어뜨리는 스터드(마나/탄약 보충) */
  FX.prototype.dropStud = function (pos, kind) {
    const s = this._freeSlot(this.studs);
    if (!s) return;
    s.alive = true;
    s.t = 0;
    s.grounded = false;
    s.kind = kind || 'mana';
    const col = kind === 'ammo' ? C.azure : (kind === 'heart' ? C.red : C.yellow);
    s.group.traverse((o) => { if (o.isMesh) o.material = L.mat(col); });
    s.group.position.copy(pos);
    s.group.position.y += 1.5;
    s.group.visible = true;
    const a = Math.random() * Math.PI * 2;
    s.vel.set(Math.cos(a) * 6, 16 + Math.random() * 8, Math.sin(a) * 6);
  };

  // ------------------------------------------------------------------ update
  FX.prototype.update = function (dt, ctx) {
    this.time += dt;
    const v = this._v, v2 = this._v2;

    // ---- 발사체
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.alive) continue;
      p.t += dt;
      if (p.gravity) p.vel.y -= p.gravity * dt;
      v.copy(p.vel).multiplyScalar(dt);
      p.pos.add(v);
      p.group.position.copy(p.pos);
      if (p.spin) {
        p.group.rotation.x += p.spin * dt;
        p.group.rotation.y += p.spin * 0.7 * dt;
      }
      if (p.kind === 'fireball') {
        const s = 1 + Math.sin(this.time * 24) * 0.12;
        p.group.userData.shell.scale.setScalar(s);
      }

      let boom = false;
      // 땅/시간 종료
      if (p.pos.y <= 0.6) { p.pos.y = 0.6; boom = true; }
      if (p.t >= p.life) boom = true;
      if (p.kind === 'bomb' && p.fuse && p.t >= p.fuse) boom = true;

      // 명중 판정
      if (!boom && ctx) {
        if (p.owner === 'player' && ctx.enemies) {
          const hit = ctx.enemies.hitTest(p.pos, p.kind === 'meteor' ? 4 : 1.6);
          if (hit) {
            if (p.radius > 0) boom = true;
            else {
              ctx.enemies.damage(hit, p.dmg, p.pos);
              this.debrisBurst(p.pos, hit.color, 4, 10);
              p.alive = false;
              p.group.visible = false;
              continue;
            }
          }
        } else if (p.owner === 'enemy' && ctx.playerPos) {
          if (p.pos.distanceTo(ctx.playerPos) < 3.2) {
            if (this.hooks.hitPlayer) this.hooks.hitPlayer(p.dmg, p.pos);
            this.explode(p.pos, 3, 0xff7a18, 0);
            p.alive = false;
            p.group.visible = false;
            continue;
          }
        }
      }

      if (boom) {
        p.alive = false;
        p.group.visible = false;
        if (p.radius > 0) {
          this.explode(p.pos, p.radius, p.kind === 'meteor' ? 0xff5a10 : 0xffb03a, p.dmg);
          if (p.kind === 'meteor') {
            this.debrisBurst(p.pos, C.reddishBrown, 16, 26);
            if (this.hooks.onImpact) this.hooks.onImpact(p.pos, 'meteor');
          }
        } else if (p.kind === 'stud') {
          this.debrisBurst(p.pos, C.yellow, 2, 6);
        }
      }
    }

    // ---- 폭발
    for (let i = 0; i < this.explosions.length; i++) {
      const e = this.explosions[i];
      if (!e.alive) continue;
      e.t += dt;
      const k = e.t / e.dur;
      if (k >= 1) { e.alive = false; e.group.visible = false; continue; }
      const s = e.radius * (0.35 + k * 0.95);
      e.ball.scale.setScalar(s);
      e.ball.material.opacity = 0.62 * (1 - k);
      e.ring.scale.setScalar(e.radius * (0.4 + k * 1.5));
      e.ring.material.opacity = 0.8 * (1 - k);
      e.inner.scale.setScalar(e.radius * 0.5 * (1 - k * 0.5));
      e.inner.material.opacity = 1 - k;
    }

    // ---- 파편
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (!d.alive) continue;
      d.t += dt;
      if (d.t >= d.life) { d.alive = false; d.mesh.visible = false; continue; }
      d.vel.y -= GRAVITY * dt;
      v.copy(d.vel).multiplyScalar(dt);
      d.mesh.position.add(v);
      if (d.mesh.position.y < 0.8) {   // 바닥에서 통통
        d.mesh.position.y = 0.8;
        d.vel.y = Math.abs(d.vel.y) * 0.34;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
      }
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
    }

    // ---- 불꽃
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      if (!f.alive) continue;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { f.alive = false; f.mesh.visible = false; continue; }
      v.copy(f.vel).multiplyScalar(dt);
      f.mesh.position.add(v);
      f.vel.multiplyScalar(1 - dt * 1.6);
      f.mesh.scale.setScalar(f.size * (0.5 + k * 1.5));
      f.mesh.material.opacity = 0.85 * (1 - k);
    }

    // ---- 스터드 수집품
    for (let i = 0; i < this.studs.length; i++) {
      const s = this.studs[i];
      if (!s.alive) continue;
      s.t += dt;
      if (!s.grounded) {
        s.vel.y -= GRAVITY * dt;
        v.copy(s.vel).multiplyScalar(dt);
        s.group.position.add(v);
        if (s.group.position.y <= 1.2) {
          s.group.position.y = 1.2;
          s.grounded = true;
        }
      } else {
        s.group.position.y = 1.2 + Math.sin(this.time * 4 + i) * 0.35;
      }
      s.group.rotation.y += dt * 3;
      // 플레이어가 가까이 오면 빨려온다
      if (ctx && ctx.playerPos) {
        const d = s.group.position.distanceTo(ctx.playerPos);
        if (d < 14) {
          v2.copy(ctx.playerPos).sub(s.group.position).normalize().multiplyScalar(dt * (34 - d));
          s.group.position.add(v2);
        }
        if (d < L.PLAYER.pickupRange && ctx.collectStud) {
          ctx.collectStud(s.kind);
          s.alive = false;
          s.group.visible = false;
          continue;
        }
      }
      if (s.t > 22) { s.alive = false; s.group.visible = false; }
    }

    // ---- 메테오 예고 표식
    for (let i = 0; i < this.marks.length; i++) {
      const m = this.marks[i];
      if (!m.alive) continue;
      m.t += dt;
      const k = m.t / m.dur;
      if (k >= 1) { m.alive = false; m.group.visible = false; continue; }
      m.group.rotation.y += dt * 2.2;
      const pulse = 0.9 + Math.sin(this.time * 18) * 0.1;
      m.group.scale.setScalar(m.radius * 0.5 * pulse);
      m.ring.material.opacity = 0.5 + 0.45 * Math.sin(this.time * 14) * 0.5 + 0.2;
    }
  };

  /** 라운드/게임 리셋 시 전부 치운다 */
  FX.prototype.clear = function () {
    const lists = [this.projectiles, this.explosions, this.debris, this.flames, this.studs, this.marks];
    for (let i = 0; i < lists.length; i++) {
      const arr = lists[i];
      for (let j = 0; j < arr.length; j++) {
        arr[j].alive = false;
        (arr[j].group || arr[j].mesh).visible = false;
      }
    }
  };

  L.FX = FX;
})(window.LEGO);
