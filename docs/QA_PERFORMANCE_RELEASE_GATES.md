# QA·성능·릴리스 게이트

- 버전: 1.0
- 기준일: 2026-08-19
- 상태: 자동 게이트 일부 구현, 하드웨어·접근성·20분 soak는 미통과

## 1. 원칙

“실행됨”, “콘솔 오류 없음”, “보기 좋음”은 서로 다른 주장이다. 각 주장은 자동 로그, 수동 관찰, screenshot/video, 자산 manifest 중 재현 가능한 증거와 연결한다. software renderer FPS를 실제 PC 성능으로 해석하지 않는다.

## 2. 현재 자동 게이트

`npm run verify:static`은 필수 문서, 공개 브랜드/URL, CDN·네트워크 API, package lock, Action SHA, 자산 등록/SHA/license/NOTICE, 미등록 binary, runtime payload, 직접 색상 ratchet, 과대 모듈 증가를 검사한다.

`npm run smoke`는 file origin 부팅, console/page error 0, 화면, 무기·스킬, 실제 키 이동, 웨이브 전이, 게임오버/재시작, 저장 차단 fallback, 오디오 voice cap, 실제 world+postfx+hands 패스의 draw calls/triangles를 검사한다.

현재 hard cap:

- 최고 품질 actual render passes draw calls ≤650
- triangles ≤125,000
- runtime payload ≤10MB
- individual runtime file ≤4MB
- 외부 GLB 권장 ≤2MB, BGM 1곡 ≤4MB, SFX sprite ≤1MB
- 콘솔/page error 0

기준 측정은 기존 감사에서 draw calls 467~499, triangles 97,062~98,114였다. 값의 차이는 scene timing/RNG에 따른 범위이며 cap을 느슨하게 만드는 근거가 아니다.

## 3. FPS 해석 규칙

Playwright smoke는 CI 호환을 위해 headless software/installed Chrome을 사용할 수 있다. 기존 SwiftShader 측정 4 FPS는 자동 기능 시험 환경이 느리다는 사실만 보여 준다. 실제 하드웨어 실패의 증거도, 60fps 성공의 증거도 아니다.

자동 smoke는 FPS를 출력하되 하드웨어 인증에 사용하지 않는다. 하드웨어 인증은 아래 PC·해상도에서 Chrome/Edge performance trace의 p95/p99 frame-time으로 판정한다.

## 4. 목표 하드웨어 매트릭스

| tier | 기준 | 해상도·설정 | 게이트 |
| --- | --- | --- | --- |
| low | Intel UHD 620급 iGPU, 8GB RAM | 1280×720 low | p95 ≤33.3ms, p99 ≤45ms |
| target | GTX 1650급 또는 동급, 16GB | 1920×1080 high | p95 ≤16.7ms, p99 ≤25ms |
| scale | target GPU | 2560×1440 high | p95 ≤25ms |
| stress | target GPU | 3840×2160 capped DPR | crash/context loss 0, p95 기록 |

각 tier에서 Edge와 Chrome, cold start 3회, 20분 session 1회를 수행한다. 장치·브라우저·commit·설정·trace 파일을 기록한다. 측정 전후 GPU driver 변경도 남긴다.

## 5. 최악 장면과 soak

최악 장면은 웨이브 10 보스, 최대 일반 적, dragonfire, 폭탄/메테오, pickup·파편 peak, 시민/거점 목표가 동시에 활성인 seed다.

- pool exhaustion counter 0. 시각 particle만 degrade 가능하고 탄약/마나/하트는 유실 금지
- 20분 후 JS heap, renderer geometries, textures가 warm baseline 대비 +5% 이내
- context loss, NaN transform, unhandled rejection, long task >100ms 0을 목표
- pause/blur 60초 뒤 복귀, resize/DPR 변경, alt-tab 입력 stuck 0
- quality fallback low/high 양쪽 검증. smoke가 high만 강제한다는 사실을 별도 기록

현재 pickup 48개 pool은 wave10에서 드롭 누적 시 포화될 수 있으므로 exhaustion 계측·recycle 정책 구현 전 경제 안정성은 FAIL이다.

