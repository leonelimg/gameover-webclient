package com.gameover.android.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.gameover.android.app.navigation.AppNavGraph
import com.gameover.android.app.session.SessionManager
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.ui.theme.GameOverTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var sessionManager: SessionManager

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GameOverTheme {
                AppNavGraph(
                    sessionManager = sessionManager,
                    authRepository = authRepository,
                )
            }
        }
    }
}
