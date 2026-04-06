# 리뷰: 루트 ↔ www/ 중복 파일 및 양방향 동기화 분석

> 작성일: 2026-04-06

## 배경

현재 프로젝트에서 루트 디렉토리와 `www/` 디렉토리에 동일한 파일 11개가 중복 존재하며, `sync-www.sh` 스크립트로 양방향 동기화되고 있음. Capacitor 앱 구조상 이 중복이 반드시 필요한지 확인.

## 중복 파일 현황

| 파일 | 크기 | 루트 | www/ | 상태 |
|------|------|:----:|:----:|------|
| app.js | 846 KB | ✓ | ✓ | 동일 |
| app.html | 154 KB | ✓ | ✓ | 동일 |
| data.js | 160 KB | ✓ | ✓ | 동일 |
| style.css | 122 KB | ✓ | ✓ | 동일 |
| intro-style.css | 20 KB | ✓ | ✓ | 동일 |
| logger.js | 13 KB | ✓ | ✓ | 동일 |
| index.html | 24 KB | ✓ | ✓ | 동일 |
| firebase-messaging-sw.js | 2.3 KB | ✓ | ✓ | 동일 |
| manifest.json | 0.6 KB | ✓ | ✓ | 동일 |
| sw.js | - | ✓ | ✓ | 동일 |
| push-test.html | - | ✓ | ✓ | 동일 |

**총 중복 용량:** 약 1.3 MB

## 동기화 메커니즘 (`sync-www.sh`)

- git 커밋 타임스탬프 기반으로 최신 파일 판별
- 루트 타임스탬프 > www → 루트에서 www로 복사
- www 타임스탬프 > 루트 → www에서 루트로 복사
- 타임스탬프 동일 시 파일 크기 비교, 루트 우선
- `package.json`의 `sync`, `build-apk`, `sync-www` 스크립트에서 호출
- CI 워크플로우 5개(`build.yml`, `release-aab.yml`, `deploy-rollback.yml`, `pr-check.yml`, `auto-version.yml`)에서 사용

## 결론: Capacitor에 필수가 아님

**Capacitor가 요구하는 것:**
- `capacitor.config.json`의 `webDir: "www"` 디렉토리에 웹 파일이 존재하면 됨
- 루트에 동일 파일이 있을 필요 없음

**Firebase Hosting:**
- `firebase.json`의 `public: "www"`에서 배포
- 역시 루트 파일 불필요

## 현재 구조의 문제점

1. **불필요한 중복** — 동일 파일이 두 곳에 존재하여 저장소 용량 낭비
2. **git 히스토리 오염** — CI에서 "sync: www/→루트", "sync: 루트→www/" 자동 커밋 생성
3. **충돌 위험** — rebase/amend 시 타임스탬프 판별 오류 가능성
4. **빌드 복잡성** — 빌드/배포 파이프라인에 불필요한 동기화 단계

## 향후 개선 권장사항

현재는 변경 없이 유지하되, 추후 정리 시 아래 방식 권장:

### 단방향 복사 (루트 → www)

1. `sync-www.sh`를 단방향 복사 스크립트(`copy-to-www.sh`)로 교체
2. 루트를 유일한 소스로 지정, www/는 빌드 산출물로 취급
3. www/ 중복 파일을 `.gitignore`에 추가하여 git 추적 제거
4. CI 워크플로우에서 양방향 동기화 커밋 로직 제거
5. `scripts/version-bump.sh`의 www/ 이중 쓰기 제거

### 주의사항

- `www/admin/` 디렉토리는 www에만 존재 → 영향 없음
- `account-deletion.html`은 루트와 www에서 내용이 다름 → 별도 확인 필요
- `deploy-firebase.yml`의 트리거 경로(`www/**`) 수정 필요
