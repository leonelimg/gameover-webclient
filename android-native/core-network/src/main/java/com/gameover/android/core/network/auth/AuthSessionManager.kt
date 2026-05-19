package com.gameover.android.core.network.auth

import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.model.LoginRequest
import com.gameover.android.core.network.model.RefreshRequest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

@Singleton
class AuthSessionManager @Inject constructor(
    private val authApiProvider: Provider<AuthApi>,
    private val tokenStorage: SecureTokenStorage
) {
    private val refreshMutex = Mutex()
    @Volatile private var cachedAccess: String? = tokenStorage.getAccess()

    private val authApi get() = authApiProvider.get()

    suspend fun login(username: String, password: String): AuthSessionState {
        val response = authApi.login(LoginRequest(username, password))
        
        // Update state IMMEDIATELY so the interceptor picks it up for the next call
        cachedAccess = response.accessToken
        tokenStorage.set(response.accessToken, response.refreshToken)
        
        val permissions = authApi.myPermissions().permissions
        return AuthSessionState(response.user, response.accessToken, response.refreshToken, permissions)
    }

    suspend fun restoreSession(): AuthSessionState {
        val access = tokenStorage.getAccess()
        val refresh = tokenStorage.getRefresh()
        if (access.isNullOrBlank() || refresh.isNullOrBlank()) {
            return AuthSessionState(null, null, null, emptyList())
        }

        // Set cachedAccess BEFORE making authenticated calls
        cachedAccess = access

        return runCatching {
            val me = authApi.me()
            val permissions = authApi.myPermissions().permissions
            AuthSessionState(me, access, refresh, permissions)
        }.getOrElse {
            val refreshed = refreshTokenLocked(refresh)
            val me = authApi.me()
            val permissions = authApi.myPermissions().permissions
            AuthSessionState(me, refreshed.accessToken, refreshed.refreshToken, permissions)
        }
    }

    suspend fun logout() {
        runCatching { authApi.logout() }
        tokenStorage.clear()
        cachedAccess = null
    }

    fun accessToken(): String? = cachedAccess ?: tokenStorage.getAccess()

    suspend fun refreshTokenLocked(refresh: String = tokenStorage.getRefresh().orEmpty()): com.gameover.android.core.network.model.RefreshResponse {
        return refreshMutex.withLock {
            val response = authApi.refresh(RefreshRequest(refresh))
            cachedAccess = response.accessToken
            tokenStorage.set(response.accessToken, response.refreshToken)
            response
        }
    }
}
