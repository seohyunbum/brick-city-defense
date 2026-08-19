# 브릭 시티 품질 보완 실행계획

- 버전: 1.0
- 기준일: 2026-08-19
- 현재 제품 판정: 시각적으로 매력적인 vertical-slice seed, 고품질 완성판은 아님

## 1. 우선순위 규칙

P0는 공개 배포의 진실성·안전·재현성을 막는 항목, P1은 core loop와 콘텐츠 품질, P2는 폭과 장식이다. P0가 FAIL인 동안 외부 asset pack 대량 반입, 새 맵, 적 수량 증가는 금지한다. 각 단계는 문서가 아니라 실행 증거로 종료한다.

## 2. P0-A 기반 통제 — 이번 보완 범위

- [x] GDD, 기술 구조, 아트/오디오, 자산 조달, UX/아동안전, QA, 실행계획 작성
- [x] 현재 자산 manifest와 SHA-256, icon provenance, THIRD_PARTY_NOTICES 작성
- [x] package.json/package-lock과 Playwright exact version 고정
- [x] static quality gate 추가: 문서, 브랜드, 네트워크, 자산, license, hash, payload, 색상 ratchet
- [x] Pages 배포 전에 quality job 의존, Action commit SHA 고정, postdeploy build SHA 확인
- [x] public title/canonical/shortcut을 독립 `브릭 시티`로 변경
- [x] localStorage 차단 시 memory fallback과 안전한 fatal error DOM
- [x] WebAudio noise buffer 1회 cache, flame throttle, 최대 24 voice
- [x] 원본 1.65MB icon을 runtime 배포 경로에서 source 보관 경로로 분리

종료 증거: `npm ci`, `npm run verify:static`, `npm run smoke`, git diff review, CI run, Pages online smoke. 이 증거가 없는 체크는 구현됨이지 검증 완료가 아니다.

## 3. P0-B 게임 약속을 진실로 만들기

### B1. Defense Objective

- [x] 도시 무결도, 거점, 시민 대피 상태 구현
- [x] 적 target 선택을 player-only에서 objective-aware로 분리
- [x] 승패/결과 화면에 시민·도시 지표 포함
- [x] 시민 공격 무효, 거점 damage, repair 선택 자동 회귀테스트
- [x] 보상 pool 초과 시 즉시 지급·손실 0 계측
- [ ] deterministic seed 20개와 보호/무시 사용자 플레이테스트

현재 판정: 자동 기능 계약 PASS, 플레이테스트·seed 재현·10웨이브 밸런스는 미완료. 전체 완료는 보호/무시 플레이의 승패·점수가 다르고 deterministic seed 20개에서 재현될 때다.

### B2. 첫 60초와 설정

- 단계 튜토리얼, context hint, 건너뛰기
- 감도/FOV/키 remap/UI scale/난이도
- master/music/sfx/ambience/mute
- reduced-motion/head-bob/shake/DoF off
- keyboard-only/focus/ARIA

완료: 첫 사용자 8/10이 도움 없이 3분 내 wave1, 접근성 수락표 전부 PASS.

### B3. 성능·경제 안정성

- 실제 frame pass 계측, pool exhaustion counter
- pickup 48 pool 포화 시 gameplay drop 유실 금지 정책
- 매 프레임 `fx.update` 객체/closure 재사용
- render target 픽셀 면적 cap·dispose·context restore
- low/high quality 경로와 20분 soak

완료: QA 하드웨어 매트릭스와 soak PASS, warm baseline 대비 resource +5% 이내.

## 4. P0-C 구조 부채 상환

기능을 추가하기 전에 `game.js`에서 PlayerController, CombatSystem, ProgressionSystem, ObjectiveSystem을 추출하고 `city.js`를 District/Landmark/Traffic으로 나눈다. 기능은 바꾸지 않는 작은 commit으로 진행하고 각 추출마다 smoke를 통과한다.

팔레트 직접 색상 93개는 semantic token으로 치환한다. gate는 증가를 막고 목표는 0이다. 우선순위는 enemy telegraph → FX → lighting → decorative city다.

완료: game.js는 boot/wiring/state/tick만 소유, 과대 모듈 줄 수 감소, dependency direction 문서와 일치.

## 5. P1-A 외부 자산 pilot

1. Kenney Brick/Roads/Car 15~25개 shortlist
2. 한 landmark만 변환하여 procedural 현 버전과 A/B
3. source/derived hash, license snapshot, transform command 기록
4. file://와 Pages 양쪽 smoke
5. draw call +50, triangles +15k, runtime +2MB 이내에서 확대
6. Kenney SFX 12개 audio sprite pilot
7. credits/settings 후 BGM 1곡 pilot

완료: 조달 11단계 gate, golden view, 성능, NOTICE 전부 PASS. 팩 전체 반입 금지.

## 6. P1-B 콘텐츠와 조우

- 스폰 방향 3, 비처치 목표 2, elite modifier 2
- 보스 2단계·3공격·500~1,000ms telegraph
- 웨이브 사이 강화 선택 4회
- 도시 생활 이벤트 6
- 각 도구의 고유 최적 시나리오

완료: 10웨이브 12~18분, seed 20개, 신규 사용자/숙련자 플레이테스트, 특정 도구 독점·사장 없음.

## 7. P2 시각·오디오 polish

- 12 golden view와 material swatch calibration
- 이동/공격 anticipation-contact-recovery, 피격/파괴 variation
- explore/combat/boss 3 loop + 승패 stinger
- SFX coverage 100%, spatial/ducking/mix
- landmark와 traffic/시민 state 변화

P2는 P0/P1 기준을 완화할 권한이 없다. 장식 때문에 판독성·성능·아동안전이 악화되면 제거한다.

## 8. 리스크 레지스터

| 위험 | 가능성/영향 | 선행 통제 | 중단 조건 |
| --- | --- | --- | --- |
| 공개 상표/공식 연계 오인 | 중/상 | 독립 이름·URL·아이콘·고지·자산 금지 | 공식 logo/세트/리핑 발견 |
| file://와 GLB 충돌 | 상/상 | build-time classic bundle pilot | 한 경로라도 smoke FAIL |
| 외부 팩으로 용량·draw 폭증 | 상/상 | 선택 1개 A/B, hard cap | +2MB/+50 calls 초과 |
| 성능 gate 허위 녹색 | 중/상 | hardware trace와 headless 분리 | 장치/trace 없는 FPS 주장 |
| 보상 pool 포화로 난이도 변동 | 중/중 | 초과 보상 즉시 지급+overflow/lost 계측 | gameplay drop 유실 1건 |
| 아동 접근성 미흡 | 상/상 | first-user·settings·motion gate | P0 접근성 FAIL |
| architecture 재비대화 | 상/중 | line ratchet, extract-first | game/city 줄 수 증가 |
| BGM license/Content ID | 중/상 | exact track/NOTICE/repo 권리 | license 불명/NC/ND |

## 9. 주간 운영

월요일에 P0 gate와 risk를 확인하고, 한 sprint에 architecture·asset·gameplay 중 한 축만 크게 바꾼다. 금요일에는 `npm run verify`, target PC trace, screenshot diff, manifest diff를 함께 검토한다. 실패를 숨긴 평균값 대신 worst seed와 p95/p99를 기록한다.

## 10. 최종 완료 정의

P0/P1 task, 자동 CI, target hardware, 20분 soak, first-user 8/10, 자산 manifest/NOTICE, 접근성, 아동안전, BGM/mix, postdeploy SHA, rollback rehearsal가 모두 PASS일 때만 high-quality milestone을 선언한다.
