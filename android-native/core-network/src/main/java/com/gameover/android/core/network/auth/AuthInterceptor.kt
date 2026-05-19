package com.gameover.android.core.network.auth

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Provider

class AuthInterceptor @Inject constructor(
    private val sessionManagerProvider: Provider<AuthSessionManager>
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath

        // Skip adding Authorization header for login and refresh endpoints
        if (path.contains("/api/auth/login") || path.contains("/api/auth/refresh")) {
            return chain.proceed(request)
        }

        val token = sessionManagerProvider.get().accessToken()
        val authenticatedRequest = if (!token.isNullOrBlank()) {
            request.newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        return chain.proceed(authenticatedRequest)
    }
}
