package com.example.doodledungeon

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {

    // 🔴 Replace this with your actual Client ID from GitHub!
    private val githubClientId = "Ov23lialuEK23i2nVmLy"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val authCode = extractCodeFromIntent(intent)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    LoginScreen(
                        extractedCode = authCode,
                        onLoginClick = { launchGitHubLogin() }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        val authCode = extractCodeFromIntent(intent)
        if (authCode != null) {
            Log.d("OAuth", "Received code: $authCode")
            
            setContent {
                MaterialTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        LoginScreen(
                            extractedCode = authCode,
                            onLoginClick = { launchGitHubLogin() }
                        )
                    }
                }
            }
        }
    }

    private fun launchGitHubLogin() {
        val githubAuthUrl = "https://github.com/login/oauth/authorize?client_id=$githubClientId"
        val customTabsIntent = CustomTabsIntent.Builder().build()
        customTabsIntent.launchUrl(this, Uri.parse(githubAuthUrl))
    }

    private fun extractCodeFromIntent(intent: Intent?): String? {
        val data: Uri? = intent?.data
        if (data != null && data.scheme == "doodledungeon" && data.host == "login") {
            return data.getQueryParameter("code")
        }
        return null
    }
}

// Compose convention names composable UI functions in PascalCase.
@Suppress("FunctionNaming")
@Composable
fun LoginScreen(extractedCode: String?, onLoginClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (extractedCode == null) {
            Button(onClick = onLoginClick) {
                Text("Login with GitHub")
            }
        } else {
            Text("Success! Code: $extractedCode")
            Spacer(modifier = Modifier.height(16.dp))
            Text("Now we need to send this to the backend!")
        }
    }
}
