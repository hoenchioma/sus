# The page calls these through window.SusTv, so R8 must keep them by name.
-keepclassmembers class app.sus.tv.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
