package com.gameover.android.core.network.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider

class TokenAuthenticator @Inject constructor(
    private val sessionManagerProvider: Provider<AuthSessionManager>,
    private val tokenStorage: SecureTokenStorage
) : Authenticator {
    // Prevent infinite refresh recursion: first failed call + one retry with fresh token.
    private companion object {
        const val MAX_AUTH_CHAIN = 2
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= MAX_AUTH_CHAIN) return null

        val refresh = tokenStorage.getRefresh() ?: return null
        val refreshed = runBlocking { 
            runCatching { sessionManagerProvider.get().refreshTokenLocked(refresh) }.getOrNull() 
        } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer ${refreshed.accessToken}")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var prior = response.priorResponse
        while (prior != null) {
            result++
            prior = prior.priorResponse
        }
        return result
    }
}
