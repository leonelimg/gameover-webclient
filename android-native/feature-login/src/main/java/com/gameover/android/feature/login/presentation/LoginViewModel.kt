package com.gameover.android.feature.login.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.common.AppError
import com.gameover.android.core.common.ResultState
import com.gameover.android.core.network.auth.AuthSessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class LoginViewModel(
    private val authSessionManager: AuthSessionManager
) : ViewModel() {
    private val _state = MutableStateFlow<ResultState<Unit>>(ResultState.Success(Unit))
    val state: StateFlow<ResultState<Unit>> = _state

    fun login(username: String, password: String) {
        _state.value = ResultState.Loading
        viewModelScope.launch {
            _state.value = runCatching {
                authSessionManager.login(username, password)
                ResultState.Success(Unit)
            }.getOrElse {
                ResultState.Error(AppError.Http(401, "Usuario o contraseña incorrectos"))
            }
        }
    }
}
