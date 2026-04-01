# AdMob 광고 전략 및 구현 가이드

> **앱:** LEVEL UP: REBOOT (com.levelup.reboot)
> **플랫폼:** Android (Capacitor 6.2)
> **광고 SDK:** Google AdMob
> **퍼블리셔 ID:** pub-6654057059754695
> **작성일:** 2026-03-24
> **최종 업데이트:** 2026-04-01 (배너→네이티브 전환: 플래너/던전 탭)

---

## 1. 광고 전략 개요

### 1.1 목표

| 항목 | 목표 |
|------|------|
| **주 수익원** | AdMob 광고 (배너 + 보상형 + 네이티브) + 광고 없는 구독제 (LEVEL UP PASS) |
| **유저 경험** | 게임 몰입감을 해치지 않는 자연스러운 광고 노출 |
| **ARPMAU 목표** | 900원/월 (기준 시나리오) |
| **BEP 도달** | MAU 2,800+ 시 월 흑자 전환 |

### 1.2 광고 유형별 전략

| 광고 유형 | 역할 | 수익 비중 (목표) | 노출 빈도 |
|-----------|------|------------------|-----------|
| **적응형 배너 (Adaptive Banner)** | ~~미사용~~ (네이티브로 전환) | — | ~~던전 탭 진입 시 하단 상시 노출~~ → 네이티브로 대체 |
| **보상형 비디오 (Rewarded Video)** | 주요 수익원 + 유저 주도 | 40~45% | 일일보너스·스트릭 복구·추가 레이드·Day1 하이라이트 (최대 4회/일) |
| **보상형 전면 (Rewarded Interstitial)** | 핵심 전환점 + 높은 eCPM | 15~20% | 스핀/던전 클리어 후 유저 선택 (스핀 1회 + 던전 2회/일) |
| **네이티브 고급형 (Native Advanced)** | 피드 내 자연스러운 광고 + 플래너/던전 상단 | 30~40% | 소셜탭 랭킹 5번째 + Day1탭 피드 3번째 + **플래너탭 상단** + **던전탭 상단** |

---

## 2. 광고 배치 전략

### 2.1 앱 탭 구조 및 광고 배치

```
┌──────────────────────────────┐
│  [네이티브 광고 (플래너/던전)] │  ← 상단 고정, 스크롤 시 자연스럽게 가려짐
│  앱 콘텐츠 영역               │
│  (상태창/플래너/퀘스트/...    │
│   던전/Day1/소셜)             │
│  [네이티브 광고 (소셜/Day1)]  │  ← 피드 내 인라인 삽입
│                              │
├──────────────────────────────┤
│  👤  🗓️  📜  ⚔️  🎬  🏆      │  ← 하단 네비게이션
└──────────────────────────────┘
```

> **배너 광고(Adaptive Banner)는 더 이상 사용하지 않습니다.** 플래너/던전 탭에서 네이티브 고급형으로 전환 완료.

### 2.2 배너 광고 (Banner Ad) — ❌ 미사용 (네이티브로 전환)

> **2026-04-01 업데이트:** 배너 광고는 플래너/던전 탭에서 **네이티브 고급형 광고**로 전환되어 더 이상 사용하지 않습니다.
> `showBannerAd()` / `hideBannerAd()` 함수는 코드에 잔존하나 호출되지 않습니다.

| 항목 | 설정 |
|------|------|
| **상태** | ❌ 미사용 (네이티브로 대체) |
| **사이즈** | ~~Adaptive Banner~~ |
| **이전 노출 페이지** | ~~던전, 플래너~~ → 네이티브 광고로 전환 |

### 2.3 전면 광고 (Interstitial Ad)

자연스러운 **전환점(transition point)**에서만 노출하여 유저 이탈을 최소화합니다.

| 노출 시점 | 이유 | 빈도 제한 |
|-----------|------|-----------|
| **탭 전환 시 (3회마다 1회)** | 자연스러운 화면 전환 시점 | 5분 간격, 세션당 최대 3회 |
| **퀘스트 완료 후** | 달성감 이후 자연스러운 전환 | 1일 2회 제한 |
| **던전 레이드 결과 확인 후** | 결과 확인 → 광고 → 메인으로 복귀 | 레이드당 최대 1회 |
| **앱 포그라운드 복귀 시** | 세션 재시작 시점 | 30분 이상 백그라운드 후에만 |

**전면 광고 프리로드:**
- 앱 시작 시 1개 프리로드
- 노출 후 즉시 다음 광고 프리로드
- 로드 실패 시 30초 후 재시도 (최대 3회)

### 2.4 보상형 광고 (Rewarded Ad)

유저가 **자발적으로 시청**하며, 게임 내 보상을 제공합니다.

