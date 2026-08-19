# 기술 아키텍처와 작업 지침

- 버전: 1.0
- 기준일: 2026-08-19
- 상태: 현재 구조와 목표 구조를 분리한 기술 계약

## 1. 불변 실행 계약

1. GitHub Pages의 최신 `main`이 정식 실행본이다.
2. Windows 바로가기는 Pages URL을 Edge 앱 모드로 연다.
3. `index.html` 더블클릭(`file://`)도 인터넷·서버·빌드 없이 실행한다.
4. 런타임 CDN, ES module, 원격 API, hotlink는 금지한다.
5. 라이브러리는 exact version과 license evidence를 `vendor/`와 자산대장에 고정한다.

이 계약 때문에 최신 glTF loader를 그대로 import하거나 `.glb`를 fetch하는 구현은 승인되지 않는다. 외부 3D 자산은 (A) build-time에 프로젝트 전용 classic JS geometry bundle로 변환해 `file://`에서도 읽거나, (B) loader를 IIFE로 고정하고 binary를 `parse`하는 검증된 경로를 만든다. HTTPS 전용 전환은 별도 ADR과 사용자 승인 전에는 금지한다.

## 2. 현재 구조

| 모듈 | 현재 책임 | 감사 판정 |
| --- | --- | --- |
| `bricks.js` | 팔레트·재질·브릭 factory | 유지, semantic color 확장 필요 |
| `loadout.js` | 무기·스킬·플레이어 수치 | SSOT로 적절 |
| `city.js` | 전체 도시·랜드마크·시민 배치 | 1,087줄 과대 모듈, 확장 차단 |
| `game.js` | 부팅·상태·전투·이동·보상·시민 | 600줄대 책임 집중, 규칙 위반 |
| `fx.js` | 발사체·파편·스터드 pool | 상한은 장점, 드롭 pool 소진 정책 필요 |
| `enemies.js` | 적 factory·AI·웨이브 | 조우 데이터와 실행 분리 필요 |
| `audio.js` | 합성 SFX | noise cache/voice cap 반영, BGM bus 없음 |
| `storage.js` | 점수 저장과 차단 fallback | 신규 경계 adapter |

현재 코드의 전역 `window.LEGO`/`window.LEGO_GAME`은 레거시 기술 namespace다. 공개 브랜드는 브릭 시티이며 신규 API는 `window.BRICK_GAME` alias를 사용한다. namespace 전체 교체는 기능 변경과 분리한 refactor에서 수행한다.

## 3. 목표 의존 방향

`bootstrap → state machine → systems → data/factories → Three/WebAudio adapter` 한 방향만 허용한다.

- `bootstrap.js`: DOM 준비, renderer 생성, fatal error 처리
- `game.js`: start/playing/pause/over 상태 전이와 고정 tick 배선
- `player-controller.js`: 이동·카메라·피격
- `combat-system.js`: 무기/스킬 사용과 damage contract
- `progression-system.js`: 웨이브 보상·강화·점수
- `objective-system.js`: 시민·거점·도시 무결도
- `encounter-director.js`: seed, spawn zone, wave grammar
- `district-*.js`: 도시 구역 factory
- `asset-runtime.js`: 등록된 자산만 로드하고 실패 시 대체물 사용

system은 HUD DOM이나 구체 mesh를 직접 만지지 않고 event/data를 반환한다. `game.js`는 규칙 수식을 소유하지 않는다. 새 기능이 과대 모듈을 늘리는 PR은 반려한다.

## 4. 상태와 시간

상태는 `start → playing ↔ pause → over`다. 추후 `settings`, `wave-choice`, `loading-error`를 명시 상태로 추가한다. 숨은 boolean 조합으로 상태를 만들지 않는다.

- 프레임 `dt`는 최대값을 clamp한다. 탭 복귀 후 물리·피해 폭증 금지
- RNG seed와 simulation clock을 주입 가능하게 만들어 웨이브 1~10을 재현한다
- render update와 gameplay update를 분리한다
- hot path context/object는 생성자에서 1회 만들고 재사용한다
- pool exhaustion은 counter를 올리고, 게임플레이 자원은 조용히 유실하지 않는다

## 5. 데이터 정본

