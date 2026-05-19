package com.gameover.android.core.network.interceptor

import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

class TokenAuthenticator(
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
        val refreshToken = refreshTokenProvider() ?: run {
            onRefreshFailed()
            return null
        }
        val refreshResponse = try {
            runBlocking {
                authApiProvider().refresh(RefreshRequest(refreshToken))
            }
        } catch (e: Exception) {
            onRefreshFailed()
            return null
        }
        return if (refreshResponse.isSuccessful) {
            val body = refreshResponse.body()!!
            onTokenRefreshed(body.accessToken, body.refreshToken)
            response.request.newBuilder()
                .header("Authorization", "Bearer ${body.accessToken}")
                .header("X-Retry-Auth", "true")
                .build()
        } else {
            onRefreshFailed()
            null
        }
    }
}