| 보상 시나리오 | 보상 내용 | 위치 |
|--------------|----------|------|
| **일일 보너스 EXP** | EXP +50 (일반 퀘스트의 ~50%) | 상태창 > "보너스 EXP 받기" 버튼 |
| **스트릭 복구** | 끊어진 연속 출석 1회 복구 | 스트릭 경고 팝업 > "광고 보고 복구" |
| **레이드 추가 참여** | 일일 레이드 1회 추가 | 던전 탭 > "추가 레이드" 버튼 |
| **Day1 릴스 하이라이트** | 릴스 상단 고정 24시간 | Day1 탭 > "하이라이트 등록" |

**보상형 광고 정책:**
- 각 보상 유형별 일일 1회 제한 (총 최대 4회/일)
- 광고 시청 완료 후에만 보상 지급 (30초 미만 이탈 시 보상 없음)
- 보상 지급은 서버(Cloud Functions)에서 검증

### 2.5 보상형 전면 광고 (Rewarded Interstitial Ad) — 스핀/던전

유저가 핵심 콘텐츠를 완료한 직후 **선택적으로** 광고를 시청하면 추가 보상을 제공합니다.
일반 전면 광고와 달리 시청 완료 시 보상을 지급하여 유저 수용도가 높습니다.

| 노출 시점 | 보상 내용 | 빈도 제한 |
|-----------|----------|-----------|
| **일일 스핀(룰렛) 완료 후** | 스핀 보상 2배 (동일 보상 1회 추가 지급) | 일 1회 (스핀 자체가 일 1회) |
| **던전 클리어 후** | 추가 보상 (기본의 50%): 100P × 배율 + 스탯 1.0 × 배율 | 일 최대 2회 |

**보상형 전면 광고 정책:**
- 유저 자발적 시청 (confirm 다이얼로그로 선택)
- 광고 시청 완료 후에만 보상 지급 (중도 이탈 시 보상 없음)
- 던전 일일 최대 2회 제한 (`RI_DUNGEON_DAILY_MAX`)
- 광고 미로드 시 또는 비네이티브 환경에서는 프롬프트 미표시

**Ad Unit ID:** `ca-app-pub-6654057059754695/6916027284`

**구현 파일:**

| 파일 | 작업 |
|------|------|
| `app.js` | 수정 — `spinRoulette()` 완료 후 + `completeDungeon()` 완료 후 confirm → 광고 표시 |
| `data.js` | 수정 — i18n 문자열 추가 (ko/en/ja) |

**프리로드:**
- `initAdMob()` 시 1개 프리로드
- 노출 후 즉시 다음 광고 프리로드
- 로드 실패 시 30초 후 재시도 (최대 3회)

---

### 2.6 네이티브 광고 고급형 (Native Advanced Ad) — 소셜탭 + Day1탭 + 플래너탭 + 던전탭

4개 탭에서 **네이티브 고급형 광고**를 표시합니다.
- **소셜/Day1:** 피드 내 인라인 삽입 (기존)
- **플래너/던전:** 콘텐츠 최상단에 배치, 스크롤 시 자연스럽게 위로 밀려나 가려짐 (배너 대체)

| 항목 | 소셜탭 | Day1탭 | 플래너탭 | 던전탭 |
|------|--------|--------|---------|--------|
| **Ad Unit ID** | `ca-app-pub-6654057059754695/8612252339` | 동일 | 동일 | 동일 |
| **테스트 Ad Unit ID** | `ca-app-pub-3940256099942544/2247696110` | 동일 | 동일 | 동일 |
| **삽입 위치** | 랭킹 5번째 유저 카드 뒤 | 피드 3번째 포스트 뒤 | 콘텐츠 최상단 | 콘텐츠 최상단 |
| **노출 조건** | 소셜탭 활성 + 유저 5명+ | Day1탭 활성 + 포스트 3개+ | 플래너탭 활성 | 던전탭 활성 |
| **Sticky Header 클리핑** | `.social-sticky-header` 기준 | 앱 `<header>` 기준 | 앱 `<header>` 기준 | 앱 `<header>` 기준 |
| **스크롤 동작** | 인라인 (콘텐츠와 함께 스크롤) | 인라인 | 상단 고정 → 스크롤 시 가려짐 | 상단 고정 → 스크롤 시 가려짐 |
| **렌더링 방식** | 커스텀 Capacitor 플러그인 (NativeAdPlugin) + Native Android 오버레이 | 동일 | 동일 | 동일 |

> **동시 노출 불가:** NativeAdPlugin은 1개의 오버레이만 지원하므로, 탭 전환 시 기존 광고를 파괴하고 새 탭에서 재로드합니다.

**아키텍처 (탭 공용):**

