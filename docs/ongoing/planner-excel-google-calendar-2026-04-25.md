# 플래너 Excel 업로드/다운로드 + Google Calendar 연동 기능 기획

- 작성일: 2026-04-25
- 브랜치: `claude/planner-excel-google-calendar-I9HOK`
- 문서 성격: 기능 요구사항/설계 초안 (ongoing, 구현 보류)

---

## 1) 기능 목표

사용자가 플래너에서 작성한 **우선순위 태스크**와 **타임박스 시간표**를 외부 도구와 연동할 수 있도록 두 가지 기능을 추가한다.

1. **Excel 내보내기/가져오기**: 플래너 전체 데이터를 `.xlsx` 형식으로 백업하거나, 대량 편집 후 다시 가져올 수 있어야 한다.
2. **Google Calendar 동기화**: 선택된 날짜의 타임박스 시간표를 Google Calendar 이벤트로 직접 전송할 수 있어야 한다.

---

## 2) 앱 아키텍처 현황

### 프레임워크 및 스택
- **Frontend**: 순수 Vanilla JS (ES6 모듈) + Firebase SDK 10.8.1
- **Backend**: Firebase Cloud Functions (Node.js 20), Firestore, Storage
- **Mobile**: Capacitor 6.2.0 기반 Android 앱 + PWA 동시 지원
- **인증**: Firebase Auth (Google OAuth) + `@codetrix-studio/capacitor-google-auth` v3.4.0

### 플래너 데이터 구조

플래너 데이터는 `localStorage['diary_entries']`에 JSON으로 저장되고 Firestore `users/{uid}.diaryStr`에 동기화된다.

```javascript
{
  "2026-04-25": {
    text: "[09:00] 아침 루틴 | [14:00] 미팅",   // 타임박스 요약 (Firestore 검색용)
    mood: "great",          // great / good / neutral / bad / terrible
    category: "기타",
    timestamp: 1745510400000,
    blocks: {               // 타임박스 슬롯 (30분 단위)
      "09:00": "아침 루틴",
      "09:30": "운동",
      "14:00": "미팅"
    },
    tasks: [                // 우선순위 태스크
      { text: "운동", ranked: true, rankOrder: 1, done: true },
      { text: "독서", ranked: true, rankOrder: 2, done: false, diyQuestId: "quest-abc" }
    ],
    priorities: ["운동", "독서"],   // 하위 호환용 배열
    brainDump: "",
    photo: "https://firebasestorage.../planner_photos/...",
    caption: "오늘도 파이팅!"
  }
}
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `www/app.html` | 플래너 UI (line 889~1051), CSP 메타 태그 (line 9) |
| `www/app.js` | 플래너 저장/로드 로직 (~9,000줄), `getDiaryEntry()` (line 5313), `getAllDiaryEntries()` (line 5320) |
| `www/modules/domains/planner.js` | 플래너 도메인 모듈 (378줄) |
| `www/data.js` | i18n 번역 키 (ko/en/ja) |
| `www/style.css` | 플래너 UI 스타일, `.btn-info-sm` (line 472) |

### CSP 현황 (app.html line 9)

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
  https://*.gstatic.com https://*.googleapis.com
  https://apis.google.com https://www.google.com
  https://www.googletagmanager.com https://unpkg.com
```

- `unpkg.com` 이미 허용 → SheetJS 별도 CSP 변경 불필요
- `accounts.google.com` 미포함 → GIS 스크립트 로드를 위해 추가 필요

---

## 3) Feature 1: Excel 내보내기/가져오기

### 라이브러리

- **SheetJS (xlsx)** — 클라이언트 사이드 Excel 처리의 표준 라이브러리
- CDN: `https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js`
- 초기 페이지 로딩 지연 방지를 위해 **첫 사용 시 동적 로드** (lazy load)

### Excel 파일 형식

#### 헤더 (1행)

| A: Date | B: Mood | C: Category | D: Caption | E: Tasks | F: Schedule |
|---------|---------|-------------|-----------|----------|-------------|

