# 🧱 브릭 시티 — 브릭 몬스터 방어전
아이와 셀프 게임 제작용

블록 완구 도시 디오라마의 촉감을 3D로 표현한 **독립 1인칭 방어 게임**.
경찰서·횡단보도·빨간 SUV·경찰차·타워크레인·헬리콥터·시민 미니피그가 있는 거리에
브릭 몬스터가 몰려온다. 시민을 지키면서 웨이브 10까지 버티면 승리.

### 실행

- **온라인 플레이·친구 공유**: <https://seohyunbum.github.io/brick-city-defense/>
- **Windows 바탕화면 아이콘 설치**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\install-desktop-shortcut.ps1
  ```
- **아이용**: `index.html` 을 더블클릭 (인터넷 없어도 됨. three.js 를 저장소에 같이 넣어두었다)
- **개발 환경 준비**: `npm ci` · **전체 검증**: `npm run verify`

### 품질 계약

현재 버전은 플레이 가능한 단일 스테이지 프로토타입이다. 문서와 게이트를 갖췄다는 사실이 곧 콘텐츠가
고품질 목표에 도달했다는 뜻은 아니다. `docs/PRODUCTION_PLAN.md`의 P0가 끝나고 실제 하드웨어 검증을
통과하기 전에는 "고퀄리티 완성판"으로 판정하지 않는다.

- 게임 설계: [`docs/GAME_DESIGN_SPEC.md`](docs/GAME_DESIGN_SPEC.md)
- 기술 구조: [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)
- 아트·오디오: [`docs/ART_AUDIO_BIBLE.md`](docs/ART_AUDIO_BIBLE.md)
- 외부 자산 조달: [`docs/EXTERNAL_ASSET_ACQUISITION.md`](docs/EXTERNAL_ASSET_ACQUISITION.md)
- 접근성·아동안전: [`docs/UX_ACCESSIBILITY_CHILD_SAFETY.md`](docs/UX_ACCESSIBILITY_CHILD_SAFETY.md)
- QA·배포: [`docs/QA_PERFORMANCE_RELEASE_GATES.md`](docs/QA_PERFORMANCE_RELEASE_GATES.md)
- 감사·실행계획: [`docs/AUDIT_2026-08-19.md`](docs/AUDIT_2026-08-19.md), [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md)

정적 게이트만 실행하려면 `npm run verify:static`, 브라우저 스모크만 실행하려면 `npm run smoke`를 쓴다.
CI는 두 검증을 모두 통과한 commit만 GitHub Pages에 배포한다.

### 손에 무엇을 드는가 (핵심 규칙)

| 손 | 무엇 | 목록 | 키 | 쓰는 법 |
| --- | --- | --- | --- | --- |
| ✋ **오른손** | **무기** | 🗡️ 검 · 🔫 총 · 💣 폭탄 | `1` `2` `3` | 마우스 **왼쪽 클릭** |
| 📜 **왼손** | **두루마리 스킬** | 🐲 드래곤 파이어 · ☄️ 메테오 · 🔥 파이어볼 | `4` `5` `6` | 마우스 **오른쪽 클릭** 또는 `Space` |

- 무기는 오른손에 **직접 쥔다** (검·총·폭탄 모두 노란 미니피그 손에 들린다).
- 스킬은 왼손에 **두루마리(스크롤) 형태로 장착**된다. 시전하면 두루마리가 펼쳐지고
  문양이 빛나며, 드래곤 파이어는 브릭 드래곤 머리가 나타나 불을 뿜는다.

### 조작

| 키 | 동작 |
| --- | --- |
| `W A S D` | 이동 |
| `Shift` | 달리기 |
| 마우스 이동 | 둘러보기 (화면 클릭 시 마우스 잠금) |
| 마우스 휠 / `Q` | 오른손 무기 바꾸기 |
| `E` | 왼손 두루마리 바꾸기 |
| `Esc` | 잠깐 멈춤 |
| 폰 | 왼쪽 조이스틱 이동 · 화면 드래그 시선 · ✋ 공격 · 📜 시전 버튼 |

### 규칙

- 몬스터는 **브릭 몬스터**만 나온다: 브릭 슬라임 · 브릭 골렘 · 브릭 배트 · 보스 브릭 드래곤(5웨이브마다).
- 쓰러지면 피가 아니라 **브릭 조각**으로 팝 하고 흩어지며 스터드를 떨어뜨린다.
  노란 스터드 = 마나, 파란 스터드 = 총알·폭탄, 빨간 하트 = 체력 회복.
- **시민 미니피그는 공격 대상이 아니다.** 배트는 시민을, 골렘과 일부 슬라임은 경찰 거점을 노린다.
- 시민 대피 실패와 거점 피격은 도시 무결도를 낮춘다. 플레이어 하트 또는 도시 무결도가 0이면 패배한다.
- 웨이브 사이에 탄약 보급·도시 수리·마나 강화 중 하나를 선택한다. 웨이브 10을 넘기면 승리한다.
- 수집품 풀이 가득 차도 보상은 즉시 지급되며 조용히 사라지지 않는다. 최고 점수는 브라우저에 저장된다.

### 파일 구조

| 경로 | 역할 |
| --- | --- |
| `index.html` | HUD 마크업 + 스크립트 로드 순서 |
| `src/style.css` | HUD·시작/종료 화면 스타일 |
| `src/bricks.js` | 브릭 부품 공장(색 팔레트·스터드 텍스처·플레이트·손) |
| `src/loadout.js` | **무기/스킬 정본 표** (수치를 바꾸려면 여기) |
| `src/minifig.js` | 미니피그(시민·경찰) 조립 + 걷기 |
| `src/city.js` | 사진 속 도시 조립(도로·경찰서·연립주택·크레인·헬리콥터·차·나무) |
| `src/hands.js` | 1인칭 두 팔 — 오른손 무기 · 왼손 두루마리 |
| `src/fx.js` | 발사체·폭발·브릭 파편·불꽃·스터드 (전부 풀링) |
| `src/enemies.js` | 브릭 몬스터 4종 + 웨이브 |
| `src/audio.js` | WebAudio 즉석 합성 효과음(에셋 파일 없음) |
| `src/hud.js` | DOM HUD 갱신 |
| `src/input.js` | 키보드·마우스(포인터 락)·터치 |
| `src/storage.js` | 점수 저장 adapter(localStorage 차단 시 메모리 fallback) |
| `src/objectives.js` | 도시 무결도·시민 대피·적 역할별 방어 목표 |
| `src/progression.js` | 웨이브 사이 보급·수리·마나 강화 선택 |
| `src/game.js` | 지휘자+남은 전투/플레이어 규칙(추가 분리 예정인 감사 부채) |
| `scripts/quality-gate.mjs` | 문서·자산 SHA·라이선스·브랜드·용량 정적 게이트 |
| `vendor/three.min.js` | three.js 0.150.1 / REVISION 150 (UMD, MIT) |
| `scripts/smoke.mjs` | 브라우저 스모크 테스트 + 스크린샷 |
| `scripts/install-desktop-shortcut.ps1` | GitHub Pages 버전을 Edge 앱 모드로 여는 바탕화면 바로가기 설치 |
| `assets/icons/brick-city-defense.ico` | Windows 바탕화면 전용 다중 해상도 아이콘 |

`main`에 push되면 GitHub Actions가 정적 게임 파일만 GitHub Pages에 자동 배포한다.

LEGO®는 LEGO Group of companies의 상표이며, LEGO Group은 이 독립 사이트를 후원·승인·보증하지 않습니다.

## Graphics pipeline

The game uses an offline-safe PBR brick look: physical ABS finishes, PMREM reflections, ACES tone mapping, selective rounded edges and a readability-capped miniature lens pass. The design, UE5.8 authoring role, CC0 sourcing policy and measurable visual gates are documented in [docs/GRAPHICS_LOOKDEV_PIPELINE.md](docs/GRAPHICS_LOOKDEV_PIPELINE.md).
