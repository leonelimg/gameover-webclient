package com.gameover.android.app.session

import com.gameover.android.core.data.local.TokenDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionManager @Inject constructor(
    private val tokenDataStore: TokenDataStore,
) {
    /** Emits true when the user is authenticated (has a non-null access token) */
    val isAuthenticated: Flow<Boolean> = tokenDataStore.accessToken.map { it != null }

    suspend fun logout() = tokenDataStore.clearSession()
}
