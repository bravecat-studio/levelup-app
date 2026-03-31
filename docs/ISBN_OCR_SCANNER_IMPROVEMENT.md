# ISBN/OCR 스캐너 개선 계획 및 수정사항

> 작성일: 2026-03-31
> 대상 파일: `app.js`, `app.html`, `tesseract-lang/eng.traineddata`

---

## 1. 현재 구현 분석

### 1.1 아키텍처 (3단계 구조)

```
[Stage 1: 바코드 스캔]  →  [Stage 2: OCR 폴백]  →  [Stage 3: ISBN 추출/검증]
   html5-qrcode              Tesseract.js            정규식 + 체크섬
   0~1.2초, 10FPS            1.2초 이후, 700ms       프래그먼트 누적 + 투표
```

### 1.2 사용 라이브러리

| 라이브러리 | 버전 | 용도 | 크기 |
|-----------|------|------|------|
| html5-qrcode | v2.3.8 (CDN) | 바코드 인식 (EAN-13/8, UPC-A/E, CODE-128) | ~130KB |
| Tesseract.js | v4+ (로컬 WASM) | OCR 텍스트 인식 (폴백) | ~27MB |
| - tesseract.min.js | | 진입점 | 67KB |
| - worker.min.js | | Web Worker | 124KB |
| - tesseract-core/ | | WASM 모듈 (4종) | ~4MB |
| - eng.traineddata | | 영어 학습 데이터 | **23.4MB** |

### 1.3 이미지 전처리 파이프라인 (`preprocessForOcr()`)

1. Grayscale 변환 (`max(R,G,B)` 방식)
2. 어두운 배경 감지 및 반전 (평균 밝기 < 100)
3. 콘트라스트 스트레칭 (범위 < 200일 때)
4. Unsharp Mask 샤프닝 (3x3 라플라시안, 강도 0.6)
5. 적응형 이진화 (Sauvola / Otsu 폴백)
6. 모폴로지 팽창 (1px, 4-이웃)
7. 3x 업스케일 (nearest-neighbor, 최대 3000px)

### 1.4 OCR 영역 스캔 전략

- 10개 ROI 영역을 순환 스캔
- 영역 잠금(lock-on): ISBN 신호 감지 시 해당 영역 + 이웃 2개에 집중
- 회전 바코드 감지: 3프레임마다 90도 CW/CCW 시도
- 프래그먼트 누적: 여러 프레임의 부분 인식 결과를 합성
- 후보 투표: 2회 이상 확인된 ISBN만 확정

### 1.5 ISBN 추출 및 검증

- OCR 오류 보정: `O→0`, `I→1`, `S→5`, `B→8`, `Z→2`, `G→6`, `q→9`
- ISBN 정규식 3종 (ISBN 접두사, 독립 13자리, 하이픈 구분)
- ISBN-10/13 체크섬 검증
- 1자리 오류 자동 수정 시도

---

## 2. 문제점 분석

### 2.1 카메라 해상도 미지정 (치명적)

**코드 위치:** `app.js:13051`
```js
// 변경 전: 브라우저 기본값 (640x480) 사용
await _html5QrCode.start({ facingMode: 'environment' }, ...);
```

640x480 해상도에서는 바코드 바(bar)의 너비가 1~2px 수준으로 줄어들어 디코딩 실패율이 급격히 증가합니다. OCR 역시 문자당 픽셀 수가 부족하여 숫자 오인식이 발생합니다.

### 2.2 숫자 인식 실패 (OCR 경로)

- **근본 원인 1**: Tesseract `eng.traineddata`는 영문 텍스트 전체를 학습한 범용 모델로, 숫자만 인식하는 데 최적화되지 않음
- **근본 원인 2**: nearest-neighbor 업스케일링이 숫자 가장자리에 계단 현상(aliasing) 유발 → LSTM 인식기 혼란
- **근본 원인 3**: 업스케일된 이미지에 테두리 패딩이 없어 가장자리 텍스트 인식 실패
- 보정 함수(`ocrCorrectDigits`)가 있지만, 입력 자체가 부정확하면 보정도 한계

### 2.3 다운로드 용량 과다

`eng.traineddata` (23.4MB) + WASM 코어 (~4MB) = **약 27MB**
모바일 환경에서 초기 로딩에 부담이 크며, 스캐너를 사용하지 않는 사용자에게도 불필요한 다운로드 발생.