```
WebView (app.js)                    Native Android Layer
════════════════                    ════════════════════
소셜/Day1: renderUsers() 또는       NativeAdPlugin.java
  renderReelsCards()에서               → AdLoader로 NativeAd 로드
  placeholder <div> 삽입               → NativeAdView 생성 (정책 준수)
  (소셜: 5번째 유저 / Day1: 3번째      → Activity root에 오버레이
   포스트 뒤)
플래너/던전: HTML에 정적              
  placeholder <div> 배치              
  (콘텐츠 최상단, 스크롤 시 가려짐)   

scroll 이벤트 →
  requestAnimationFrame 스로틀        → NativeAdView Y좌표 동기화
  IntersectionObserver               → 화면 밖 시 hide, 복귀 시 show

탭 전환 → cleanupNativeAd()          → 오버레이 제거 및 리소스 해제
(_nativeAdActiveTab 추적)            (social/reels/dungeon/diary 이탈 시 자동 정리)
```

**네이티브 광고 구성 요소:**
- 광고 아이콘 (30×30dp, 라운드) — 유저 프로필 사진과 동일 크기
- Headline 텍스트 — 유저 이름 위치에 표시
- Body 텍스트 — 부가 설명
- MediaView — 미디어 콘텐츠 (비율 제한)
- CTA 버튼 — neon-blue 스타일
- "광고" 라벨 뱃지 — 우상단

**기술적 이유 — 커스텀 플러그인 필요:**
- `@capacitor-community/admob` 플러그인은 네이티브 광고를 지원하지 않음 (배너/전면/보상형만)
- AdMob 정책상 네이티브 광고는 반드시 `NativeAdView`로 렌더링해야 노출/클릭 추적 정상 작동
- 기존 `native-plugins/` 디렉토리에 `GoogleFitPlugin.java`, `AppSettingsPlugin.java` 등 커스텀 플러그인 패턴 활용

**구현 파일:**

| 파일 | 작업 |
|------|------|
| `native-plugins/NativeAdPlugin.java` | 신규 — 네이티브 광고 로드/표시/위치동기화/정리 플러그인 |
| `www/app.js` | 수정 — renderUsers()+renderReelsCards()에 placeholder 삽입, 탭 공용 광고 컨트롤러 함수(`loadAndShowNativeAd(tabId)` 등), switchTab() 탭 전환 정리. 플래너/던전 탭도 네이티브 광고 로드 |
| `www/app.html` | 수정 — 플래너/던전 섹션에 `native-ad-placeholder-diary` / `native-ad-placeholder-dungeon` 정적 placeholder 추가 |
| `www/style.css` | 수정 — `.native-ad-slot` 스타일 추가 |
| `MainActivity.java` | 수정 — `registerPlugin(NativeAdPlugin.class)` 등록 |

---

## 3. 빈도 제한 (Frequency Capping)

과도한 광고 노출은 유저 이탈의 주요 원인입니다. 아래 제한을 엄격히 적용합니다.

### 3.1 전체 제한

| 규칙 | 제한 |
|------|------|
| **전면 광고 간 최소 간격** | 5분 |
| **전면 광고 세션당 최대** | 3회 |
| **전면 광고 일일 최대** | 8회 |
| **보상형 광고 일일 최대** | 4회 (보상별 1회) |
| **앱 복귀 시 전면 광고** | 백그라운드 30분 이상일 때만 |
| **신규 유저 광고 유예** | 최초 3세션 동안 전면 광고 없음 |

### 3.2 신규 유저 온보딩 보호

| 단계 | 광고 정책 |
|------|-----------|
| **1~3세션** | 배너만 노출, 전면/보상형 없음 |
| **4~7세션** | 배너 + 보상형 허용, 전면 없음 |
| **8세션 이후** | 전체 광고 유형 활성화 |

---

## 4. 기술 구현 가이드

### 4.1 필수 패키지

```bash
# Capacitor AdMob 플러그인
npm install @capacitor-community/admob

# Capacitor 동기화
npx cap sync android
```

### 4.2 Android 설정

**`android/app/build.gradle`에 추가:**
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-ads:23.6.0'
}
```

**`android/app/src/main/AndroidManifest.xml`에 추가:**
```xml
<manifest>
    <application>
        <!-- AdMob App ID -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-6654057059754695~XXXXXXXXXX"/>

        <!-- 선택: COPPA 대응 (13세 미만 타겟팅 시) -->
        <!-- <meta-data android:name="com.google.android.gms.ads.flag.NATIVE_AD_DEBUGGER" android:value="true"/> -->
    </application>
</manifest>
```

### 4.3 AdMob 초기화 코드

```javascript
import { AdMob, BannerAdSize, BannerAdPosition, AdmobConsentStatus } from '@capacitor-community/admob';

// 앱 시작 시 초기화
async function initializeAdMob() {
    await AdMob.initialize({
        initializeForTesting: false, // 프로덕션: false
        testingDevices: ['DEVICE_ID_HERE'], // 개발 시에만
    });

    // GDPR/동의 상태 확인 (유럽 유저 대응)
    const consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
    }
}
```

### 4.4 배너 광고 구현

```javascript
const AD_UNITS = {
    banner: 'ca-app-pub-6654057059754695/2995161826',
    interstitial: 'ca-app-pub-6654057059754695/INTERSTITIAL_ID',
    rewarded: 'ca-app-pub-6654057059754695/REWARDED_ID',
};