#### 데이터 예시 (날짜 오름차순 정렬)

| Date | Mood | Category | Caption | Tasks | Schedule |
|------|------|----------|---------|-------|----------|
| 2026-04-25 | great | 기타 | 오늘도 파이팅! | `1. 운동 ✓`<br>`2. 독서` | `09:00: 아침 루틴`<br>`09:30: 운동` |

- **Tasks 형식**: `"N. {태스크명}[ ✓]"` (줄바꿈으로 구분, 완료시 ✓ 표시)
- **Schedule 형식**: `"HH:MM: {할일명}"` (줄바꿈으로 구분)
- 열 너비: Date=12, Mood=10, Category=12, Caption=30, Tasks=35, Schedule=40

### 내보내기 로직 설계

```
1. getAllDiaryEntries() → 전체 일기 항목 로드
2. 데이터 없으면 경고 메시지 후 종료
3. SheetJS 동적 로드 (미로드 시)
4. 날짜 오름차순 정렬
5. 각 항목 → 행 변환
   - tasks: rankOrder 정렬 → "N. text [✓]" 포맷
   - blocks: 시간 정렬 → "HH:MM: task" 포맷
6. XLSX.utils.aoa_to_sheet() → 워크시트 생성
7. 열 너비 설정 (ws['!cols'])
8. XLSX.writeFile() → "levelup_planner_YYYY-MM-DD.xlsx" 다운로드
```

### 가져오기 로직 설계

```
1. 파일 선택 input (accept=".xlsx,.xls") 클릭
2. FileReader.readAsArrayBuffer() → 파일 읽기
3. XLSX.read() → 워크북 파싱
4. 첫 번째 시트 → XLSX.utils.sheet_to_json({ header: 1 })
5. 헤더 행 소문자 변환 → 열 인덱스 감지 (findIndex 방식)
   - 열 순서 유연하게 처리 (수동 편집된 파일 대응)
6. 데이터 행 순회:
   - Date 정규식 검증 (/^\d{4}-\d{2}-\d{2}$/) → 실패시 행 스킵
   - Tasks 파싱: 줄바꿈 분리 → "N. text [✓]" 패턴 매칭
   - Schedule 파싱: 줄바꿈 분리 → "HH:MM: task" 패턴 매칭
7. 기존 localStorage 데이터와 병합 (photo, timestamp 등 보존)
   - tasks, blocks가 비어있으면 기존 데이터 유지
8. localStorage['diary_entries'] 업데이트
9. renderPlannerCalendar() + loadPlannerForDate() 호출 → UI 갱신
10. 가져온 항목 수 알림
```

### UI 배치

**플래너 헤더 (app.html line ~890)** — 기존 가이드 버튼 옆에 추가:

```
[🗓️ 플래너] [ℹ️ 가이드] [📊 내보내기] [📥 가져오기] [📅 캘린더]   2026 Apr
```

- 기존 `.btn-info-sm` 클래스 재사용 (네온 블루 테두리, 소형 폰트)
- 파일 input: `<input type="file" id="plannerExcelUpload" accept=".xlsx,.xls" class="d-none">`
- Excel 가져오기 버튼 클릭 → 숨겨진 파일 input 클릭 위임

---

## 4) Feature 2: Google Calendar 연동

### 접근 방식

| 방식 | 장점 | 단점 |
|------|------|------|
| **GIS (Google Identity Services) OAuth2 팝업** | 최신 표준, 로그인과 별도 권한 요청 | CSP 업데이트 필요, 팝업 차단 이슈 가능 |
| ICS 파일 내보내기 | OAuth 불필요, 범용 | 진정한 "연동"이 아님, 수동 가져오기 필요 |
| Google Calendar URL | 구현 간단 | 한 번에 1개 이벤트, 탭 여러 개 열림 |

**채택**: GIS OAuth2 팝업 + Google Calendar REST API 직접 호출

