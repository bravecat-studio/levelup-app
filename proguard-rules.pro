# =============================================================
# LEVEL UP: REBOOT — ProGuard / R8 Rules
# =============================================================

# --- 공통 속성 유지 ---
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# --- Capacitor 프레임워크 ---
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# @CapacitorPlugin 어노테이션이 붙은 모든 플러그인 클래스 유지
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Plugin 하위 클래스 전체 유지 (registerPlugin() 리플렉션 사용)
-keep class * extends com.getcapacitor.Plugin { *; }

# PluginMethod 어노테이션이 붙은 메서드 유지
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# --- 커스텀 네이티브 플러그인 ---
-keep class com.levelup.reboot.plugins.** { *; }

# --- MainActivity ---
-keep class com.levelup.reboot.MainActivity { *; }

# --- Firebase (FCM, Auth, Firestore 등) ---
-keep class com.google.firebase.** { *; }
-keep interface com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Firebase Messaging (FCMPlugin에서 사용)
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }

# --- Google Play Services (AdMob, Auth, Fitness 등) ---
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# AdMob — NativeAdPlugin에서 사용
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Google Fit — GoogleFitPlugin에서 사용
-keep class com.google.android.gms.fitness.** { *; }
-keep class com.google.android.gms.auth.** { *; }

# Google Sign-In
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.signin.** { *; }

# --- Health Connect (HealthConnectPlugin에서 사용) ---
-keep class androidx.health.connect.** { *; }
-keep interface androidx.health.connect.** { *; }
-dontwarn androidx.health.connect.**

# --- WebView / JavaScript Interface ---
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- AndroidX / Jetpack ---
-keep class androidx.** { *; }
-dontwarn androidx.**

# --- Coroutines (Firebase SDK 내부 사용) ---
-dontwarn kotlinx.coroutines.**
-keep class kotlinx.coroutines.** { *; }

# --- OkHttp / Retrofit (Capacitor HTTP 플러그인) ---
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# --- Gson (Capacitor 내부 직렬화) ---
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# --- R8 최적화 관련 경고 억제 ---
-dontwarn java.lang.invoke.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
