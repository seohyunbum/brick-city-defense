# 아트·애니메이션·오디오 바이블

- 버전: 1.0
- 기준일: 2026-08-19
- 상태: 시각/청각 품질 목표. 외부 BGM은 아직 반입하지 않음

## 1. 독립 시각 정체성

목표는 특정 제품 복제가 아니라 “손으로 조립한 밝은 블록 완구 도시”다. 공개 이름은 브릭 시티다. 공식 로고, 세트 번호, 스티커, 캐릭터 얼굴·비례, 패키지 이미지, 게임 캡처·리핑 자산을 사용하지 않는다. 직사각형 조립물·스터드 같은 일반적 블록 미학도 독자 색·비례·문양으로 조합한다.

현재 강점은 일관된 고채도 팔레트, 경찰서·크레인·헬기 랜드마크, 1인칭 두 손과 무기 실루엣, 유혈 대신 브릭 파편을 쓰는 피격 언어다. 약점은 직선 거리 한 개, 정적 차량, 반복 건물, 자유 RGB 93개, 과도한 DoF, 수학적 bob 중심 애니메이션이다.

## 2. 형태·스케일·실루엣

- 1 stud를 시각 척도 1로 두고 부품 단위를 0.5 배수에 snap한다
- 플레이어가 20m 거리에서 적 역할을 실루엣만으로 구별해야 한다
- 시민, 적, 보스는 몸통 비례·머리 형태·이동 주기가 겹치지 않는다
- 근접 무기는 화면 중심과 crosshair를 가리지 않는다
- 랜드마크는 색이 아닌 지붕선·높이·움직임으로도 구별된다
- 공식 미니피겨 고유 비례를 그대로 재현하지 않고 프로젝트 고유 block-person 비례로 단계 전환한다

## 3. 색과 재질

semantic token을 `COLORS`에 둔다: `plastic.primary`, `plastic.secondary`, `warning`, `safe`, `enemy`, `metal`, `glass`, `road`, `foliage`, `magic.fire`. 새 `0xRRGGBB` 직접 사용은 금지한다. 기존 93개는 수정 파일부터 치환해 숫자를 줄인다.

재질 swatch는 6개로 제한한다.

1. 유광 플라스틱: 주 캐릭터·브릭, 선명한 specular
2. 무광 플라스틱: 도로·큰 판, 낮은 광택
3. 투명 플라스틱: 창·경광등, 중첩 최소화
4. 도장 금속: 크레인·도구, 플라스틱과 다른 highlight
5. 고무: 타이어·손잡이, 거의 무광
6. 마법 emissive: 능력 순간에만, 화면 상시 점유 금지

실재 브랜드 색 이름을 쓰지 않고 프로젝트 token 이름을 쓴다. 투명 재질 overdraw와 material 수를 계측한다.

## 4. 도시 구성

한 화면에 `영웅 랜드마크 1 + 중간 관심점 2 + 생활 디테일 3`을 둔다. 반복 건물은 실루엣, 처마, 옥상 props, 창 atlas로 변주하되 material/draw call을 늘리지 않는다.

- 도로는 3개 접근 방향과 읽히는 spawn lane을 제공한다
- 차·시민·신호는 장식이 아니라 최소한의 상태 변화와 반응을 가진다
- 공격 영역과 안전 구역은 색+표지+바닥 형태로 중복 표기한다
- 플레이 경계는 보이지 않는 벽 대신 공사 울타리·폐쇄 도로 등 세계 안 이유를 쓴다
- 외부 현실 사진을 그대로 복제하지 않는다. reference의 소유·사용 허용을 기록한다

## 5. 빛·후처리·가독성

맑은 낮의 따뜻한 방향광, 푸른 하늘 fill, 약한 안개를 기준으로 한다. 전투 대상 contrast가 배경보다 우선한다.

- DoF는 적·crosshair·위험 표식을 흐리지 않는다
- DoF off 설정과 reduced-motion preset을 제공한다
- vignette, blur, screen shake는 피격 300ms 안에 회복한다
- 흰색 날림과 검정 뭉침이 없도록 12개 golden camera에서 비교한다
- golden view: 시작 전경, 경찰서, 크레인, 교차로 3방향, 각 적 근/중거리, 보스 예고, 각 무기 손, 승패 화면
- 시각 변경 PR은 같은 seed·카메라·해상도의 before/after를 남긴다

## 6. 애니메이션 규격