- 전투 수치: `src/loadout.js`
- 적 archetype·웨이브: 향후 `src/encounter-data.js`
- 팔레트·재질 token: `src/bricks.js`
- 설정 schema: 향후 `src/settings.js`, version 포함
- 외부 자산: `assets/third-party-assets.json`
- 품질 숫자: `docs/QA_PERFORMANCE_RELEASE_GATES.md`와 smoke constant. 중복 시 자동검사로 차단

값을 코드 여러 곳에 복제하지 않는다. “현재” 수치를 바꿀 때 설계표, 테스트 fixture, 수락 기준을 함께 변경한다.

## 6. 렌더·메모리 예산

- 현재 최고 품질 실제 패스 합계 hard cap: draw calls 650, triangles 125,000
- 목표: draw calls 550, triangles 110,000
- 정적 반복물은 InstancedMesh 또는 atlas; 충돌은 단순 proxy
- 텍스처는 기본 1K 이하, sRGB/linear 용도를 명시, 4K 원본 런타임 반입 금지
- 외부 GLB 권장 2MB 이하, 개별 런타임 파일 hard cap 4MB
- 초기 실행 payload hard cap 10MB
- DPR은 픽셀 면적 상한과 설정 tier로 제한한다. 4K/DPR2 render target의 무제한 할당 금지
- WebGL context loss/restore와 resize 뒤 target dispose를 테스트한다

headless SwiftShader FPS는 하드웨어 품질 증거가 아니다. 자동 테스트는 구조·회귀를 잡고, p95/p99 frame-time은 지정 PC에서 측정한다.

## 7. 오디오·저장·실패 격리

- WebAudio는 사용자 입력 이후 resume한다
- master/music/sfx/ambience bus를 분리하고 voice cap을 가진다
- 합성 noise buffer는 1회 생성한다. source node는 종료 시 active counter를 반드시 반납한다
- localStorage 접근은 `storage.js`만 수행하고 SecurityError, quota, 손상값에서 memory/default로 fallback한다
- 저장 실패는 게임 부팅·승패를 막지 않는다
- 자산 로드 실패는 전체 부팅을 죽이지 않고 등록된 fallback과 사용자 메시지를 쓴다
- 오류 문자열을 `innerHTML`로 삽입하지 않는다

## 8. 자산 반입 파이프라인

`후보 URL → 권리 검토 → 원본 격리 → SHA-256 → 바이러스/구조 검사 → 선택·변환 → 파생 SHA → 시각/오디오 검수 → file:///Pages smoke → manifest/NOTICE → commit` 순서다.

원본 팩 전체를 Git에 넣지 않는다. 변환 도구와 exact version, 명령, 입력·출력 hash를 남긴다. glTF는 Khronos Validator error 0, 외부 절대 경로 0, 불필요 camera/light 0을 요구한다.

## 9. 보안·네트워크

현재 런타임은 same-origin 정적 파일 외 네트워크 요청이 0이어야 한다. fetch/XHR/WebSocket/EventSource/analytics/광고 SDK는 설계 승인이 없으면 정적 게이트에서 차단한다. GitHub Pages에 적용 가능한 CSP는 HTTPS 전환 검토와 함께 추가하며 목표 정책은 `default-src 'self'; connect-src 'none'`이다.

## 10. 개발·검증·커밋

```powershell
npm ci
npm run verify:static
npm run smoke
npm run verify
```

- `package-lock.json`을 임의 삭제·재생성하지 않는다
- 테스트가 실패하면 배포하지 않는다
- 자산 변경은 manifest hash와 NOTICE를 같은 commit에 포함한다
- 코드 변경은 관련 문서의 현재/목표 상태를 갱신한다
- 자동 생성 screenshot은 `.smoke/`에 두고 commit하지 않는다
- 외부 Actions는 tag가 아니라 검증한 40자리 commit SHA로 고정한다

## 11. 배포와 롤백

CI `quality`가 정적·브라우저 스모크를 통과해야 `deploy`가 실행된다. 배포물은 `build-info.json`에 commit SHA를 기록하고 배포 후 URL의 SHA가 현재 commit과 일치하는지 확인한다.

롤백은 GitHub에서 마지막 green commit을 확인한 뒤 해당 commit을 새 revert commit으로 되돌려 정상 pipeline으로 재배포한다. force-push, Pages 수동 덮어쓰기, 실패 artifact 재사용은 금지한다. 마지막 green SHA와 smoke artifact를 릴리스 기록에 남긴다.
