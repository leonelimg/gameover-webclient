package com.gameover.android.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.gameover.android.app.navigation.AppNavGraph
import com.gameover.android.core.ui.component.AppUpdateDialog
import com.gameover.android.app.presentation.AppUpdateViewModel
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

    private val updateViewModel: AppUpdateViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val updateInfo by updateViewModel.updateState.collectAsState()

            LaunchedEffect(Unit) {
                updateViewModel.checkForUpdates()
            }

            GameOverTheme {
                AppNavGraph(
                    sessionManager = sessionManager,
                    authRepository = authRepository,
                )

                updateInfo?.let { info ->
                    AppUpdateDialog(
                        updateInfo = info,
                        onDismiss = { updateViewModel.dismissUpdate() }
                    )
                }
            }
        }
    }
}
