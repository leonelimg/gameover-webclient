package com.gameover.android.feature.auth.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.usecase.LoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val authRepository: AuthRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    // Persist form fields across process death
    var username: String
        get() = savedStateHandle["username"] ?: ""
        set(value) { savedStateHandle["username"] = value }

    var password: String
        get() = savedStateHandle["password"] ?: ""
        set(value) { savedStateHandle["password"] = value }

    fun login() {
        if (username.isBlank() || password.isBlank()) {
            _uiState.value = LoginUiState.Error("Ingresa usuario y contraseña.")
            return
        }
        _uiState.value = LoginUiState.Loading
        viewModelScope.launch {
            val result = loginUseCase(username, password)
            _uiState.value = result.fold(
                onSuccess = { LoginUiState.Success },
                onFailure = { LoginUiState.Error(it.message ?: "Error al iniciar sesión") },
            )
        }
    }

    fun clearError() {
        if (_uiState.value is LoginUiState.Error) {
            _uiState.value = LoginUiState.Idle
        }
    }
}
