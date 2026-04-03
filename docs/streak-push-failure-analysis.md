# 스트릭 푸시 알림 반복 실패 분석 및 수정

## 1. 문제 현상

Push Notification Admin 대시보드에서 `streak_broken` 타입의 푸시 알림이 **동일 사용자에 대해 매일 반복 실패**하는 현상이 발생.

| 날짜 | 타입 | 에러 | 사용자 |
|------|------|------|--------|
| 2026.4.3 | streak_broken | messaging/registration-token-not-registered | 론라이트, 상건니2 |
| 2026.4.3 | streak_broken | messaging/registration-token-not-registered | 천원루, 인트로덕션, 사월의 |
| 2026.4.2 | streak_broken | messaging/registration-token-not-registered | 천원루 |
| 2026.4.1 | streak_broken | messaging/registration-token-not-registered | 론라이트, 인트로덕션, 사월의 |
| 2026.3.28 | streak_broken | messaging/registration-token-not-registered | (토큰 c0-XKk...) |

- **에러 코드**: `messaging/registration-token-not-registered` — FCM 토큰이 더 이상 유효하지 않음 (앱 삭제, 재설치, 토큰 만료 등)
- **핵심 문제**: 서버가 토큰을 정리해도 같은 사용자가 다음 날 또 실패함

---

## 2. 근본 원인 분석

### 원인 1 (핵심): 클라이언트가 서버의 토큰 정리를 덮어씀

**파일**: `app.js:2198`

```javascript
// 버그 코드
if(data.fcmToken) AppState.user.fcmToken = data.fcmToken;
```

서버가 `fcmToken: null`로 정리하면 Firestore에는 `null`이 저장되지만, 클라이언트에서 데이터를 로드할 때 `if(data.fcmToken)` 조건이 `null`을 falsy로 판단하여 **로컬의 stale 토큰을 그대로 유지**합니다. 이후 `saveUserData()` 호출 시 stale 토큰이 다시 Firestore에 기록되어 서버 정리가 무효화됩니다.

**흐름**:
```
21:00 서버: fcmToken → null, pushEnabled → false (정리 완료)
  ↓
사용자 앱 열기: loadUserDataFromDB() 실행
  ↓
if(data.fcmToken) → null은 falsy → 로컬 stale 토큰 유지
  ↓
saveUserData() → stale 토큰이 Firestore에 다시 기록
  ↓
다음 날 21:00: 같은 stale 토큰으로 발송 시도 → 또 실패
```

### 원인 2: 앱 시작 시 토큰 미갱신

**파일**: `app.js:10371` (`initPushNotifications`)

`pushEnabled`가 `true`일 때 메시지 리스너만 설정하고, FCM 토큰을 새로 요청하지 않습니다. 토큰이 만료되거나 무효화되어도 클라이언트는 이를 감지하지 못합니다.

### 원인 3: 배치 정리로 인한 Race Condition

**파일**: `functions/index.js:1628-1634`

실패한 토큰을 `invalidTokens[]` 배열에 모아 전체 발송 루프가 끝난 후 일괄 정리합니다. 이 사이에 클라이언트가 stale 토큰을 다시 기록할 수 있는 시간 창이 존재합니다.

---

## 3. 적용된 수정

### Fix 1: 서버 null 토큰 반영 (`app.js:2198`)

```javascript
// Before
if(data.fcmToken) AppState.user.fcmToken = data.fcmToken;

// After
if(data.fcmToken !== undefined) AppState.user.fcmToken = data.fcmToken || null;
```

서버가 `fcmToken: null`로 설정하면 클라이언트도 즉시 로컬 토큰을 `null`로 반영합니다.

### Fix 2: 앱 시작 시 토큰 갱신 (`app.js:10382`)

```javascript
if (AppState.user.pushEnabled) {
    try {
        let freshToken = isNative
            ? await requestNativePushPermission()
            : await requestWebPushPermission();

        if (freshToken) {
            if (freshToken !== AppState.user.fcmToken) {
                AppState.user.fcmToken = freshToken;
                saveUserData();
            }
            // 리스너 설정...
        } else {
            // 토큰 획득 실패 → 푸시 비활성화
            AppState.user.pushEnabled = false;
            AppState.user.fcmToken = null;
            pushToggle.checked = false;
            saveUserData();
        }
    } catch (e) { /* 로깅 */ }
}
```

앱 시작 시 FCM 토큰을 새로 요청하여 만료된 토큰을 자동으로 교체합니다. 토큰 획득 실패 시 푸시를 비활성화합니다.

### Fix 3: 즉시 토큰 정리 (`functions/index.js:1607`)

```javascript
// Before: 배치 수집 후 나중에 정리
invalidTokens.push(doc.id);
// ... 루프 종료 후 ...
for (const uid of invalidTokens) {
    await db.collection("users").doc(uid).update({ fcmToken: null, pushEnabled: false });
}

// After: 실패 즉시 정리
invalidTokenCount++;
await db.collection("users").doc(doc.id).update({
    fcmToken: null,
    pushEnabled: false
});
```

실패한 토큰을 발견 즉시 Firestore에서 정리하여 race condition 시간 창을 최소화합니다.

---

## 4. 수정 파일 목록

| 파일 | 변경 라인 | 내용 |
|------|-----------|------|
| `app.js` | 2198 | `fcmToken` null 반영 조건 수정 |
| `app.js` | 10382-10420 | `initPushNotifications`에 토큰 갱신 로직 추가 |
| `functions/index.js` | 1543, 1607-1634 | 배치 정리 → 즉시 정리 변경 |

---

## 5. 검증 방법

1. Firestore에서 테스트 유저의 `fcmToken`을 잘못된 값으로 수동 설정
2. `sendStreakWarnings` 실행 → 해당 유저의 `fcmToken`이 즉시 `null`로 변경 확인
3. 앱을 열어 `initPushNotifications`가 새 토큰을 발급받는지 확인
4. 서버에서 `fcmToken: null` 설정 후 앱 데이터 로드에서 로컬 토큰도 `null`이 되는지 확인
5. **배포 후 2-3일간** 대시보드에서 동일 사용자 반복 실패가 사라지는지 모니터링

---

## 6. 기존 방어 메커니즘 (유지)

| 메커니즘 | 파일 | 설명 |
|----------|------|------|
| 주간 토큰 정리 | `functions/index.js:1653` | 매주 일요일 03:00 KST, 30일+ 비활성 토큰 제거 |
| 푸시 비활성화 시 토큰 삭제 | `app.js:10404` | 유저가 토글 끌 때 `fcmToken: null` 저장 |
| FCM 헬스체크 | `functions/index.js:1358` | `ping` 함수로 FCM API 접근 테스트 |
| 발송 로그 기록 | `functions/index.js:1597` | 모든 성공/실패를 `push_logs` 컬렉션에 기록 |