### 2.4 한글 미지원

- 영어 학습 데이터만 로드 (`'eng'`)
- 한글 `kor.traineddata` 추가 시 용량이 2배 이상 증가
- ISBN 자체는 숫자이므로 한글 인식은 보조적 역할

---

## 3. 수정사항 (적용 완료)

### Phase 1: 카메라 해상도 + 네이티브 바코드 (최고 우선순위)

#### 1A. 고해상도 카메라 제약 조건 추가

**파일:** `app.js` (라인 13051~13057)

```js
// 변경 후: 1920x1080 이상 요청
await _html5QrCode.start(
    {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        focusMode: { ideal: 'continuous' }
    },
    _scannerConfig(),
    _onBarcodeSuccess,
    _onBarcodeError
);
```

**효과:**
- 카메라 해상도 4~6배 향상 (640x480 → 1920x1080)
- 바코드 바(bar) 너비 4~6배 증가 → 디코딩 성공률 대폭 개선
- OCR 입력 이미지 품질 향상
- 연속 자동초점(continuous focus) 활성화

**추가:** 카메라 해상도 디버그 로그:
```js
var settings = track.getSettings();
AppLogger.info('[ISBN] Camera resolution: ' + settings.width + 'x' + settings.height);
```

#### 1B. 네이티브 BarcodeDetector API 직접 사용

**파일:** `app.js` (openIsbnScanner 함수 내)

`html5-qrcode`의 `experimentalFeatures.useBarCodeDetectorIfSupported: true` 설정이 있었지만, 내부 래핑으로 성능 손실이 있었습니다.

```js
// 네이티브 BarcodeDetector를 직접 호출 (Android Chrome 하드웨어 가속)
if ('BarcodeDetector' in window) {
    var _nativeDetector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
    });
    // requestAnimationFrame 루프로 비디오 프레임 직접 감지
    // html5-qrcode와 병렬 실행
}
```

**효과:**
- Android Chrome에서 하드웨어 가속 ML 바코드 인식
- 회전된 바코드 자동 감지 (수동 회전 불필요)
- `html5-qrcode`와 병렬 실행으로 인식 속도 향상
- 네이티브 API 불가 시 기존 `html5-qrcode`로 자동 폴백

#### 1C. 회전 바코드 스캔 빈도 증가

**파일:** `app.js` (라인 11557)

```js
// 변경 전: 3프레임마다 ≈ 2.1초
if (_rotatedScanCounter % 3 === 0)

// 변경 후: 2프레임마다 ≈ 1.0초
if (_rotatedScanCounter % 2 === 0)
```

**효과:** 한국 도서의 세로 바코드 감지 반응 시간 2.1초 → 1.0초로 단축

---

### Phase 2: OCR 정확도 개선 + 경량화

#### 2A. fast traineddata 교체 (-19MB)

**파일:** `tesseract-lang/eng.traineddata`

| 구분 | 변경 전 (best) | 변경 후 (fast) |
|------|--------------|--------------|
| 파일 크기 | 23.4 MB | **4.0 MB** |
| 모델 유형 | 부동소수점 LSTM | 정수 양자화 LSTM |
| 숫자 인식 정확도 | 높음 | **거의 동일** (whitelist 환경) |

숫자 + ISBN 문자열만 인식하는 whitelist 환경에서는 fast 모델이 best 모델과 거의 동일한 정확도를 보입니다.

**총 다운로드 절감:** ~27MB → ~8MB (**-19MB, 70% 감소**)

#### 2B. 이미지 전처리 개선

**파일:** `app.js` `preprocessForOcr()` 함수

**변경 1 - Bilinear 보간 업스케일링:**
```js
// 변경 전: 계단 현상(aliasing) 유발
upCtx.imageSmoothingEnabled = false;

// 변경 후: 부드러운 엣지로 LSTM 인식률 향상
upCtx.imageSmoothingEnabled = true;
upCtx.imageSmoothingQuality = 'high';
```

**변경 2 - 흰색 테두리 패딩:**
```js
// 10px 흰색 테두리 추가 (Tesseract는 가장자리 텍스트 인식이 약함)
var paddedCanvas = document.createElement('canvas');
paddedCanvas.width = upW + 20;
paddedCanvas.height = upH + 20;
paddedCtx.fillStyle = '#FFFFFF';
paddedCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
paddedCtx.drawImage(upCanvas, 10, 10);
```

