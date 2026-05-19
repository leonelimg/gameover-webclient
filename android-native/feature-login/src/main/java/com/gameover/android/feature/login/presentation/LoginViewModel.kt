package com.gameover.android.feature.login.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.NetworkErrorMapper
import com.gameover.android.core.network.auth.AuthSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class LoginViewModel(
    @Inject
    private val authSessionManager: AuthSessionManager
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<String>>(ResultState.Success(""))
    val state: StateFlow<ResultState<String>> = _state

    fun restoreSession() {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                val restored = authSessionManager.restoreSession()
                if (restored.isAuthenticated) {
                    ResultState.Success("Sesión restaurada")
                } else {
                    ResultState.Success("Sin sesión activa")
                }
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "No se pudo restaurar sesión"))
            }
        }
    }

    fun login(username: String, password: String) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                authSessionManager.login(username, password)
                ResultState.Success("Login exitoso")
            }.getOrElse {
                ResultState.Error(NetworkErrorMapper.toAppError(it, "Usuario o contraseña incorrectos"))
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authSessionManager.logout()
            _state.value = ResultState.Success("Sesión cerrada")
        }
    }
}
