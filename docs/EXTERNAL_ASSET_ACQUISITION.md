# 외부 자산 확보·라이선스 정책

- 버전: 1.0
- 조사 기준일: 2026-08-19
- 상태: 후보 승인 정책. 아래 후보 자산은 아직 런타임에 반입하지 않음
- 주의: 법률자문이 아니라 배포 리스크를 줄이는 엔지니어링 통제다

## 1. 적대적 결론

“무료 다운로드”는 사용·수정·공개 Git 저장소 재배포 허가가 아니다. 사이트나 팩 전체를 한 번에 승인하지 않는다. 정확한 asset page, version, 원본 file, license evidence, SHA-256 단위로 승인한다. CC0도 상표·퍼블리시티·개인정보 권리까지 자동 해결하지 않는다.

현재 저장소는 외부 그래픽/BGM을 실제로 사용하지 않고, three.js MIT와 프로젝트 생성 아이콘만 `assets/third-party-assets.json`에 등록했다. 후보표는 조달 우선순위이지 “이미 확보됨”을 뜻하지 않는다.

## 2. 라이선스 정책

### 기본 허용

- `CC0-1.0`: exact asset page가 CC0를 명시하고 제3자 로고·인물·브랜드가 없을 때
- `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`: 저작권·license notice를 보존할 때
- `OFL-1.1`: font license와 Reserved Font Name 조건을 보존할 때
- `CC-BY-4.0`: 저작자·제목·원본 URL·license link·수정 사실을 게임 크레딧과 NOTICE에 정확히 표시할 때만 조건부

### 차단 또는 별도 승인

- Unknown, “royalty free”만 있고 원문 없는 자산
- NC, ND, 출처 불명, 재배포 금지, raw repository 포함이 불명확한 자산
- SA는 코드·게임 전체에 미치는 효과를 별도 검토하기 전 차단
- 공식 완구 로고·세트·캐릭터·스티커·게임 BGM·리핑 모델·공식 CAD 추출물
- 버전 없는 CDN, hotlink, 검색 결과 이미지, 핀터레스트/팬 위키 재업로드
- AI 생성물 중 사용 도구·날짜·prompt·참조 이미지·제3자 권리 검토가 기록되지 않은 파일

## 3. 우선 후보 카탈로그

판정은 권리와 기술 적합성에 대한 사전심사다. 실제 파일 반입은 6절 게이트를 다시 통과한다.