이유: 타임박스의 여러 슬롯을 한 번에 동기화하는 진정한 연동 기능을 제공하며, 로그인 시점에 Calendar 권한을 요청하지 않아도 된다.

### 플랫폼별 처리

#### Web (PWA/브라우저)
```
1. GIS 스크립트 동적 로드: https://accounts.google.com/gsi/client
2. google.accounts.oauth2.initTokenClient({
     client_id: 'GOOGLE_WEB_CLIENT_ID_PLACEHOLDER',
     scope: 'https://www.googleapis.com/auth/calendar.events',
     callback: (response) => { /* access_token 획득 */ }
   })
3. client.requestToken() → 팝업 OAuth 동의 화면
4. access_token을 메모리(변수)에만 보관 (expires_in 후 자동 만료)
```

#### Native (Capacitor Android)
```
1. window.Capacitor.Plugins.GoogleAuth.initialize({
     clientId: 'GOOGLE_WEB_CLIENT_ID_PLACEHOLDER',
     scopes: ['https://www.googleapis.com/auth/calendar.events'],
     grantOfflineAccess: false
   })
2. GoogleAuth.signIn() → googleUser.authentication.accessToken
3. 동일한 access_token으로 Calendar REST API 호출
```

> **주의**: Native에서 Calendar 스코프로 별도 `signIn()` 호출 시 기존 Firebase 로그인 세션에 영향이 없는지 확인 필요. `grantOfflineAccess: false`로 refresh_token은 요청하지 않음.

### 이벤트 생성 로직

타임박스 슬롯 1개 = Google Calendar 이벤트 1개 (30분 단위)

```
입력: dateStr="2026-04-25", time="09:00", taskName="아침 루틴"

→ start: "2026-04-25T09:00:00+09:00"  (로컬 타임존 자동 감지)
   end:   "2026-04-25T09:30:00+09:00"
   summary: "아침 루틴"
   description: "LevelUp 플래너 | 2026-04-25"

→ POST https://www.googleapis.com/calendar/v3/calendars/primary/events
   Authorization: Bearer {access_token}
```

타임존 계산:
- `Intl.DateTimeFormat().resolvedOptions().timeZone` → IANA 타임존명
- `new Date().getTimezoneOffset()` → UTC 오프셋 계산

### CSP 변경 사항

`app.html` line 9의 `script-src`에 `https://accounts.google.com` 추가:

```
script-src ... https://unpkg.com https://accounts.google.com
```

`connect-src`는 기존 `https:` 와일드카드가 있어 별도 변경 불필요.

### Google Cloud 선행 조건

구현 전 아래 설정이 완료되어야 한다:

1. Google Cloud Console → **Google Calendar API** 활성화
2. OAuth 2.0 클라이언트 (기존 Firebase 인증용) → **승인된 범위**에 `https://www.googleapis.com/auth/calendar.events` 추가
3. `GOOGLE_WEB_CLIENT_ID_PLACEHOLDER` → 배포 시 실제 client ID로 대체 (기존 메커니즘 동일)

---

## 5) 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `www/app.html` | CSP line 9 업데이트, 버튼 3개 + 파일 input 추가 (line ~893) |
| `www/data.js` | i18n 키 14개 추가 (ko/en/ja 각각) |
| `www/app.js` | Excel 함수 3개 + GCal 함수 4개 추가, 이벤트 리스너 4개 추가 |
| `www/style.css` | 별도 신규 스타일 불필요 (`.btn-info-sm` 재사용) |

---

## 6) i18n 키 목록

