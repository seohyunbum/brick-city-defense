# CLAUDE.md — 이 저장소에서 게임을 만들 때의 규칙

아이가 혼자 열어 바로 놀 수 있는 독립 브릭 토이 시티 게임이다. 구현 편의보다 실행 안정성·아동안전·출처 증빙을 우선한다.

## 0. 작업 전 읽기

`GAME_DESIGN_SPEC` → `TECHNICAL_ARCHITECTURE` → `ART_AUDIO_BIBLE` →
`EXTERNAL_ASSET_ACQUISITION` → `UX_ACCESSIBILITY_CHILD_SAFETY` →
`QA_PERFORMANCE_RELEASE_GATES` → `PRODUCTION_PLAN` 순서로 읽는다. 모두 `docs/`에 있다.
문서의 `목표`는 구현 완료가 아니다. 코드·테스트 증거가 있는 항목만 `현재`로 표시한다.

## 1. 실행 방식 (하드 룰)

- **`index.html` 더블클릭(file://)으로 실행돼야 한다.** 서버·빌드·설치 단계를 요구하지 말 것.
- 따라서 **ES module `import` 금지** — `file://` 에서 CORS 로 막힌다. 클래식 `<script>` + 전역 namespace 를 쓴다.
- **CDN 금지.** 라이브러리는 `vendor/` 에 넣고 라이선스 파일을 함께 둔다. 인터넷 없이도 돌아야 한다.
  - 3D는 `vendor/three.min.js` (three 0.150.1, REVISION 150 UMD — UMD는 r160에서 제거됨).
- 외부 GLB/오디오/폰트는 `file://`와 Pages 양쪽 스모크를 통과하기 전 런타임에 연결하지 않는다.
- 실행 계약을 HTTPS 전용으로 바꾸려면 ADR, 마이그레이션·롤백 계획, 사용자 승인이 필요하다.

## 2. 코드 배치

- 역할별로 `src/*.js` 로 쪼갠다. 새 기능을 `src/game.js` 에 몰아넣지 않는다.
  - 데이터·수치 정본 → `src/loadout.js` 같은 표 파일 하나
  - 메시 생성 → 순수 팩토리(부수효과 금지)
  - `game.js` 는 지휘자: 루프·입력 배선·상태 전이만
- 새 파일은 `index.html` 의 `<script>` 순서에 넣는다(의존 파일이 먼저).
- 기존 `game.js`와 `city.js`는 과대 모듈이라는 감사 부채다. 기능 추가 시 각각 Player/Combat/Progression,
  District/Landmark/Traffic 쪽으로 먼저 추출하고 원본 줄 수를 늘리지 않는다.
- 핫패스에서 객체·배열·AudioBuffer를 프레임마다 만들지 않는다. `new`뿐 아니라 리터럴 할당도 계측한다.

## 3. 성능 예산

- `update`/`animate` 안에서 `new` 금지. 발사체·파티클·몬스터는 **풀링 + 상한**.
- 정적인 물체는 `matrixAutoUpdate = false`.
- 창문·창틀처럼 반복되는 장식은 텍스처 또는 `InstancedMesh`로 만든다.
- 최고 품질 실제 프레임 예산: **드로우콜 650 이하, 삼각형 125,000 이하**. 목표는 각각 550/110,000 이하.
- 초기 실행 payload 10MB 이하, 개별 런타임 파일 4MB 이하, 외부 GLB 권장 2MB 이하.
- 그림자는 한 프레임 걸러 갱신하고, 그림자를 드리우는 물체는 꼭 필요한 것만.
- 소프트웨어 headless FPS를 하드웨어 성능 증거로 쓰지 않는다. 하드웨어 게이트는 QA 문서의 p95 frame-time으로 판정한다.

## 4. 아트·브랜드 규칙

- 색은 팔레트(`src/bricks.js` 의 `COLORS`)만 쓴다. 자유 RGB 금지.
- 플라스틱 광택 = `MeshPhongMaterial` + specular. `THREE.ColorManagement.legacyMode = false` 를 켜둔다
  (끄면 전체가 하얗게 날아간다).
- 스터드(돌기)는 넓은 판은 텍스처(map + bumpMap), 가까운 부품은 실제 실린더.
- 공개 제품명은 **브릭 시티**다. 특정 완구사의 공식 로고·상표 강조·세트명·스티커·캐릭터·게임 리핑 자산 금지.
- 독립적인 블록 완구 미학을 사용하고 공식 후원·승인으로 오인될 표현을 만들지 않는다.
- 기존 자유 RGB는 감사 부채다. `quality-gate`의 93개 베이스라인을 늘리지 말고 수정 파일부터 semantic token으로 치환한다.

## 5. 아이 기준 (하드 룰)

- 사람·동물 모양 상대 금지, 유혈 금지. 상대는 **브릭 몬스터**처럼 무생물 형태로.
- 시민 미니피그는 지켜야 하는 대상 — 공격 대상으로 만들지 않는다.
- 쓰러지는 연출은 "브릭이 팝 하고 흩어지기".
- 광고·과금·채팅·계정·개인정보 수집·외부 링크·UGC는 별도 아동안전 검토 없이 추가 금지.
- 감광 효과, 반복 플래시, 과도한 카메라 흔들림 금지. reduced-motion/DoF off 옵션을 로드맵 P0로 둔다.

## 6. 외부 자산 (하드 룰)

- 사이트·팩 단위로 "무료" 승인하지 않는다. 정확한 asset/version/file 단위로 심사한다.
- `assets/third-party-assets.json`에 source URL, author, SPDX, license evidence, SHA-256, 수정·변환 이력을 등록한다.
- 기본 허용: CC0-1.0, MIT, BSD-2/3-Clause, Apache-2.0, OFL-1.1. CC-BY-4.0은 정확한 크레딧 자동 검증 시만 조건부.
- Unknown, NC, ND, 출처 없는 AI 산출물, hotlink, 버전 없는 CDN, 공식 완구 리핑 자산은 차단한다.
- 원본 전체 팩을 넣지 않는다. 선택본만 최적화하고 원본·파생 SHA와 변환 명령을 남긴다.

## 7. 검증·배포

```powershell
npm ci
npm run verify:static
npm run smoke
```

- 스모크는 콘솔 오류 0, 실제 조작, 자유 이동·청크 스트리밍, 안전지대 평화, 위험 구역 서식,
  게임오버 없음, 저장소 차단 fallback,
  오디오 voice cap, 실제 렌더 패스 예산, 스크린샷을 확인한다.
- `main` 배포는 CI 품질 job 통과 후에만 가능하다. 실패한 pipeline 산출물을 배포하지 않는다.
- 자동 스모크 통과는 하드웨어 60fps 증거가 아니다. 품질 마일스톤 전 수동 하드웨어 매트릭스도 통과해야 한다.
- 완료 보고에는 실행 명령, 결과, 남은 수동 게이트, 배포 commit SHA를 쓴다.
