package com.gameover.android.core.network.auth

import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(
    private val sessionManager: AuthSessionManager
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = sessionManager.accessToken()
        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