**효과:**
- 숫자 가장자리 계단 현상 제거 → OCR 인식률 향상
- 가장자리 텍스트 인식 실패 방지

#### 2C. OCR 영역 최적화

**변경 1 - 영역 축소 (10개 → 7개):**

제거된 영역:
- 이미지 중앙 영역 (cropIndex 7, 8) — ISBN이 거의 위치하지 않는 영역
- 풀프레임 폴백 (cropIndex 9) — 전체 이미지 OCR은 노이즈가 많아 비효율

남은 7개 고수율 영역:
| Index | 위치 | 회전 | 이유 |
|-------|------|------|------|
| 0 | 하단 수평 | 없음 | 가장 흔한 ISBN 위치 |
| 1 | 중앙하단 좁은 영역 | 없음 | 바코드 아래 텍스트 |
| 2 | 하단 넓은 영역 | 없음 | 뒤표지 하단 |
| 3 | 우측 수직 | 90° CCW | 세로 바코드 |
| 4 | 하단 회전 | 90° CW | 회전된 텍스트 |
| 5 | 우측 넓은 수직 | 90° CCW | 세로 텍스트 |
| 6 | 좌측 수직 | 90° CW | 좌측 세로 바코드 |

**변경 2 - OCR 간격 단축:**
```js
// 변경 전: 700ms 간격
_ocrInterval = setInterval(ocrCaptureFrame, 700);

// 변경 후: 500ms 간격 (고수율 영역에 더 자주 스캔)
_ocrInterval = setInterval(ocrCaptureFrame, 500);
```

**효과:** 영역 축소로 CPU 부하 감소, 간격 단축으로 유효 영역 스캔 빈도 증가

#### 2D. Tesseract 스크립트 지연 로딩

**파일:** `app.html` (라인 17), `app.js` `initOcrWorker()` 함수

```html
<!-- 변경 전: 즉시 로딩 -->
<script src="tesseract.min.js"></script>

<!-- 변경 후: 주석 처리, 스캐너 열 때 동적 로딩 -->
<!-- Tesseract.js loaded on-demand when scanner opens -->
```

```js
// app.js: initOcrWorker()에서 동적 로딩
if (typeof Tesseract === 'undefined') {
    await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'tesseract.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
```

**효과:** 스캐너를 사용하지 않는 사용자는 Tesseract를 다운로드하지 않음 → 초기 로딩 시간 단축

---

## 4. 향후 개선 방향 (미적용)

### Phase 3: 바코드 라이브러리 교체 (선택적)

`@zxing/browser`가 `html5-qrcode`보다 EAN-13 인식률이 높으나, Phase 1B의 네이티브 BarcodeDetector가 대부분의 경우를 처리하므로 **측정 후 결정**.

### Phase 4: 한글 지원 (nice-to-have)

- `kor.traineddata` (fast 모델 ~6MB) 온디맨드 로딩
- ISBN 숫자 인식과 별도의 2차 워커로 한글 도서 제목 인식
- ISBN 검색 API 결과 보조용

---

## 5. 검증 방법

| 항목 | 방법 | 기대 결과 |
|------|------|----------|
| 카메라 해상도 | `videoTrack.getSettings()` 로그 확인 | 1280x720 이상 |
| 바코드 인식률 | 도서 10권 테스트 | 80% 이상 1차 스캔 성공 |
| OCR 폴백 빈도 | 바코드 실패 → OCR 진입 비율 | 20% 이하 |
| 다운로드 크기 | 네트워크 탭 확인 | ~8MB (기존 ~27MB) |
| 숫자 인식 정확도 | OCR 경로 ISBN 정확 인식률 | 전후 비교 개선 |

---

## 6. 설계 결정사항

1. **3단계 아키텍처 유지**: 바코드 → OCR → 프래그먼트 누적 구조가 견고하므로 유지
2. **OpenCV.js 미사용**: ~8MB 추가 부담. 현재 전처리 파이프라인이 충분히 정교함
3. **커스텀 CNN 미추진**: Phase 1~2 개선으로 충분. 구현 복잡도 대비 효과 불확실
4. **Dynamsoft 미사용**: 무료 티어에 스캔 횟수 제한 + 워터마크 존재