| 후보·공식 출처 | 용도 | 공개 라이선스 | file://·r150 적합성 | 사전판정 |
| --- | --- | --- | --- | --- |
| [Kenney Brick Kit](https://kenney.nl/assets/brick-kit) | 독립 브릭 부품, 3D | CC0 | 모델은 build-time 변환 필요 | 승인 1순위 |
| [Kenney City Kit Roads](https://kenney.nl/assets/city-kit-roads) | 도로·교차로 | CC0 | 필요한 타일만 변환·instancing | 승인 |
| [Kenney City Kit Suburban](https://www.kenney.nl/assets/city-kit-suburban) | 주택·생활 props | CC0 | 구역별 선택, 전체 팩 금지 | 승인 |
| [Kenney City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | 상업 건물 배경 | CC0 | LOD·충돌 proxy 필수 | 승인 |
| [Kenney Car Kit](https://kenney.nl/assets/car-kit) | 차량 | CC0 | pivot·바퀴 node 검수 | 승인 |
| [Kenney UI Pack](https://kenney.nl/assets/ui-pack) | 버튼·패널 | CC0 | atlas로 선택 변환 | 승인 |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), [Impact Sounds](https://www.kenney.nl/assets/impact-sounds), [RPG Audio](https://www.kenney.nl/assets/rpg-audio) | UI·타격·발걸음 | CC0 | OGG/MP3 선택본, 사용자 입력 후 재생 | 승인 1순위 |
| [Quaternius Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html) | 모듈형 도심·props | CC0 | glTF 선택본을 project bundle로 변환 | 승인 |
| [ambientCG](https://docs.ambientcg.com/license/) 1K road/plastic/grass | PBR 재질 | CC0 | 1K base/normal/ORM만, displacement 제외 | 승인 |
| [Poly Haven](https://polyhaven.com/license) 1K street HDRI | 조명 reference/IBL | CC0 | r150 loader·VRAM 검증 전 조건부 | 조건부 |
| [Howler.js](https://github.com/goldfire/howler.js) | BGM/SFX bus, sprite | MIT | classic script build 가능, exact version 필요 | 승인 후보 |
| [Jua](https://github.com/google/fonts/blob/main/ofl/jua/OFL.txt) | 한글 타이틀 폰트 | OFL-1.1 | subset 후 local vendor, 시스템 글꼴 우선 | 승인 후보 |
| [Scott Buckley music](https://www.scottbuckley.com.au/library/using-this-music/) | explore/combat BGM | CC BY 4.0 중심 | 정확한 트랙별 조건·크레딧·repo 재배포 검토 | 조건부 |
| [OpenGameArt Urban Theme](https://opengameart.org/content/urban-theme) | 밝은 도시 loop | 해당 asset page는 CC0 | 원본·저작자·loop를 개별 검증 | 조건부 |
| [Freesound](https://freesound.org/help/faq/) | 보조 SFX 탐색 | CC0/BY/NC 혼합 | exact file license 없으면 차단 | 사이트 승인 금지 |

Kenney는 공식 support에서 asset page 자산이 CC0이고 상업 이용·무표시 사용 가능하다고 설명하지만 Kenney 로고는 사용할 수 없다고 명시한다. Poly Haven은 asset 자체와 사이트 로고·페이지 콘텐츠를 구분한다. 공급 사이트의 preview render나 로고를 자산처럼 복사하지 않는다.

## 4. “고퀄리티”를 망치는 과다 조달 방지

- 팩 전체를 저장소에 넣지 않는다. 첫 sprint는 Brick/Roads/Car에서 15~25개, Downtown 배경 5~8개만 후보로 고른다
- 4K~24K HDRI, 2K~8K PNG texture, 수 GB 오디오 bundle을 반입하지 않는다
- 시각 언어가 다른 low-poly 팩을 여러 개 섞지 않는다
- 외부 모델이 procedural city보다 비싸면 전체 교체가 아니라 landmark/background부터 A/B test한다
- 외부 자산이 current draw call·triangles·payload hard cap을 넘기면 “고퀄”이라는 이유로 예산을 올리지 않는다

## 5. file://와 glTF 호환 전략

현재 three 0.150.1 UMD와 classic script는 `.glb`를 자동으로 읽는 경로가 없다. 최신 `GLTFLoader`는 ES module이고 file origin에서는 CORS 문제를 만들 수 있다.

허용 전략:

1. build-time에서 선택 모델을 merge/optimize한 뒤 프로젝트 전용 classic JS geometry/material data로 변환
2. r150 호환 loader를 exact source에서 IIFE로 bundle하고, binary를 fetch하지 않고 등록된 byte bundle을 parse
3. 텍스처/오디오는 브라우저별 file origin smoke를 통과하고 실패 fallback을 제공

금지 전략: file:// 계약을 몰래 제거, CDN import, `fetch('./model.glb')`가 Pages에서만 된다는 이유로 승인, loader/decoder/WASM 버전 미고정.

## 6. 자산 반입 11단계 게이트

1. 공식 제작자 사이트·공식 GitHub의 exact asset page 확인
2. license 원문과 commercial/modify/redistribute/public repo 허용을 사람이 확인
3. 로고·상표·인물·캐릭터·제3자 texture가 없는지 확인
4. 원본 archive의 실행 파일·script·추가 license를 검사
5. 원본 파일과 license snapshot의 SHA-256 기록
6. 선택 파일만 격리하고 변환 도구 exact version과 명령 기록
7. glTF Validator error 0, missing texture/NaN/절대경로/camera/light 0
8. 1K texture, GLB 권장 2MB, BGM 4MB, SFX sprite 1MB 예산 확인
9. 아트/오디오 바이블에 맞는 실루엣·재질·loudness·loop 검수
10. `file://`와 Pages smoke, 최악 웨이브 성능, fallback 확인
11. manifest·NOTICE·인게임 credits를 같은 commit에 넣고 CI 통과

하나라도 FAIL/UNKNOWN이면 `assets/external/`에 넣지 않는다.

## 7. 자산대장 필수 필드

`id`, status, category, display name, author, exact source page, actual download URL, download time, source version/release date, SPDX, license URL/evidence snapshot, commercial/modify/redistribute/public repo 판정, attribution, trademark/person risk, original filename/SHA, derived filename/SHA, transform command/tool version, before/after size, resolution/color space/poly/material/draw call/animation, runtime loader/version, file:///Pages support, reviewer/date, replacement history.

AI 산출물은 provider/tool, backend model id(노출된 경우), date, full prompt, referenced image와 그 권리, transformation, source/derivative SHA, 브랜드·인물 검토를 추가한다.

## 8. 첫 조달 sprint

1. Kenney Brick Kit에서 근거리 landmark 디테일 8개, Roads 6개, Car 4개를 shortlist
2. 원본을 Git 밖 격리하고 1개 landmark만 vertical slice 변환
3. existing procedural version과 12 golden view A/B 비교
4. draw call +50 이하, triangles +15,000 이하, runtime +2MB 이하에서만 다음 10개로 확대
5. Kenney CC0 SFX 12개를 audio sprite 1개로 만들고 합성 SFX와 청음 비교
6. BGM은 자산대장·크레딧 UI·볼륨 설정이 구현된 뒤 1곡만 pilot

이 순서를 통과하기 전 Quaternius 대량 도시, HDRI, animation library를 동시에 들이지 않는다.

## 9. 변경 감시

license page는 변할 수 있으므로 다운로드 시점 snapshot/hash를 보존한다. 후보표의 URL이 살아 있다는 이유만으로 이전 판정을 재사용하지 않는다. 새 버전은 새 asset id와 SHA로 다시 심사한다.
