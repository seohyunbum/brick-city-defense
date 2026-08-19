# AGENTS.md — Codex 작업 계약

이 저장소의 작업 규칙 정본은 `CLAUDE.md`다. 작업 전 `CLAUDE.md`와 아래 문서를 순서대로 읽는다.

1. `docs/GAME_DESIGN_SPEC.md`
2. `docs/TECHNICAL_ARCHITECTURE.md`
3. `docs/ART_AUDIO_BIBLE.md`
4. `docs/EXTERNAL_ASSET_ACQUISITION.md`
5. `docs/UX_ACCESSIBILITY_CHILD_SAFETY.md`
6. `docs/QA_PERFORMANCE_RELEASE_GATES.md`
7. `docs/PRODUCTION_PLAN.md`

## 필수 작업 순서

- 현재 동작과 문서의 `현재`/`목표`를 구분한다. 목표를 구현 완료라고 쓰지 않는다.
- 기능 변경 전 관련 수락 기준과 검증 방법을 먼저 확인한다.
- 외부 파일은 `assets/third-party-assets.json` 등록과 라이선스 증거 없이는 반입하지 않는다.
- 공식 완구 로고·캐릭터·세트 이미지·리핑 자산을 사용하지 않는다. 공개 명칭은 독립 브랜드인 `브릭 시티`다.
- `file://` 오프라인 실행과 GitHub Pages 실행을 모두 유지한다. 이를 깨는 loader/module 도입은 ADR과 사용자 승인 없이는 금지한다.
- 커밋 전 `npm ci`, `npm run verify:static`, `npm run smoke`를 실행한다.
- 실패한 검증 결과를 배포하거나 품질 완료 증거로 쓰지 않는다.

## 변경 완료 조건

코드·자산·문서 변경은 다음이 모두 충족돼야 완료다.

- 설계 수락 기준과 실제 구현이 일치함
- 콘솔 오류 0, 기능 스모크 통과, 예산 내 렌더 비용
- 신규 외부 자산의 출처·권리·SHA-256·변환 이력이 검증됨
- 접근성·아동안전·브랜드 안전 회귀가 없음
- README와 관련 설계 문서가 함께 갱신됨