## 6. 기능 시나리오

1. file://와 Pages cold boot
2. W/A/S/D·Shift·mouse·1~6·Q/E·pause 실제 입력
3. 모든 무기/스킬 성공·자원 부족·cooldown
4. 웨이브 1~10 deterministic seed 20개
5. 보스 각 pattern·phase·telegraph
6. 시민 공격 무효, 구조·거점·도시 무결도 승패
7. pool full, 저장 denied/quota/corrupt, AudioContext denied
8. game over/win/restart, best/settings migration
9. pointer lock denied, blur/resume, WebGL context loss
10. online build-info SHA와 HEAD 일치

내부 API로 상태를 강제하는 시험은 unit/diagnostic이고 실제 사용자 흐름을 대체하지 않는다.

## 7. 시각·오디오·접근성

- 12 golden camera 동일 seed/카메라/해상도 screenshot diff와 사람 검수
- 적·경고·crosshair 판독, DoF off/reduced-motion, color-only cue 0
- attack contact와 SFX/VFX 차이 ≤50ms
- loop click 0, music -18±2 LUFS, true peak ≤-1dBTP, ducking 동작
- master/music/sfx/ambience slider와 mute 저장
- 키보드-only 전체 흐름, 중요 text ≥16px, 보조 ≥14px, 대비 ≥4.5:1
- 첫 사용자 8/10이 도움 없이 3분 내 wave1 완료

현재 BGM·설정·접근성 UI가 없으므로 이 게이트는 FAIL이다.

## 8. 자산·법무 게이트

- manifest coverage 100%, 원본/파생 SHA 100%, license evidence 100%
- Unknown/NC/ND/source 없는 파일 0
- CC-BY attribution과 변경 사실이 NOTICE·게임 credits에 일치
- 공식 로고·리핑·제3자 인물/브랜드 0
- generated asset provenance 100%
- public name/URL/icon의 독립 브랜드 검토

법률 확정 판단이 아니라 공개 배포 리스크를 낮추는 gate이며, 상업화 전 별도 법무 검토가 필요하다.

## 9. CI와 배포

`quality` job이 exact lock의 dependency를 설치하고 static+smoke를 통과해야 `deploy`가 실행된다. Actions는 40자리 commit SHA로 고정한다. smoke screenshot은 성공/실패 모두 7일 보관한다.

배포 artifact에는 정적 런타임만 넣고 source icon·docs·원본 pack을 제외한다. `build-info.json`의 commit SHA를 배포 후 읽어 현재 SHA와 일치시키며, 불일치 시 workflow를 실패로 표시한다.

## 10. 릴리스 판정표

| gate | 자동/수동 | 현재 |
| --- | --- | --- |
| static docs/assets/license | 자동 | 구현, 실행 확인 필요 |
| functional smoke | 자동 | 기존 PASS, 확장본 확인 필요 |
| draw/triangle budget | 자동 | 기존 수치 내 |
| CI-before-deploy | 자동 | workflow 반영 |
| postdeploy SHA | 자동 | workflow 반영 |
| target hardware | 수동+trace | FAIL/증거 없음 |
| 20분 soak/pool | 자동+수동 | FAIL/미구현 |
| defense objective | 자동+playtest | FAIL/미구현 |
| accessibility/settings | 자동+수동 | FAIL/미구현 |
| music/mix | 수동+tool | FAIL/미구현 |

하나의 P0 gate라도 FAIL이면 “고품질 완성판” release label을 쓰지 않는다.

## 11. 롤백

1. 현재 Pages build-info와 workflow run을 보존
2. 마지막 green commit과 smoke artifact 확인
3. 문제 commit을 revert하는 새 commit 생성. force-push 금지
4. 동일 quality pipeline 통과 후 배포
5. Pages build-info가 rollback SHA인지 확인
6. 원인·영향·재발 방지·자산 hash 변경 여부를 release 기록에 남김

수동 파일 업로드나 실패 artifact 재배포는 롤백으로 인정하지 않는다.
