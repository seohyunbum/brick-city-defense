# 🧱 브릭 시티 — 오픈월드
아이와 셀프 게임 제작용

블록 완구 도시 디오라마의 촉감을 3D로 표현한 **독립 오픈월드 게임**. 자유롭게 돌아다니며 탈것을 타고, 브릭을 모아 짓고, 시민을 돕는다. 몬스터 이벤트는 선택이다.
경찰서·횡단보도·빨간 SUV·경찰차·타워크레인·헬리콥터·시민 미니피그가 있는 거리에
2048×2048 스터드의 도시를 마음대로 돌아다니는 **오픈월드**다. 승리도 패배도 없다.
광장·학교·놀이터·경찰서·소방서는 안전지대이고, 도시 밖으로 갈수록 위험해진다.
크레인과 항구에는 구역의 주인이 산다. 싸울지 지나칠지는 플레이어가 고른다.

### 실행

- **온라인 플레이·친구 공유**: <https://seohyunbum.github.io/brick-city-defense/>
- **Windows 바탕화면 아이콘 설치**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\install-desktop-shortcut.ps1
  ```
- **아이용**: `index.html` 을 더블클릭 (인터넷 없어도 됨. three.js 를 저장소에 같이 넣어두었다)
- **단편 영화**: `story.html` 을 더블클릭하거나 시작 화면의 `🎬 미래의 이야기` 를 누른다 —
  미래의 브릭 시티를 그린 74초짜리 셀 애니메이션 톤 단편 「여든여섯 번째 새벽」
- **개발 환경 준비**: `npm ci` · **전체 검증**: `npm run verify`

### 품질 계약

현재 버전은 플레이 가능한 단일 스테이지 프로토타입이다. 문서와 게이트를 갖췄다는 사실이 곧 콘텐츠가
고품질 목표에 도달했다는 뜻은 아니다. `docs/PRODUCTION_PLAN.md`의 P0가 끝나고 실제 하드웨어 검증을
통과하기 전에는 "고퀄리티 완성판"으로 판정하지 않는다.

- 게임 설계: [`docs/GAME_DESIGN_SPEC.md`](docs/GAME_DESIGN_SPEC.md)
- 단편 영화: [`docs/STORY_86_SHORT_FILM.md`](docs/STORY_86_SHORT_FILM.md)
- 기술 구조: [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)
- 아트·오디오: [`docs/ART_AUDIO_BIBLE.md`](docs/ART_AUDIO_BIBLE.md)
- 외부 자산 조달: [`docs/EXTERNAL_ASSET_ACQUISITION.md`](docs/EXTERNAL_ASSET_ACQUISITION.md)
- 접근성·아동안전: [`docs/UX_ACCESSIBILITY_CHILD_SAFETY.md`](docs/UX_ACCESSIBILITY_CHILD_SAFETY.md)
- QA·배포: [`docs/QA_PERFORMANCE_RELEASE_GATES.md`](docs/QA_PERFORMANCE_RELEASE_GATES.md)
- 감사·실행계획: [`docs/AUDIT_2026-08-19.md`](docs/AUDIT_2026-08-19.md), [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md)

정적 게이트만 실행하려면 `npm run verify:static`, 브라우저 스모크만 실행하려면 `npm run smoke`,
단편 스모크만 실행하려면 `npm run smoke:story` 를 쓴다.
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
| `F` | 가까운 브릭 생물에게 간식 주기 — 친구가 되어 따라온다 |
| `T` | 브릭 도감 열기/닫기 |
| `Esc` | 잠깐 멈춤 |
| 폰 | 왼쪽 조이스틱 이동 · 화면 드래그 시선 · ✋ 공격 · 📜 시전 · 🤝 친구 · 📖 도감 버튼 |

### 규칙

- 몬스터는 **브릭 몬스터**만 나온다: 브릭 슬라임 · 브릭 골렘 · 브릭 배트 · 구역의 주인 브릭 드래곤.
- 쓰러지면 피가 아니라 **브릭 조각**으로 팝 하고 흩어지며 스터드를 떨어뜨린다.
  노란 스터드 = 마나, 파란 스터드 = 총알·폭탄, 빨간 하트 = 체력 회복.
- **시민 미니피그는 공격 대상이 아니다.** 배트는 시민을, 골렘과 일부 슬라임은 경찰 거점을 노린다.
- **게임오버가 없다.** 하트가 0이 되면 잠깐 쉬었다가 그 자리에서 다시 걷는다.
- **건물 안에 들어갈 수 있다.** 주택가의 집 한 채와 경찰서·소방서·학교·정비소는 문으로
  걸어 들어간다. 안에는 침대·접수대·칠판·작업대가 있고, 들어가면 조명이 실내로 바뀐다.
- 구역의 주인을 잡으면 탄약·마나·체력 보상이 그 자리에서 바로 들어온다.
- 수집품 풀이 가득 차도 보상은 즉시 지급되며 조용히 사라지지 않는다. 최고 점수는 브라우저에 저장된다.

### 📖 브릭 도감 — 브릭 생물 36종

도시에는 싸우는 상대가 아닌 **브릭 생물** 36종이 산다. 12 가족 × 3 단계(불·물·풀·번개·돌·바람·
얼음·빛·철·모래·하늘·밤), 몸 구성 6종(뭉치·네발·두발·날개·뱀·구슬)이다.

- 가까이 가면 도감에 저절로 적힌다. 생물이 먼저 구경하러 다가오고, 너무 붙으면 부끄러워 물러난다.
- `F` 로 모은 브릭을 간식으로 주면 **친구**가 되어 따라 걷는다(1단계 10 · 2단계 20 · 3단계 35 브릭).
- `T` 로 도감을 펼친다. 만난 생물·친구 수는 판을 새로 시작해도 남는다.
- **생물은 절대 다치지 않고 너를 공격하지도 않는다.** 무기 판정에 아예 들어가지 않으며,
  근처에서 무기를 휘두르면 놀라 뒤로 폴짝 뛸 뿐이다. 안전지대에도 생물이 산다.
- 구역마다 사는 가족이 다르다. 항구·해변에는 물, 공사장·정비소에는 철·돌, 공원·밭에는 풀.

### 파일 구조

| 경로 | 역할 |
| --- | --- |
| `index.html` | HUD 마크업 + 스크립트 로드 순서 |
| `src/style.css` | HUD·시작/종료 화면 스타일 |
| `src/bricks.js` | 브릭 부품 공장(색 팔레트·스터드 텍스처·플레이트·손) |
| `src/loadout.js` | **무기/스킬 정본 표** (수치를 바꾸려면 여기) |
| `src/minifig.js` | 미니피그(시민·경찰) 조립 + 걷기 |
| `src/world.js` | 오픈월드 청크 스트리밍·병합 렌더·충돌·스폰 지점 헬퍼 |
| `src/districts.js` | 구역 조립(도심·주택·공원·항구·공사장·경찰서·소방서·학교·놀이터) |
| `src/props.js` | 구역을 채우는 야외 소품 |
| `src/hands.js` | 1인칭 두 팔 — 오른손 무기 · 왼손 두루마리 |
| `src/fx.js` | 발사체·폭발·브릭 파편·불꽃·스터드 (전부 풀링) |
| `src/enemies.js` | 브릭 몬스터 4종 + 위치 기반 소환 |
| `src/creatures.js` | **브릭 생물 36종 정본 표** (이름·속성·몸 구성·간식·서식 구역) |
| `src/creature-mesh.js` | 생물 모양 공장 — 종별로 몸통 1 + 팔다리 2 로 병합(마리당 드로우콜 3) |
| `src/companions.js` | 생물 행동: 어슬렁·구경·놀람·친구 되어 따라오기 (피해 경로 없음) |
| `src/dex.js` | 브릭 도감 기록(비트마스크 저장)과 도감 화면 |
| `src/director.js` | 구역별 정원·위협 등급·구역의 주인 (웨이브 디렉터 대체) |
| `src/interiors.js` | 걸어 들어갈 수 있는 건물 껍데기·실내 살림·실내 조명 |
| `src/audio.js` | WebAudio 즉석 합성 효과음(에셋 파일 없음) |
| `src/hud.js` | DOM HUD 갱신 |
| `src/input.js` | 키보드·마우스(포인터 락)·터치 |
| `src/storage.js` | 점수·도감 저장 adapter(localStorage 차단 시 메모리 fallback) |
| `src/objectives.js` | 몬스터가 무엇을 노리는가 |
| `src/progression.js` | 구역의 주인 처치 보상 |
| `src/combat.js` | 오른손 무기·왼손 두루마리 전투 규칙(game.js 에서 추출) |
| `src/game.js` | 지휘자: 부팅·루프·입력 배선·상태 전이 |
| `scripts/quality-gate.mjs` | 문서·자산 SHA·라이선스·브랜드·용량 정적 게이트 |
| `vendor/three.min.js` | three.js 0.150.1 / REVISION 150 (UMD, MIT) |
| `scripts/smoke.mjs` | 브라우저 스모크 테스트 + 스크린샷 |
| `scripts/install-desktop-shortcut.ps1` | GitHub Pages 버전을 Edge 앱 모드로 여는 바탕화면 바로가기 설치 |
| `assets/icons/brick-city-defense.ico` | Windows 바탕화면 전용 다중 해상도 아이콘 |

`main`에 push되면 GitHub Actions가 정적 게임 파일만 GitHub Pages에 자동 배포한다.

LEGO®는 LEGO Group of companies의 상표이며, LEGO Group은 이 독립 사이트를 후원·승인·보증하지 않습니다.

## Graphics pipeline

The game uses an offline-safe PBR brick look: physical ABS finishes, PMREM reflections, ACES tone mapping, selective rounded edges and a readability-capped miniature lens pass. The design, UE5.8 authoring role, CC0 sourcing policy and measurable visual gates are documented in [docs/GRAPHICS_LOOKDEV_PIPELINE.md](docs/GRAPHICS_LOOKDEV_PIPELINE.md).