| 키 | 한국어 (ko) | 영어 (en) | 일본어 (ja) |
|----|------------|-----------|------------|
| `btn_excel_export` | 📊 내보내기 | 📊 Export | 📊 エクスポート |
| `btn_excel_import` | 📥 가져오기 | 📥 Import | 📥 インポート |
| `btn_gcal_sync` | 📅 캘린더 동기화 | 📅 Sync Calendar | 📅 カレンダー同期 |
| `excel_no_data` | 내보낼 플래너 데이터가 없습니다. | No planner data to export. | エクスポートするデータがありません。 |
| `excel_lib_loading` | Excel 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요. | Excel library loading. Please try again. | Excelライブラリ読み込み中です。 |
| `excel_import_done` | 플래너 데이터를 가져왔습니다. ({count}일) | Planner data imported. ({count} days) | プランナーデータをインポートしました。({count}日) |
| `excel_import_error` | Excel 파일을 읽을 수 없습니다. 형식을 확인하세요. | Could not read the Excel file. Check the format. | Excelファイルを読み込めません。フォーマットを確認してください。 |
| `excel_import_empty` | 유효한 데이터가 없습니다. | No valid data found. | 有効なデータが見つかりません。 |
| `gcal_no_blocks` | 동기화할 시간표가 없습니다. 먼저 시간표를 작성해주세요. | No schedule to sync. Add schedule first. | 同期するスケジュールがありません。先に予定を追加してください。 |
| `gcal_syncing` | Google Calendar 동기화 중... | Syncing to Google Calendar... | Googleカレンダーに同期中... |
| `gcal_done` | Google Calendar에 {count}개 일정이 추가되었습니다! | {count} event(s) added to Google Calendar! | Googleカレンダーに{count}件の予定が追加されました！ |
| `gcal_denied` | Google Calendar 권한이 거부되었습니다. | Google Calendar permission was denied. | Googleカレンダーの権限が拒否されました。 |
| `gcal_error` | Google Calendar 동기화에 실패했습니다: {msg} | Google Calendar sync failed: {msg} | Googleカレンダー同期に失敗しました: {msg} |
| `gcal_scope_required` | Google Calendar 접근 권한이 필요합니다. | Google Calendar access permission required. | Googleカレンダーのアクセス権限が必要です。 |

---

## 7) 구현 시 주요 고려사항

### Excel
- SheetJS lazy load: `_xlsxLoaded` 플래그 + script 태그 id 체크로 중복 로드 방지
- 가져오기 열 감지: `header.findIndex()` 소문자 비교로 수동 편집된 파일도 대응
- 가져오기 병합: `photo`, `timestamp` 등 기존 필드는 보존, 빈 tasks/blocks는 기존 데이터 유지
- 미래 날짜 데이터 가져오기: 허용 (타임박스 프리셋 등 미래 계획 용도)

### Google Calendar
- access_token 만료: `setTimeout(() => { _gcalToken = null; }, expires_in * 1000)` 자동 초기화
- 401 응답 시: `_gcalToken = null` 후 사용자에게 재시도 안내
- 팝업 차단: `error_callback` 처리 후 친화적 메시지 표시
- 다중 슬롯 동기화: 순서대로 직렬 처리 (병렬 시 Rate Limit 가능성)
- 현재 DOM의 미저장 편집도 반영: `#planner-timebox-grid .timebox-slot` 직접 읽기

---

## 8) 검증 시나리오

### Excel 내보내기
1. 플래너에 여러 날짜 데이터 입력 → 📊 버튼 클릭
2. `.xlsx` 파일 다운로드 확인
3. Excel에서 파일 열어 날짜/태스크/시간표 형식 확인
4. 데이터 없을 때 경고 메시지 확인

### Excel 가져오기
1. 내보낸 파일에서 일부 데이터 수정 (새 날짜 행 추가 포함)
2. 📥 버튼 → 파일 선택
3. 플래너 UI에 수정된 데이터 반영 확인
4. 기존 사진/타임스탬프 보존 확인
5. 잘못된 형식 파일 가져오기 시 오류 메시지 확인

### Google Calendar 동기화
1. 타임박스에 일정 입력 → 📅 버튼 클릭
2. Google OAuth 동의 팝업 확인
3. Google Calendar에 이벤트 생성 확인 (30분 단위, 로컬 타임존)
4. 타임박스 비어있을 때 안내 메시지 확인
5. OAuth 거부 시 친화적 메시지 확인
6. 다국어 전환 후 버튼/메시지 언어 확인
