package com.levelup.reboot.plugins;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.fitness.Fitness;
import com.google.android.gms.fitness.FitnessOptions;
import com.google.android.gms.fitness.data.Bucket;
import com.google.android.gms.fitness.data.DataPoint;
import com.google.android.gms.fitness.data.DataSet;
import com.google.android.gms.fitness.data.DataType;
import com.google.android.gms.fitness.data.Field;
import com.google.android.gms.fitness.request.DataReadRequest;
import com.google.android.gms.fitness.result.DataReadResponse;
import com.google.android.gms.tasks.Tasks;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.TimeUnit;

/**
 * Capacitor 커스텀 플러그인: Google Fit Android SDK를 통한 걸음 수 조회
 *
 * - REST API 대신 네이티브 Google Fit SDK (History API)를 사용
 * - Health Connect가 사용 불가한 기기에서 걸음 수 데이터를 직접 읽음
 * - Google Sign-In 계정의 fitness scope를 기반으로 데이터 접근
 * - handleOnActivityResult로 권한 요청 결과를 올바르게 처리
 *
 * 사용법 (app.js에서):
 *   const { GoogleFit } = Capacitor.Plugins;
 *   const result = await GoogleFit.getTodaySteps();
 *
 * 등록 (MainActivity.java에서 - GitHub Actions에서 자동 주입):
 *   import com.levelup.reboot.plugins.GoogleFitPlugin;
 *   this.registerPlugin(GoogleFitPlugin.class);
 */
@CapacitorPlugin(name = "GoogleFit")
public class GoogleFitPlugin extends Plugin {
    private static final String TAG = "GoogleFitPlugin";
    private static final int GOOGLE_FIT_PERMISSIONS_REQUEST_CODE = 1001;

    // 권한 요청 결과를 처리하기 위해 PluginCall을 저장
    private PluginCall savedPermissionsCall = null;

    private FitnessOptions getFitnessOptions() {
        return FitnessOptions.builder()
                .addDataType(DataType.TYPE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_READ)
                .addDataType(DataType.AGGREGATE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_READ)
                .build();
    }

    /**
     * Google Fit SDK 사용 가능 여부 확인
     * - Google Play Services 및 Google 계정 로그인 상태 확인
     */
    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        try {
            FitnessOptions fitnessOptions = getFitnessOptions();
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());

            if (account == null) {
                result.put("available", false);
                result.put("hasPermissions", false);
                result.put("reason", "Google 계정 로그인이 필요합니다.");
                call.resolve(result);
                return;
            }

            boolean hasPermissions = GoogleSignIn.hasPermissions(account, fitnessOptions);
            result.put("available", true);
            result.put("hasPermissions", hasPermissions);
            result.put("accountEmail", account.getEmail() != null ? account.getEmail() : "");
        } catch (Exception e) {
            Log.w(TAG, "Google Fit SDK 확인 실패: " + e.getMessage());
            result.put("available", false);
            result.put("hasPermissions", false);
            result.put("error", e.getMessage());
        }
        call.resolve(result);
    }

    /**
     * Google Fit 권한 요청
     * - fitness.activity.read scope에 대한 OAuth 동의 화면 표시
     * - 결과는 handleOnActivityResult에서 처리
     */
    @PluginMethod()
    public void requestPermissions(PluginCall call) {
        try {
            FitnessOptions fitnessOptions = getFitnessOptions();
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());

            if (account == null) {
                JSObject result = new JSObject();
                result.put("granted", false);
                result.put("reason", "Google 계정에 로그인되어 있지 않습니다. 먼저 로그인해 주세요.");
                call.resolve(result);
                return;
            }

            if (GoogleSignIn.hasPermissions(account, fitnessOptions)) {
                JSObject result = new JSObject();
                result.put("granted", true);
                result.put("message", "이미 Google Fit 권한이 부여되어 있습니다.");
                call.resolve(result);
                return;
            }

            // PluginCall을 저장하여 onActivityResult에서 결과 반환
            call.setKeepAlive(true);
            savedPermissionsCall = call;

            // Google Fit 권한 요청 다이얼로그 표시
            GoogleSignIn.requestPermissions(
                    getActivity(),
                    GOOGLE_FIT_PERMISSIONS_REQUEST_CODE,
                    account,
                    fitnessOptions
            );

        } catch (Exception e) {
            Log.e(TAG, "Google Fit 권한 요청 실패: " + e.getMessage());
            call.reject("Google Fit 권한 요청 실패: " + e.getMessage());
        }
    }

    /**
     * Activity 결과 처리 (권한 요청 결과 수신)
     */
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == GOOGLE_FIT_PERMISSIONS_REQUEST_CODE && savedPermissionsCall != null) {
            PluginCall call = savedPermissionsCall;
            savedPermissionsCall = null;

            JSObject result = new JSObject();
            if (resultCode == Activity.RESULT_OK) {
                result.put("granted", true);
                result.put("message", "Google Fit 권한이 부여되었습니다.");
                Log.i(TAG, "Google Fit 권한 부여 완료");
            } else {
                result.put("granted", false);
                result.put("message", "Google Fit 권한 요청이 거부되었습니다.");
                Log.w(TAG, "Google Fit 권한 거부됨 (resultCode=" + resultCode + ")");
            }
            call.resolve(result);
        }
    }

    /**
     * 오늘의 걸음 수 데이터 조회 (Google Fit History API)
     * - 오늘 자정부터 현재까지의 총 걸음 수를 집계하여 반환
     */
    @PluginMethod()
    public void getTodaySteps(PluginCall call) {
        new Thread(() -> {
            try {
                FitnessOptions fitnessOptions = getFitnessOptions();
                GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());

                if (account == null || !GoogleSignIn.hasPermissions(account, fitnessOptions)) {
                    JSObject result = new JSObject();
                    result.put("steps", 0);
                    result.put("available", false);
                    result.put("needsPermission", true);
                    result.put("fallbackToRest", true);
                    call.resolve(result);
                    return;
                }

                // 오늘 자정부터 현재까지
                LocalDate today = LocalDate.now();
                long startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
                long now = System.currentTimeMillis();

                DataReadRequest readRequest = new DataReadRequest.Builder()
                        .aggregate(DataType.TYPE_STEP_COUNT_DELTA)
                        .bucketByTime(1, TimeUnit.DAYS)
                        .setTimeRange(startOfDay, now, TimeUnit.MILLISECONDS)
                        .build();

                DataReadResponse response = Tasks.await(
                        Fitness.getHistoryClient(getContext(), account).readData(readRequest),
                        30, TimeUnit.SECONDS
                );

                long totalSteps = 0;
                for (Bucket bucket : response.getBuckets()) {
                    for (DataSet dataSet : bucket.getDataSets()) {
                        for (DataPoint dp : dataSet.getDataPoints()) {
                            totalSteps += dp.getValue(Field.FIELD_STEPS).asInt();
                        }
                    }
                }

                JSObject result = new JSObject();
                result.put("steps", totalSteps);
                result.put("available", true);
                result.put("source", "google_fit_native");
                result.put("date", today.toString());
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Google Fit 걸음 수 조회 실패: " + e.getMessage());
                JSObject result = new JSObject();
                result.put("steps", 0);
                result.put("available", false);
                result.put("fallbackToRest", true);
                result.put("error", e.getMessage());
                call.resolve(result);
            }
        }).start();
    }
}