// 배너 비노출 탭 목록
const BANNER_HIDDEN_TABS = ['quests', 'reels'];

async function showBannerAd() {
    await AdMob.showBanner({
        adId: AD_UNITS.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 56, // 하단 네비게이션 높이(px)
    });
}

async function hideBannerAd() {
    await AdMob.hideBanner();
}

// 탭 전환 시 배너 표시/숨김
function onTabChange(tabName) {
    if (BANNER_HIDDEN_TABS.includes(tabName)) {
        hideBannerAd();
    } else {
        showBannerAd();
    }
}
```

### 4.5 전면 광고 구현

```javascript
let lastInterstitialTime = 0;
let sessionInterstitialCount = 0;
let tabSwitchCount = 0;
const INTERSTITIAL_MIN_INTERVAL = 5 * 60 * 1000; // 5분
const MAX_SESSION_INTERSTITIALS = 3;

async function preloadInterstitial() {
    await AdMob.prepareInterstitial({
        adId: AD_UNITS.interstitial,
    });
}

async function showInterstitialIfAllowed(trigger) {
    const now = Date.now();
    if (now - lastInterstitialTime < INTERSTITIAL_MIN_INTERVAL) return false;
    if (sessionInterstitialCount >= MAX_SESSION_INTERSTITIALS) return false;

    // 신규 유저 보호 (8세션 미만)
    if (getUserSessionCount() < 8) return false;

    try {
        await AdMob.showInterstitial();
        lastInterstitialTime = now;
        sessionInterstitialCount++;
        preloadInterstitial(); // 다음 광고 프리로드
        return true;
    } catch (e) {
        console.warn('Interstitial not ready:', e);
        preloadInterstitial();
        return false;
    }
}

// 탭 전환 시 3회마다 1회 전면 광고
function onTabSwitch(newTab) {
    tabSwitchCount++;
    if (tabSwitchCount % 3 === 0) {
        showInterstitialIfAllowed('tab_switch');
    }
}
```

### 4.6 보상형 광고 구현

```javascript
const dailyRewardCounts = {
    bonus_exp: 0,
    streak_recovery: 0,
    extra_raid: 0,
    highlight: 0,
};

async function showRewardedAd(rewardType) {
    if (dailyRewardCounts[rewardType] >= 1) {
        showToast('오늘은 이미 이 보상을 받았습니다.');
        return null;
    }

    // 보상형 광고 4세션 이후 허용
    if (getUserSessionCount() < 4) return null;

    await AdMob.prepareRewardItem({
        adId: AD_UNITS.rewarded,
    });

    const result = await AdMob.showRewardItem();

    if (result && result.type === 'rewarded') {
        dailyRewardCounts[rewardType]++;
        return applyReward(rewardType);
    }
    return null;
}

function applyReward(type) {
    switch (type) {
        case 'bonus_exp':
            addExp(50);
            return { message: 'EXP +50 획득!' };
        case 'streak_recovery':
            recoverStreak();
            return { message: '스트릭이 복구되었습니다!' };
        case 'extra_raid':
            grantExtraRaid();
            return { message: '추가 레이드 참여권 획득!' };
        case 'highlight':
            highlightReel();
            return { message: '릴스가 24시간 하이라이트됩니다!' };
    }
}
```

### 4.7 네이티브 광고 고급형 구현 (커스텀 Capacitor 플러그인)

`@capacitor-community/admob`은 네이티브 광고를 지원하지 않으므로 커스텀 Capacitor 플러그인으로 구현합니다.

**Step 1: NativeAdPlugin.java (Android 커스텀 플러그인)**

```java
// native-plugins/NativeAdPlugin.java
@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {
    // 주요 메서드:
    // loadAd(adId, isTesting) → AdLoader로 NativeAd 로드
    // showAd(x, y, width, height) → NativeAdView를 Activity root에 오버레이
    // updatePosition(y) → 스크롤 시 Y좌표 업데이트
    // hideAd() → 오버레이 숨김
    // destroyAd() → 리소스 해제
}
```

**Step 2: WebView 측 (app.js)**

```javascript
// 광고 단위 ID
const NATIVE_AD_UNIT_ID = 'ca-app-pub-6654057059754695/8612252339';
const NATIVE_AD_TEST_ID = 'ca-app-pub-3940256099942544/2247696110';
const NATIVE_AD_POSITION = 5; // 소셜탭: 5번째 유저 카드 뒤
const REELS_NATIVE_AD_POSITION = 3; // Day1탭: 3번째 포스트 뒤

let _nativeAdActiveTab = null; // 'social' | 'reels' | 'dungeon' | 'diary' | null