모든 공격은 `anticipation → contact → recovery` 3단계를 가진다. 단순 sine/bob만으로 공격을 표현하지 않는다.

- 일반 위험 공격 예고 500~700ms, 보스 강공격 800~1,000ms
- contact frame과 hit SFX/VFX 차이 50ms 이하
- 이동은 시작/정지·회전·피격을 구분한다
- 적 타입당 피격 variation 2, 파괴 variation 2 이상
- 보스 단계 전환은 1초 이상이고 조작 불능 연출은 2초를 넘지 않는다
- reduced-motion에서 head-bob, camera shake, 큰 화면 이동을 80% 이상 줄인다

## 7. VFX 가독성

플레이어 공격, 적 공격, 보상, 위험 구역의 색·형태를 겹치지 않게 한다. 색각 차이를 고려해 모양과 움직임을 함께 쓴다.

- 폭탄/메테오 범위는 착탄 전 바닥 ring으로 표시
- 적 발사체는 플레이어 발사체와 실루엣·trail 방향이 다름
- 피해 숫자·파편이 crosshair를 500ms 넘게 가리지 않음
- 파티클은 gameplay collider가 아니며 pool 소진 시 시각만 축소
- 보상은 gameplay 자원이므로 pool 포화로 조용히 삭제하지 않음

## 8. 오디오 현재와 목표

현재는 oscillator/noise 기반 SFX와 master gain만 있다. BGM, ambience, spatial bus, 별도 볼륨, ducking, mute 저장이 없으므로 “고품질 오디오 완료”가 아니다. noise buffer 캐시와 최대 24 voice cap은 최소 성능 안전장치다.

목표 bus: Master → Music / SFX / Ambience / UI. 기본값은 Master 70%, Music 45%, SFX 70%, Ambience 40%. 모두 0~100%, mute, 설정 저장을 지원한다.

### 음악 상태

| 상태 | 역할 | 전환 |
| --- | --- | --- |
| title/explore | 밝고 호기심 있는 도시 | 시작/웨이브 휴식 |
| combat | 리듬 강화, 멜로디는 방해하지 않음 | 적 활성 1초 crossfade |
| boss | 낮은 pulse와 위험 동기 | 보스 등장 예고와 sync |
| victory/defeat | 3~6초 stinger | 결과 화면, loop 없음 |

초기 구현은 explore/combat/boss 3 loop와 승/패 stinger를 목표로 한다. 자동재생 금지, 시작 버튼 입력 후 재생한다.

## 9. SFX coverage와 믹스

coverage 100%가 필요한 사건: UI focus/confirm/back, 발걸음 3표면, 무기 3종 시작/실패/impact, 스킬 3종 cast/loop/impact, 적 4종 등장/공격/피격/파괴, 보상 3종, wave/boss/승패, 시민 위험/구조.

- 음악/환경음 목표: -18 ±2 LUFS integrated, true peak -1 dBTP 이하
- 짧은 SFX는 peak -3 dBFS 이하에서 시작해 플레이테스트로 조정
- 대사/핵심 경고 시 music duck 4~6dB, 80ms attack/350ms release
- 같은 SFX 동시 4 voice, 전체 24 voice. 중요도 낮은 소리를 먼저 steal
- loop boundary click 0, 무음 gap 20ms 이하
- BGM 1곡 4MB 이하, SFX sprite 1MB 이하를 권장한다
- 탭 숨김/일시정지에서 music/ambience를 pause하고 복귀 때 200ms fade

## 10. 무료 오디오 조달 원칙

SFX 1순위는 Kenney CC0의 Interface Sounds, Impact Sounds, RPG Audio에서 필요한 파일만 선택한다. BGM은 자체 제작이 가장 안전하고, 차선은 exact track의 CC0 또는 Scott Buckley CC BY 4.0을 정확한 크레딧과 함께 검토한다. Freesound/OpenGameArt 같은 혼합 사이트는 사이트 단위로 승인하지 않는다.

음원 반입 전 원본 URL, 저작자, 라이선스, raw 재배포 가능 여부, SHA, 편집 내용, loudness, loop 검사를 자산대장에 기록한다. Content ID 등록·원곡 단독 재판매·공식 게임 음악 리핑은 금지한다.

## 11. 아트·오디오 완료 게이트

12 golden view 판독성, semantic palette 위반 감소, 공격 timing, BGM 3상태, SFX coverage, 볼륨/음소거, reduced-motion/DoF off, 라이선스 manifest, file:///Pages 재생, 성능 예산이 모두 PASS여야 완료다.
