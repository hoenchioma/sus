package app.sus.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.view.Gravity
import android.os.SystemClock
import java.util.Locale

/** Shows the Sus TV screen full-screen. The web page does everything; this only gives it a voice and keeps the TV awake. */
class MainActivity : Activity() {
    private var web: WebView? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val home = Uri.parse(BuildConfig.SUS_URL)
    private val crashes = ArrayDeque<Long>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Lets chrome://inspect (or adb + DevTools) look inside the page on debug builds only.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        tts = TextToSpeech(this) { status -> ttsReady = status == TextToSpeech.SUCCESS }
        showSite(savedInstanceState)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showSite(savedInstanceState: Bundle? = null) {
        val web = WebView(this).apply {
            setBackgroundColor(0xFF0B1026.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // The narrator and sound cues play without anyone tapping the TV first.
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString = "${settings.userAgentString} SusTv/${BuildConfig.VERSION_NAME}"
            addJavascriptInterface(Bridge(), "SusTv")
            webViewClient = object : WebViewClient() {
                // Stay on the Sus site; anything else would leave a TV stuck on a page with no way to type.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = request.url.host != home.host

                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) showOffline()
                }

                // TV sticks are short on memory; if Android kills the page's renderer, start the page
                // again instead of letting the whole app crash.
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    view.destroy()
                    val now = SystemClock.elapsedRealtime()
                    crashes.addLast(now)
                    while (crashes.first() < now - 60_000) crashes.removeFirst()
                    // A page that keeps crashing would otherwise reload forever.
                    if (crashes.size > 3) showStuck() else showSite()
                    return true
                }
            }
        }
        this.web = web
        setContentView(web)

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl("${BuildConfig.SUS_URL}/tv")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    /** Back leaves a game for the pairing screen, and only exits the app from there. */
    @Deprecated("Still the simplest hook for the remote's Back button on every Android TV version")
    override fun onBackPressed() {
        val web = web
        if (web != null && web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        tts?.shutdown()
        web?.destroy()
        super.onDestroy()
    }

    private fun showStuck() {
        web = null
        setContentView(TextView(this).apply {
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF0B1026.toInt())
            setTextColor(0xFFEEF1FF.toInt())
            textSize = 28f
            setText(R.string.keeps_crashing)
        })
    }

    private fun showOffline() {
        val retry = "${BuildConfig.SUS_URL}/tv"
        val page = """
            <body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b1026;color:#eef1ff;font:600 3vw sans-serif;text-align:center">
              <div>Can't reach Sus.<br><span style="color:#8d96c9;font-size:2vw">Check the TV's internet connection. Trying again…</span></div>
              <script>setTimeout(function () { location.href = '$retry'; }, 5000);</script>
            </body>
        """.trimIndent()
        web?.loadDataWithBaseURL(BuildConfig.SUS_URL, page, "text/html", "utf-8", null)
    }

    /** Android's web view has no speech synthesis, so the page speaks through the TV's own voice instead. */
    inner class Bridge {
        @JavascriptInterface
        fun speak(text: String, lang: String) {
            runOnUiThread {
                val voice = tts ?: return@runOnUiThread
                if (!ttsReady) return@runOnUiThread
                val wanted = if (lang == "bn") Locale("bn", "BD") else Locale.UK
                voice.language = if (voice.isLanguageAvailable(wanted) >= TextToSpeech.LANG_AVAILABLE) wanted else Locale.getDefault()
                voice.setSpeechRate(0.92f)
                voice.setPitch(0.9f)
                voice.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sus")
            }
        }
    }
}