// 소셜/Day1: renderUsers() / renderReelsCards() 내에서 탭별 placeholder 동적 삽입
//   소셜: id="native-ad-placeholder-social"
//   Day1: id="native-ad-placeholder-reels"
// 플래너/던전: app.html에 정적 placeholder 배치 (콘텐츠 최상단)
//   플래너: id="native-ad-placeholder-diary"
//   던전: id="native-ad-placeholder-dungeon"
// → loadAndShowNativeAd(tabId) 호출 (4개 탭 공용)
// → setupNativeAdScrollSync(tabId) 스크롤 동기화
// → switchTab() 시 _nativeAdActiveTab 기반 cleanupNativeAd() 정리
```

**Step 3: MainActivity 등록**

```java
import com.levelup.reboot.plugins.NativeAdPlugin;
// onCreate 내:
registerPlugin(NativeAdPlugin.class);
```

---

## 5. AdMob 광고 단위 ID 관리

### 5.1 필요한 광고 단위

| 광고 유형 | 용도 | Ad Unit ID | 상태 |
|-----------|------|------------|------|
| Adaptive Banner | ~~하단 배너 (던전 탭)~~ | `ca-app-pub-6654057059754695/2995161826` | ❌ 미사용 (네이티브로 전환) |
| Interstitial | 전면 광고 | 생성 필요 | ❌ 미생성 |
| Rewarded | 보상형 광고 | `ca-app-pub-6654057059754695/8552907541` | ✅ 구현 완료 |
| **Rewarded Interstitial** | **보상형 전면 광고 (스핀/던전)** | **`ca-app-pub-6654057059754695/6916027284`** | **✅ 구현 완료** |
| **Native Advanced** | **소셜탭 + Day1탭 인라인 + 플래너탭/던전탭 상단** | **`ca-app-pub-6654057059754695/8612252339`** | **✅ 구현 완료 (4개 탭)** |

### 5.2 테스트용 Ad Unit ID (개발 시 사용)

```javascript
const TEST_AD_UNITS = {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
    native: 'ca-app-pub-3940256099942544/2247696110',
};
```

> ⚠️ **프로덕션 빌드 시 반드시 실제 Ad Unit ID로 교체 필요**

---

## 6. 수익 최적화 전략

### 6.1 eCPM 최적화

| 전략 | 설명 | 예상 효과 |
|------|------|-----------|
| **AdMob 미디에이션** | 여러 광고 네트워크 경쟁 입찰 | eCPM +20~40% |
| **워터폴 방식** | 고단가 네트워크 → 저단가 순서로 요청 | Fill Rate 95%+ 유지 |
| **A/B 테스트** | 배너 위치/전면 빈도 테스트 | ARPMAU +10~20% |

### 6.2 추천 미디에이션 네트워크

| 네트워크 | 강점 | 우선순위 |
|----------|------|----------|
| **AdMob** (기본) | 높은 Fill Rate, 안정성 | 1순위 |
| **Meta Audience Network** | 높은 eCPM (소셜 앱 적합) | 2순위 |
| **Unity Ads** | 보상형 광고 특화, 게임 카테고리 강점 | 3순위 |
| **AppLovin MAX** | 미디에이션 통합 관리 | Phase 2 |

### 6.3 시즌별 eCPM 변동 대응

| 시기 | eCPM 변동 | 전략 |
|------|-----------|------|
| **1~2월** | -20~30% (연초 광고주 예산 축소) | 보상형 광고 비중 확대 |
| **3~5월** | 평균 수준 | 기본 전략 유지 |
| **6~8월** | +5~10% | 전면 광고 빈도 소폭 증가 가능 |
| **11~12월** | +30~50% (블프, 연말 시즌) | 전면 광고 적극 노출, eCPM 극대화 |

---

## 7. 개인정보 및 규정 준수

### 7.1 필수 대응 사항

| 규정 | 대응 | 상태 |
|------|------|------|
| **개인정보처리방침** | AdMob 데이터 수집 명시 | ✅ 완료 (privacy.html) |
| **이용약관** | 광고 표시 조항 포함 | ✅ 완료 (terms.html) |
| **ads.txt** | 퍼블리셔 ID 등록 | ✅ 완료 (ads.txt) |
| **GDPR (유럽)** | UMP SDK 동의 양식 | ✅ 완료 (initAdMob → requestConsentInfo + showConsentForm) |
| **COPPA (미국)** | 13세 미만 대상 여부 설정 | ✅ 완료 (tagForChildDirectedTreatment: false, 만 18세 이상 서비스) |
| **Google Play 광고 정책** | 광고 배치 가이드라인 준수 | ✅ 완료 (아래 7.2 체크리스트 검토 완료) |

### 7.2 Google Play 정책 체크리스트

- [x] 광고가 앱 콘텐츠를 가리지 않음 — 네이티브 광고: 콘텐츠 최상단 인라인 배치, 스크롤 시 자연스럽게 가려짐. 콘텐츠 영역 미침범
- [x] 실수로 광고를 클릭하기 어려운 배치 — 네이티브 광고 인라인 배치 (콘텐츠 흐름 내), 보상형/전면 광고는 사용자 버튼 클릭으로만 트리거
- [x] 전면 광고에 닫기 버튼 명확히 표시 — 강제 전면 광고 없음 (보상형만 사용), AdMob SDK 자체 닫기 버튼 제공
- [x] 보상형 광고 시청이 앱 핵심 기능 이용의 전제 조건이 아님 — 보너스 EXP/스핀 2배 등 추가 보상 전용
- [x] 아동 대상 콘텐츠에 맞춤 광고 미표시 (해당 시) — 만 18세 이상 서비스, COPPA tagForChildDirectedTreatment: false 설정

---

## 8. 구현 로드맵

### Phase 1: 기본 광고 (출시 시점)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| AdMob 계정에서 Ad Unit ID 3개 생성 | 🔴 높음 | 10분 |
| `@capacitor-community/admob` 플러그인 설치 | 🔴 높음 | 30분 |
| AndroidManifest.xml App ID 설정 | 🔴 높음 | 10분 |
| 하단 Adaptive Banner 구현 | 🔴 높음 | 2시간 |
| 전면 광고 (탭 전환 + 퀘스트 완료) 구현 | 🔴 높음 | 3시간 |
| 빈도 제한 로직 구현 | 🔴 높음 | 2시간 |
| 신규 유저 광고 유예 로직 | 🟡 중간 | 1시간 |
| 테스트 Ad Unit으로 QA | 🔴 높음 | 2시간 |

### Phase 2: 보상형 광고 + 최적화 (출시 후 1~2주)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| 보상형 광고 4종 구현 | 🟡 중간 | 4시간 |
| 보상 지급 서버 검증 (Cloud Functions) | 🟡 중간 | 3시간 |
| Remote Config로 광고 빈도 원격 조정 | 🟡 중간 | 2시간 |
| 광고 노출/클릭 Analytics 이벤트 추가 | 🟡 중간 | 1시간 |

### Phase 3: 미디에이션 + 수익 극대화 (출시 후 1~2개월)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| AdMob 미디에이션 설정 (Meta, Unity Ads) | 🟢 낮음 | 반일 |
| A/B 테스트 (배너 위치, 전면 빈도) | 🟢 낮음 | 반일 |
| eCPM 모니터링 대시보드 구축 | 🟢 낮음 | 반일 |

---

## 9. KPI 및 모니터링

### 9.1 핵심 지표

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| **ARPMAU** | ≥ 900원/월 | AdMob 수익 ÷ MAU |
| **광고 Fill Rate** | ≥ 95% | AdMob 대시보드 |
| **eCPM (배너)** | ≥ $0.5 | AdMob 대시보드 |
| **eCPM (전면)** | ≥ $3.0 | AdMob 대시보드 |
| **eCPM (보상형)** | ≥ $8.0 | AdMob 대시보드 |
| **Day-7 리텐션** | ≥ 25% (광고 적용 후 변화 없음) | Firebase Analytics |
| **광고 기인 이탈률** | < 5% | 광고 노출 후 세션 종료 비율 |

### 9.2 알림 기준

| 상황 | 조치 |
|------|------|
| Fill Rate < 90% | 미디에이션 네트워크 추가 검토 |
| Day-7 리텐션 3%p 이상 하락 | 전면 광고 빈도 즉시 축소 |
| eCPM 전월 대비 30% 이상 하락 | 광고 단위/배치 재검토 |

---

## 10. 예상 수익 시뮬레이션

> firebase-cost-estimation.md 및 손익추정 보고서 기반
> **현재 적용 광고 단위 기준** (2026-03-26 업데이트)

### 10.1 현재 적용 광고 단위

| 광고 유형 | 광고 단위 ID | 배치 위치 | 일일 노출 제한 |
|-----------|-------------|-----------|---------------|
| **~~적응형 배너~~** | `ca-app-pub-6654057059754695/2995161826` | ~~던전 탭 하단 고정~~ → **미사용** (네이티브로 전환) | — |
| **보상형 비디오** | `ca-app-pub-6654057059754695/8552907541` | 일일보너스 EXP, 스트릭 복구, 추가 레이드, Day1 하이라이트 | 최대 4회 (기능별 1회) |
| **보상형 전면** | `ca-app-pub-6654057059754695/6916027284` | 스핀/룰렛 완료 후 2배 보너스, 던전 클리어 추가 보상 | 스핀 1회 + 던전 2회 |
| **네이티브 고급형** | `ca-app-pub-6654057059754695/8612252339` | 소셜 탭 랭킹 5번째, Day1 탭 피드 3번째, **플래너 탭 상단**, **던전 탭 상단** | 탭당 1회 |

> ⚠️ **참고:** 일반 전면 광고(Interstitial)는 현재 미적용 상태. 보상형 전면이 전면 광고 역할을 대체.
> ⚠️ **2026-04-01 업데이트:** 적응형 배너 광고는 네이티브 고급형으로 전환되어 미사용. 네이티브 광고가 4개 탭(소셜/Day1/플래너/던전)에서 노출.

### 10.2 수익 시뮬레이션

| MAU | ~~배너~~ | 보상형 비디오 | 보상형 전면 | 네이티브 (4탭) | **월 총 수익** | Firebase 비용 | **순수익** |
|-----|------|--------------|------------|---------|----------------|---------------|------------|
| 1,000 | — | $3 | $1 | $2 | **~$6** | $0 | **+$6** |
| 5,000 | — | $16 | $7 | $14 | **~$37** | ~$2 | **+$35** |
| 10,000 | — | $36 | $17 | $30 | **~$83** | ~$6 | **+$77** |
| 30,000 | — | $116 | $55 | $94 | **~$265** | ~$20 | **+$245** |
| 50,000 | — | $200 | $95 | $150 | **~$445** | ~$35 | **+$410** |
| 100,000 | — | $400 | $195 | $320 | **~$915** | ~$65 | **+$850** |

### 10.3 시뮬레이션 가정

| 항목 | 값 | 비고 |
|------|---|------|
| **시장** | 한국 | |
| **DAU/MAU 비율** | 30% | |
| **~~배너 eCPM~~** | ~~$0.5~~ | ~~던전 탭 한정~~ → 미사용 (네이티브로 전환) |
| **보상형 비디오 eCPM** | $10.0 | 유저 주도형, 높은 완료율 |
| **보상형 전면 eCPM** | $6.0 | 스핀/던전 클리어 후 선택적 노출 |
| **네이티브 eCPM** | $1.5 | 4개 탭 (소셜/Day1/플래너/던전) 인라인 + 상단 노출 |
| **보상형 비디오 참여율** | DAU의 10~15% | 일일보너스·스트릭·레이드·하이라이트 합산 |
| **보상형 전면 수락율** | DAU의 ~15% | 2배 보너스 제안 시 수락 비율 |
| **네이티브 노출율** | DAU의 ~70% | 소셜/Day1/플래너/던전 탭 방문 유저 기준 (4탭 확장으로 상향) |

---

## 11. 광고 없는 구독제 도입 방안

> **목적:** 광고 피로감이 높은 핵심 유저에게 프리미엄 경험 제공 + 안정적 반복 수익 확보

### 11.1 구독 상품 설계

| 항목 | **LEVEL UP PASS** |
|------|-------------------|
| **월 구독료** | ₩3,900 (~$2.99) |
| **연 구독료** | ₩33,900 (~$25.99, 월 ₩2,825 — 28% 할인) |
| **결제 수단** | Google Play Billing (인앱 정기결제) |
| **무료 체험** | 7일 (최초 구독 시) |

### 11.2 구독자 혜택

| 카테고리 | 혜택 | 비고 |
|----------|------|------|
| **광고 제거** | 모든 네이티브 광고 비노출 | 핵심 혜택 |
| **보상형 광고 대체** | 광고 시청 없이 보상 직접 수령 | 일일보너스 EXP, 스트릭 복구, 추가 레이드, Day1 하이라이트 |
| **보상형 전면 대체** | 스핀 2배·던전 추가 보상 자동 적용 | 광고 없이 즉시 보너스 |
| **추가 룰렛 스핀** | 일일 스핀 1회 → 2회 | 구독 전용 |
| **던전 보너스 확대** | 던전 추가 보상 2회/일 → 3회/일 | 구독 전용 |
| **구독자 배지** | 닉네임 옆 ⭐ 배지 표시 | 소셜 탭·랭킹에서 노출 |

### 11.3 기술 구현 방안

#### 필요 라이브러리

```
npm install @capawesome-team/capacitor-android-billing
```

#### 구독 상태 관리 구조

```
Firestore: users/{uid}
├── subscription
│   ├── status: "active" | "expired" | "trial" | "none"
│   ├── plan: "monthly" | "yearly"
│   ├── expiresAt: Timestamp
│   ├── purchaseToken: string
│   └── startedAt: Timestamp
```

#### 핵심 구현 포인트

| 항목 | 설명 |
|------|------|
| **구독 검증** | Cloud Functions에서 Google Play Developer API로 서버 측 영수증 검증 |
| **광고 분기 처리** | `isSubscriber()` 체크 → true 시 모든 `showAd()` 호출 스킵 |
| **보상 자동 지급** | 구독자는 광고 시청 없이 `onRewardedVideoAdReward` 동일 보상 즉시 지급 |
| **갱신 실패 대응** | Grace Period(3일) 동안 혜택 유지, 이후 무료 전환 + 안내 알림 |
| **환불 처리** | RTDN(Real-Time Developer Notification) 수신 → 구독 상태 즉시 업데이트 |

### 11.4 수익 영향 시뮬레이션

> **가정:** 구독 전환율 3~5% (MAU 기준), Google Play 수수료 15% (100만 달러 이하)

| MAU | 구독자 수 (4%) | 구독 수익 (월) | 광고 수익 감소분 | **순 증가 수익** | **총 월 수익** |
|-----|---------------|---------------|----------------|-----------------|---------------|
| 1,000 | 40 | $8 | -$1 | **+$7** | **~$14** |
| 5,000 | 200 | $42 | -$5 | **+$37** | **~$77** |
| 10,000 | 400 | $85 | -$11 | **+$74** | **~$164** |
| 30,000 | 1,200 | $255 | -$35 | **+$220** | **~$510** |
| 50,000 | 2,000 | $425 | -$58 | **+$367** | **~$857** |
| 100,000 | 4,000 | $850 | -$118 | **+$732** | **~$1,732** |

> - **구독 수익:** 구독자 × $2.54/월 (₩3,900 × 85% Google 수수료 후)
> - **광고 수익 감소분:** 구독자의 기존 광고 수익 손실 (ARPMAU 기준 약 $0.29/월)
> - **총 월 수익:** 비구독자 광고 수익 + 순 구독 수익

### 11.5 구독제 도입 로드맵

| Phase | 태스크 | 우선순위 | 예상 소요 |
|-------|--------|----------|-----------|
| **Phase 1** | Google Play Console 구독 상품 등록 (월/연) | 🔴 높음 | 1시간 |
| **Phase 1** | Capacitor Billing 플러그인 설치 + 구매 플로우 구현 | 🔴 높음 | 4시간 |
| **Phase 1** | Cloud Functions 영수증 검증 API 구현 | 🔴 높음 | 3시간 |
| **Phase 1** | Firestore 구독 상태 스키마 + `isSubscriber()` 헬퍼 | 🔴 높음 | 2시간 |
| **Phase 2** | 광고 분기 처리 (네이티브·보상형·보상형 전면) | 🔴 높음 | 3시간 |
| **Phase 2** | 구독자 전용 혜택 적용 (추가 스핀, 던전 보너스 확대) | 🟡 중간 | 2시간 |
| **Phase 2** | 구독 관리 UI (설정 탭 내 구독 상태·해지·복원) | 🟡 중간 | 3시간 |
| **Phase 3** | RTDN 실시간 알림 수신 (갱신·해지·환불) | 🟡 중간 | 2시간 |
| **Phase 3** | 구독 전환율 Analytics 이벤트 + 퍼널 분석 | 🟢 낮음 | 2시간 |
| **Phase 3** | 구독 프로모션 (연말 할인, 복귀 유저 할인) | 🟢 낮음 | 1시간 |

### 11.6 구독제 관련 정책 준수

| 정책 | 대응 |
|------|------|
| **Google Play 정기결제 정책** | 구독 조건·갱신 주기·해지 방법 명확히 안내 |
| **무료 체험 명시** | 체험 기간·자동 갱신 전 알림 표시 |
| **환불 처리** | Google Play 환불 정책 준수 + RTDN 연동 |
| **개인정보처리방침 업데이트** | 구독 결제 정보 수집·처리 조항 추가 |
| **이용약관 업데이트** | 구독 서비스 조건, 해지·환불 정책 명시 |

---

## 12. 리스크 및 완화 방안

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| **광고 과다로 유저 이탈** | 리텐션 하락, MAU 감소 | 빈도 제한 엄격 적용 + Remote Config로 실시간 조절 |
| **AdMob 정책 위반으로 계정 정지** | 수익 전면 중단 | 정책 체크리스트 사전 검토 + 테스트 광고로 충분히 QA |
| **낮은 eCPM (한국 시장)** | 목표 ARPMAU 미달 | 미디에이션으로 광고 네트워크 다변화 |
| **광고 SDK 앱 크기 증가** | 설치 전환율 하락 | ProGuard/R8로 미사용 코드 제거 (~2MB 증가 예상) |
| **오프라인 시 광고 미노출** | 수익 기회 손실 | 현재 온라인 전용 앱이므로 영향 없음 |
| **구독 전환율 저조** | 구독 수익 목표 미달 | 7일 무료 체험 + 계절 프로모션으로 전환 유도 |
| **구독 해지율 증가** | MRR 하락 | 구독 전용 혜택 지속 강화 + 해지 전 리텐션 팝업 |
| **광고↔구독 카니발라이제이션** | 총 수익 감소 | 구독 단가가 ARPMAU 대비 8배 이상으로 순수익 증가 보장 |

---

## 13. 참고 자료

- [AdMob 정책 센터](https://support.google.com/admob/answer/6128543)
- [@capacitor-community/admob 문서](https://github.com/capacitor-community/admob)
- [Google UMP SDK (동의 관리)](https://developers.google.com/admob/android/privacy)
- 내부 문서: `docs/firebase-cost-estimation.md` — Firebase 비용 및 AdMob 수익 추정
- 내부 문서: `docs/플레이스토어_출시_무마케팅_시나리오별_손익추정_보고서.md` — 시나리오별 손익 분석
