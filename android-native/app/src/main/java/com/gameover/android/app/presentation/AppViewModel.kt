package com.gameover.android.app.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gameover.android.app.navigation.AppDestination
import com.gameover.android.app.navigation.ResourceKeyGate
import com.gameover.android.core.database.repository.CachedSession
import com.gameover.android.core.database.repository.SessionLocalRepository
import com.gameover.android.core.network.auth.AuthSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AppUiState(
    val loading: Boolean = true,
    val isAuthenticated: Boolean = false,
    val permissions: Set<String> = emptySet(),
    val message: String? = null
) {
    fun canAccess(destination: AppDestination): Boolean {
        return ResourceKeyGate().canAccess(destination, permissions)
    }
}

@HiltViewModel
class AppViewModel @Inject constructor(
    private val authSessionManager: AuthSessionManager,
    private val sessionLocalRepository: SessionLocalRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState

    init {
        restoreSession()
    }

    fun restoreSession() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            val restored = runCatching { authSessionManager.restoreSession() }.getOrNull()

            if (restored?.isAuthenticated == true && restored.user != null) {
                sessionLocalRepository.save(
                    CachedSession(
                        userId = restored.user.id,
                        username = restored.user.username,
                        role = restored.user.role,
                        permissions = restored.permissions
                    )
                )
                _uiState.update {
                    it.copy(
                        loading = false,
                        isAuthenticated = true,
                        permissions = restored.permissions.toSet()
                    )
                }
                return@launch
            }

            val cached = sessionLocalRepository.read()
            if (cached != null) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        isAuthenticated = false,
                        permissions = cached.permissions.toSet(),
                        message = "Sesión expirada. Inicia sesión nuevamente."
                    )
                }
            } else {
                _uiState.update { it.copy(loading = false, isAuthenticated = false, permissions = emptySet()) }
            }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            val session = runCatching { authSessionManager.login(username, password) }.getOrNull()
            if (session?.isAuthenticated == true && session.user != null) {
                sessionLocalRepository.save(
                    CachedSession(
                        userId = session.user.id,
                        username = session.user.username,
                        role = session.user.role,
                        permissions = session.permissions
                    )
                )
                _uiState.update {
                    it.copy(
                        loading = false,
                        isAuthenticated = true,
                        permissions = session.permissions.toSet(),
                        message = null
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        loading = false,
                        isAuthenticated = false,
                        message = "Usuario o contraseña incorrectos"
                    )
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            runCatching { authSessionManager.logout() }
            sessionLocalRepository.clear()
            _uiState.update {
                it.copy(
                    loading = false,
                    isAuthenticated = false,
                    permissions = emptySet(),
                    message = "Sesión cerrada"
                )
            }
        }
    }
}
