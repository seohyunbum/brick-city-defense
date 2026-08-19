# 브릭 시티 아이콘 provenance

- 생성일: 2026-08-19
- 생성 방식: OpenAI image generation tool
- backend model id: 도구가 노출하지 않아 기록 불가
- 참조 이미지: 없음
- 목적: Windows 바로가기, browser/PWA icon, social preview

## Prompt

“Transparent-background original toy-brick city-defense game icon. A compact shield/badge composition with a blue block-built city and police-station-like civic building, a heroic yellow energy sword, and a friendly green block monster. Bold readable silhouette at 32px, polished plastic materials, cinematic rim lighting, vibrant blue/yellow/green palette. No text, no watermark, no official logos, no copied characters, no brand marks.”

## 변환

원본 PNG를 프로젝트 source로 보존하고 32/192/512 PNG와 Windows multi-resolution ICO로 변환했다. 변환본은 crop·resize·icon container 변환이며 공식 로고나 text를 추가하지 않았다. 원본은 `assets/source/`에 있어 Pages에 배포하지 않는다. runtime은 `assets/icons/`의 파생본만 사용한다.

## 검토

- 공식 완구 로고·문자·세트 번호: 없음
- 실존 인물·사진·참조 이미지: 없음
- 독립 이름/URL과 조화: 확인
- 32px 실루엣: sword/city/monster 구분 가능
- source/derivative SHA-256: `assets/third-party-assets.json`에 등록

생성 도구 이용 조건이 제3자 상표·디자인 권리까지 보증하는 것은 아니다. 공개 배포·상업화 전 시각 유사성과 applicable terms를 다시 검토한다. 수정하거나 다시 생성하면 새 asset id, prompt, date, source/derivative SHA를 등록한다.
