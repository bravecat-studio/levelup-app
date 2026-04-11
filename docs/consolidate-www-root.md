# www/ 단일 루트 통합 (Consolidate www as Single Root)

## 변경 배경

기존 프로젝트는 웹 소스 파일이 **프로젝트 루트**와 **www/** 폴더에 이중으로 존재하며,
`sync-www.sh` 스크립트로 양방향 동기화하는 구조였다.

### 문제점
- **26개 파일 + tesseract 라이브러리(~17MB)** 가 루트와 www/에 중복 존재
- git 타임스탬프 기반 동기화 로직이 복잡하고 충돌 위험
- CI/CD 파이프라인마다 동기화 단계가 반복되어 빌드 시간 낭비
- 어느 쪽을 수정해야 하는지 혼란 발생

### 해결
`www/`를 유일한 웹 소스 루트로 지정하고, 루트의 중복 파일과 동기화 로직을 완전 제거했다.

---

## Before / After 구조 비교

### Before (이중 구조)
```
/
├── app.html          ← 중복
├── app.js            ← 중복
├── data.js           ← 중복
├── style.css         ← 중복
├── sw.js             ← 중복
├── modules/          ← 중복 디렉토리
├── tesseract-core/   ← 중복 디렉토리
├── tesseract-lang/   ← 중복 디렉토리
├── sync-www.sh       ← 동기화 스크립트
├── www/
│   ├── app.html
│   ├── app.js
│   ├── ...
│   ├── modules/
│   ├── admin/
│   └── tesseract-core/
└── (설정 파일들)
```

### After (단일 루트)
```
/
├── www/                    ← 유일한 웹 소스 루트
│   ├── app.html            (앱 UI)
│   ├── app.js              (핵심 로직)
│   ├── index.html          (랜딩 페이지)
│   ├── data.js             (다국어 데이터)
│   ├── style.css           (스타일시트)
│   ├── sw.js               (서비스 워커)
│   ├── logger.js           (로깅)
│   ├── manifest.json       (PWA 매니페스트)
│   ├── privacy.html        (개인정보처리방침)
│   ├── terms.html          (이용약관)
│   ├── usage-policy.html   (이용정책)
│   ├── ads.txt             (AdSense)
│   ├── modules/            (기능 모듈)
│   ├── admin/              (관리자 대시보드)
│   ├── tesseract-core/     (OCR WASM)
│   └── tesseract-lang/     (OCR 언어 데이터)
├── package.json
├── capacitor.config.json
├── firebase.json
├── scripts/
├── functions/
├── native-plugins/
├── res/
└── .github/workflows/
```

---

## 삭제된 파일 목록

### 루트 중복 웹 파일 (16개)
- `app.html`, `app.js`, `data.js`, `logger.js`, `index.html`
- `style.css`, `intro-style.css`
- `firebase-messaging-sw.js`, `manifest.json`, `push-test.html`, `sw.js`
- `account-deletion.html`, `life-status-consent.html`, `oss.html`
- `tesseract.min.js`, `worker.min.js`

### 루트 중복 디렉토리
- `modules/` (11개 JS 모듈)
- `tesseract-core/` (4개 WASM 파일)
- `tesseract-lang/` (OCR 학습 데이터)

### www/로 이동된 파일 (6개)
- `privacy.html`, `terms.html`, `usage-policy.html`, `feature-graphic.html`
- `ads.txt`, `CNAME`

### 삭제된 스크립트
- `sync-www.sh` (양방향 동기화 스크립트)

---

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | sync-www 스크립트 제거, main 경로 변경 |
| `scripts/version-bump.sh` | 루트 sw.js/app.js 참조 제거, www/ 전용으로 변경 |
| `scripts/generate-firebase-config.sh` | www/에 직접 생성하도록 변경 |
| `scripts/cros-package.sh` | 소스 파일 경로를 www/로 변경 |
| `.gitignore` | 루트 firebase-config.js 항목 제거 |
| `.github/workflows/build.yml` | 동기화 스텝 제거, 웹 빌드 준비 간소화 |
| `.github/workflows/deploy-firebase.yml` | push-test.html 동기화 제거, 설정 직접 생성 |
| `.github/workflows/deploy-rollback.yml` | 동기화 스텝 제거, 경로 변경 |
| `.github/workflows/auto-version.yml` | 루트 파일 git add 제거 |
| `.github/workflows/pr-check.yml` | 파일 검증 경로를 www/로 변경, 동기화 검증 제거 |
| `.github/workflows/release-aab.yml` | 동기화 스텝 제거, git add 경로 변경 |
| `.github/workflows/backup.yml` | CROS 소스코드 수집 경로 변경 |

---

## Capacitor 엔트리포인트 처리

Capacitor는 `www/index.html`을 엔트리포인트로 사용한다.
웹 배포(Firebase Hosting)에서는 `index.html`이 랜딩 페이지이지만,
Android 빌드에서는 `app.html` 내용으로 오버라이드해야 한다.

CI/CD에서 Android 빌드 전 아래 명령이 실행된다:
```bash
cp www/app.html www/index.html
```

---

## 개발 시 주의사항

1. **모든 웹 파일은 `www/` 디렉토리에서 편집**한다
2. 루트에는 설정 파일(package.json, capacitor.config.json 등)만 존재
3. `sync-www.sh`는 더 이상 존재하지 않으므로 동기화 불필요
4. 로컬 개발 시 Firebase Hosting 에뮬레이터나 브라우저에서 `www/`를 직접 서빙
5. 버전 변경 시 `bash scripts/version-bump.sh`만 실행하면 www/ 내 파일이 자동 업데이트됨
