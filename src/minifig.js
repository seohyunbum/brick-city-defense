/* =========================================================================
 * minifig.js — 미니피그(시민·경찰) 조립기
 * 사진의 인물들: 초록 재킷 아저씨, 주황/줄무늬 아이들, 파란 제복 경찰,
 * 빨간 모자 아이, 공사장 인부(주황 조끼 + 노란 헬멧).
 * 시민은 "지켜야 하는 대상"이다. 공격 대상이 아니다(enemies.js 는 브릭 몬스터만).
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  const OUTFITS = [
    { torso: C.green, legs: C.darkBlue, hair: C.brown, face: 'smile', name: '아저씨' },
    { torso: C.orange, legs: C.brown, hair: C.black, face: 'smile', name: '이웃' },
    { torso: C.white, legs: C.blue, hair: C.reddishBrown, face: 'smile', name: '아이', small: true, stripes: true },
    { torso: C.red, legs: C.black, hair: C.black, face: 'smile', name: '주민' },
    { torso: C.azure, legs: C.darkGray, hair: C.yellow, face: 'smile', name: '학생', small: true },
    { torso: C.lime, legs: C.darkBlue, hair: C.brown, face: 'smile', name: '주민' },
    { torso: C.white, legs: C.blue, cap: C.red, face: 'smile', name: '야구모자', small: true },
    { torso: C.orange, legs: C.darkTan, helmet: C.yellow, face: 'smile', name: '공사장 인부' },
  ];

  const POLICE = { torso: C.blue, legs: C.darkBlue, cap: C.blue, face: 'police', name: '경찰관', badge: true };

  /**
   * 미니피그 하나. 반환 그룹의 userData 에 애니메이션용 관절이 들어있다.
   * @param {object} o outfit
   */
  function minifig(o) {
    o = o || OUTFITS[0];
    const g = new THREE.Group();
    const scale = o.small ? 0.78 : 1;
    const body = new THREE.Group();
    body.scale.setScalar(scale);
    g.add(body);

    // ----- 다리 (엉덩이 블록 + 두 다리)
    const hip = new THREE.Mesh(L.box(1.7, 0.5, 1.05), L.mat(o.legs));
    hip.position.y = 1.85;
    hip.castShadow = true;
    body.add(hip);

    const legGeo = L.box(0.78, 1.65, 1.0);
    const legL = new THREE.Mesh(legGeo, L.mat(o.legs));
    const legR = new THREE.Mesh(legGeo, L.mat(o.legs));
    legL.castShadow = legR.castShadow = true;
    const hipL = new THREE.Group(); hipL.position.set(-0.45, 1.62, 0); legL.position.y = -0.82; hipL.add(legL);
    const hipR = new THREE.Group(); hipR.position.set(0.45, 1.62, 0); legR.position.y = -0.82; hipR.add(legR);
    // 신발: 발끝이 살짝 앞으로 나온 검은 판
    for (const [pivot, sx] of [[hipL, -1], [hipR, 1]]) {
      const shoe = new THREE.Mesh(L.box(0.86, 0.34, 1.25), L.mat(C.black, 'matte'));
      shoe.position.set(0, -1.5, 0.14);
      shoe.castShadow = true;
      pivot.add(shoe);
      void sx;
    }
    // 신발(살짝 어두운 색)
    body.add(hipL, hipR);

    // ----- 몸통: 실물 미니피그처럼 위가 넓고 아래가 좁은 사다리꼴
    const torso = new THREE.Mesh(L.cyl(1.32, 1.06, 1.95, 4), L.mat(o.torso));
    torso.rotation.y = Math.PI / 4;
    torso.scale.z = 0.6;
    torso.position.y = 3.05;
    torso.castShadow = true;
    body.add(torso);
    // 목 스터드
    const neck = new THREE.Mesh(L.cyl(0.3, 0.3, 0.3, 10), L.mat(o.torso));
    neck.position.y = 4.05;
    body.add(neck);
    // 가슴 인쇄(지퍼·주머니 느낌의 얇은 판)
    const print = new THREE.Mesh(L.box(0.9, 1.1, 0.03), L.mat(o.hair || C.black, 'matte'));
    print.position.set(0, 3.0, 0.53);
    body.add(print);
    if (o.stripes) { // 줄무늬 티셔츠 (한 줄로 충분히 티가 난다)
      const s1 = new THREE.Mesh(L.box(1.72, 0.5, 1.1), L.mat(C.blue));
      s1.position.y = 2.95; body.add(s1);
    }
    if (o.badge) { // 경찰 금색 배지
      const b = new THREE.Mesh(L.cyl(0.2, 0.2, 0.07, 8), L.mat(C.gold, 'metal'));
      b.rotation.x = Math.PI / 2;
      b.position.set(-0.45, 3.2, 0.54);
      body.add(b);
    }

    // ----- 팔 + 손
    function arm(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.16, 3.62, 0);
      const upper = new THREE.Mesh(L.box(0.52, 1.25, 0.6), L.mat(o.torso));
      upper.position.y = -0.55;
      upper.rotation.z = -side * 0.16;
      upper.castShadow = true;
      pivot.add(upper);
      const hand = L.clawHand(C.yellow);
      hand.position.set(side * 0.2, -1.22, 0.12);
      hand.rotation.set(Math.PI / 2, 0, 0);
      pivot.add(hand);
      body.add(pivot);
      return pivot;
    }
    const armL = arm(-1), armR = arm(1);

    // ----- 머리
    const headMats = [
      L.mat(C.yellow), L.mat(C.yellow),
      L.mat(C.yellow), L.mat(C.yellow),
      L.mat(C.yellow), L.mat(C.yellow),
    ];
    const head = new THREE.Mesh(L.cyl(0.62, 0.62, 0.95, 16), L.mat(C.yellow));
    head.position.y = 4.32;
    head.castShadow = true;
    body.add(head);
    // 얼굴(앞면 판)
    const face = new THREE.Mesh(L.box(0.95, 0.8, 0.02), new THREE.MeshPhongMaterial({
      map: L.faceTexture(o.face || 'smile'), transparent: true, specular: 0x555555, shininess: 40,
    }));
    face.position.set(0, 4.34, 0.615);
    body.add(face);

    if (o.helmet) {
      const h = new THREE.Mesh(L.sph(0.72, 14), L.mat(o.helmet));
      h.scale.y = 0.72; h.position.y = 4.86; h.castShadow = true;
      body.add(h);
      const brim = new THREE.Mesh(L.box(1.5, 0.14, 0.6), L.mat(o.helmet));
      brim.position.set(0, 4.74, 0.5); body.add(brim);
    } else if (o.cap) {
      const c = new THREE.Mesh(L.cyl(0.64, 0.66, 0.4, 16), L.mat(o.cap));
      c.position.y = 4.94; c.castShadow = true; body.add(c);
      const brim = new THREE.Mesh(L.box(1.24, 0.1, 0.62), L.mat(o.cap));
      brim.position.set(0, 4.78, 0.56); body.add(brim);
    } else if (o.hair) {
      const hair = new THREE.Mesh(L.box(1.34, 0.78, 1.36), L.mat(o.hair));
      hair.position.y = 4.86; hair.castShadow = true; body.add(hair);
    }

    g.userData.joints = { hipL, hipR, armL, armR, head, body };
    g.userData.outfit = o;
    void headMats;
    return g;
  }

  /** 걷기 애니메이션: 관절 각도만 갱신(새 객체 생성 금지) */
  function animateWalk(fig, phase, speed) {
    const j = fig.userData.joints;
    if (!j) return;
    const s = Math.sin(phase) * (0.5 + speed * 0.5);
    j.hipL.rotation.x = s * 0.55;
    j.hipR.rotation.x = -s * 0.55;
    j.armL.rotation.x = -s * 0.42;
    j.armR.rotation.x = s * 0.42;
    j.body.position.y = Math.abs(Math.cos(phase)) * 0.08;
  }

  L.OUTFITS = OUTFITS;
  L.POLICE_OUTFIT = POLICE;
  L.minifig = minifig;
  L.animateWalk = animateWalk;
})(window.LEGO);
