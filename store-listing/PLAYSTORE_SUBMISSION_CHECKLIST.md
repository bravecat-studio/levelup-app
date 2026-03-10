# 플레이스토어 등록 체크리스트
## LEVEL UP: REBOOT (com.levelup.reboot)

---

## 1단계: 릴리즈 키스토어 준비 (최초 1회)

릴리즈 키스토어는 **절대 분실/변경하면 안 됩니다**. 분실 시 앱 업데이트 불가능.

```bash
# 릴리즈 키스토어 생성
keytool -genkeypair -v \
  -keystore levelup-release.keystore \
  -alias levelup-key \
  -keyalg RSA -keysize 2048 -validity 25000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=BRAVECAT STUDIOS,O=BRAVECAT,C=KR"

# Base64 인코딩 (GitHub Secrets 등록용)
base64 -w 0 levelup-release.keystore
```

### GitHub Secrets 등록 (Settings → Secrets → Actions)

| Secret 이름 | 값 |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | 위 base64 명령 결과 |
| `RELEASE_KEYSTORE_PASSWORD` | YOUR_STORE_PASSWORD |
| `RELEASE_KEY_ALIAS` | `levelup-key` |
| `RELEASE_KEY_PASSWORD` | YOUR_KEY_PASSWORD |

**⚠️ 키스토어 파일과 비밀번호를 안전한 곳에 백업하세요!**

---

## 2단계: Firebase SHA-1 지문 등록

릴리즈 키스토어의 SHA-1을 Firebase Console에 등록해야 Google 로그인 작동.

```bash
keytool -list -v \
  -keystore levelup-release.keystore \
  -alias levelup-key \
  -storepass YOUR_STORE_PASSWORD
```

→ Firebase Console → 프로젝트 설정 → Android 앱 (com.levelup.reboot) → SHA 인증서 지문 추가

---

## 3단계: Google Play Console 앱 등록

1. [Google Play Console](https://play.google.com/console) 접속
2. **앱 만들기** 클릭
3. 기본 정보 입력:
   - 앱 이름: `LEVEL UP: REBOOT`
   - 기본 언어: `한국어 (ko-KR)`
   - 앱 또는 게임: `앱`
   - 유료 또는 무료: `무료`
4. 개발자 프로그램 정책 및 미국 수출법 동의

---

## 4단계: 스토어 등록정보 작성

### 한국어 (기본)
- **앱 이름** (30자 이내): `LEVEL UP: REBOOT - 현실 레벨업 RPG`
- **간단한 설명** (80자 이내): `store-listing/ko-KR/short_description.txt` 참고
- **자세한 설명** (4000자 이내): `store-listing/ko-KR/full_description.txt` 참고

### 영어 번역 추가
- **앱 이름**: `LEVEL UP: REBOOT - Real Life RPG`
- **간단한 설명**: `store-listing/en-US/short_description.txt` 참고
- **자세한 설명**: `store-listing/en-US/full_description.txt` 참고

---

## 5단계: 그래픽 자산 준비

| 자산 | 크기 | 상태 | 파일 |
|---|---|---|---|
| 앱 아이콘 | 512×512 PNG | ✅ 있음 | `play_store_512.png` |
| 특성 이미지 (Feature Graphic) | 1024×500 PNG/JPG | ❌ 필요 | 직접 제작 필요 |
| 스크린샷 (휴대전화) | 최소 2장, 16:9 또는 9:16 | ❌ 필요 | 직접 캡처 필요 |

### 스크린샷 권장 내용
1. 로그인/메인 화면 (LEVEL UP 브랜딩)
2. 스탯 현황 화면 (STR/INT/CHA/VIT/WLT/AGI)
3. 주간 퀘스트 목록
4. 던전 레이드 화면
5. 소셜 랭킹 화면

### 특성 이미지 가이드
- 크기: 1024×500px
- 배경: 어두운 테마 (#0a0a0f 계열)
- 텍스트: LEVEL UP: REBOOT 로고 + 핵심 기능 표현
- 게임 UI 스타일

---

## 6단계: 앱 카테고리 및 콘텐츠 등급

### 카테고리
- **앱 카테고리**: 건강/피트니스 또는 라이프스타일
- **태그**: 자기계발, 습관 추적, 게이미피케이션

### 콘텐츠 등급 (IARC 설문)
- 폭력: 없음 (게임 테마이나 실제 폭력 없음)
- 선정성: 없음
- 언어: 없음
- **예상 등급**: 전체 이용가 (Everyone)

---

## 7단계: 데이터 보안 양식 작성

Play Console → 데이터 보안에서 아래 항목 신고:

| 데이터 유형 | 수집 여부 | 목적 |
|---|---|---|
| 이메일 주소 | ✅ 수집 | 계정 생성/로그인 |
| 이름 | ✅ 수집 | 프로필 표시 |
| 사용자 ID | ✅ 수집 | 앱 기능 |
| 위치 (대략적) | ✅ 선택적 | 걸음 수 추적 |
| 신체 활동 | ✅ 선택적 | 걸음 수/피트니스 |
| 앱 활동 | ✅ 수집 | 분석/앱 기능 |

**데이터 처리**: 암호화 전송 ✅ | 삭제 요청 가능 ✅

---

## 8단계: 릴리즈 AAB 빌드 및 업로드

1. GitHub Actions → `릴리즈 AAB 빌드 (플레이스토어 제출용)` 워크플로우 실행
   - `version_name`: `1.0.0`
   - `version_code`: `1`
2. Artifacts에서 `app-release.aab` 다운로드
3. Play Console → 프로덕션 → 새 릴리즈 만들기 → AAB 업로드

---

## 9단계: 앱 검토 제출

- 출시 노트 작성 (한국어):
  ```
  LEVEL UP: REBOOT 첫 번째 릴리즈입니다.
  RPG 게임처럼 현실을 레벨업하세요!
  ```
- **검토 제출** 클릭
- 검토 기간: 보통 1~7일 소요

---

## 추가 설정 (선택)

- [ ] 인앱 제품/구독 설정 (현재 없음)
- [ ] Google Play 게임 서비스 연동 (선택)
- [ ] Play Asset Delivery 설정 (선택)
- [ ] Pre-registration 캠페인 (선택)

---

## 중요 URL 목록

- 개인정보 처리방침: 앱 내 내장 또는 별도 URL 필요
  - 예시: `https://your-domain.com/privacy.html`
- 고객지원 이메일: 등록 필요
