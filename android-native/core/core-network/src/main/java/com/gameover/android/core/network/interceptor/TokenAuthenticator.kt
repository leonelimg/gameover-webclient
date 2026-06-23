package com.gameover.android.core.network.interceptor

import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

class TokenAuthenticator(
    private val accessTokenProvider: () -> String?,
    private val refreshTokenProvider: () -> String?,
    private val onTokenRefreshed: (newAccessToken: String, newRefreshToken: String) -> Unit,
    private val onRefreshFailed: () -> Unit,
    private val authApiProvider: () -> AuthApi,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        // Avoid infinite retry loops
        if (response.request.header("X-Retry-Auth") != null) {
            onRefreshFailed()
            return null
        }

        val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")

        synchronized(this) {
            val currentAccessToken = accessTokenProvider()

            // If another thread already refreshed the token, retry this request with it
            if (currentAccessToken != null && currentAccessToken != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentAccessToken")
                    .header("X-Retry-Auth", "true")
                    .build()
            }

            val refreshToken = refreshTokenProvider() ?: run {
                onRefreshFailed()
                return null
            }

            val refreshResponse = try {
                runBlocking {
                    authApiProvider().refresh(RefreshRequest(refreshToken))
                }
            } catch (e: Exception) {
                // Do not call onRefreshFailed() on network errors/timeouts
                return null
            }

            if (refreshResponse.isSuccessful) {
                val body = refreshResponse.body()!!
                onTokenRefreshed(body.accessToken, body.refreshToken)
                return response.request.newBuilder()
                    .header("Authorization", "Bearer ${body.accessToken}")
                    .header("X-Retry-Auth", "true")
                    .build()
            } else {
                // Only clear the session if the server explicitly rejects the refresh token (4xx errors)
                if (refreshResponse.code() in 400..499) {
                    onRefreshFailed()
                }
                return null
            }
        }
    }
}
