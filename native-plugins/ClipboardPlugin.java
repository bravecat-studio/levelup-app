package com.levelup.reboot.plugins;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor 커스텀 플러그인: 네이티브 클립보드 쓰기
 *
 * Android 10+ 에서 WebView의 navigator.clipboard 가 포커스 제한으로
 * 거부될 수 있는 문제를 우회하기 위해 Activity 컨텍스트에서
 * ClipboardManager 를 직접 호출합니다.
 *
 * 사용법 (app.js 등 JS에서):
 *   const cap = window.Capacitor;
 *   if (cap && cap.Plugins && cap.Plugins.NativeClipboard) {
 *       cap.Plugins.NativeClipboard.write({ text: '복사할 텍스트' });
 *   }
 *
 * 등록 (MainActivity.java에서):
 *   import com.levelup.reboot.plugins.ClipboardPlugin;
 *   ...
 *   registerPlugin(ClipboardPlugin.class);
 */
@CapacitorPlugin(name = "NativeClipboard")
public class ClipboardPlugin extends Plugin {

    @PluginMethod()
    public void write(PluginCall call) {
        String text = call.getString("text", "");
        try {
            ClipboardManager clipboard = (ClipboardManager) getActivity()
                    .getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) {
                call.reject("ClipboardManager를 가져올 수 없습니다.");
                return;
            }
            ClipData clip = ClipData.newPlainText("", text);
            clipboard.setPrimaryClip(clip);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("클립보드에 복사할 수 없습니다: " + e.getMessage());
        }
    }
}
