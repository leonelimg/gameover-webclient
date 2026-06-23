package com.gameover.android.core.network

import com.gameover.android.core.network.api.*
import com.gameover.android.core.network.interceptor.AuthInterceptor
import com.gameover.android.core.network.interceptor.TokenAuthenticator
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClientFactory {
    fun create(
        baseUrl: String,
        accessTokenProvider: () -> String?,
        refreshTokenProvider: () -> String?,
        onTokenRefreshed: (String, String) -> Unit,
        onRefreshFailed: () -> Unit,
    ): Triple<AuthApi, DrawsApi, TicketsApi> {
        // Separate Retrofit for auth endpoints — no authenticator to avoid circular reference
        val authRetrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val authApi = authRetrofit.create(AuthApi::class.java)

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(accessTokenProvider))
            .authenticator(
                TokenAuthenticator(
                    accessTokenProvider = accessTokenProvider,
                    refreshTokenProvider = refreshTokenProvider,
                    onTokenRefreshed = onTokenRefreshed,
                    onRefreshFailed = onRefreshFailed,
                    authApiProvider = { authApi },
                )
            )
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(GsonBuilder().serializeNulls().create()))
            .build()

        return Triple(
            authApi,
            retrofit.create(DrawsApi::class.java),
            retrofit.create(TicketsApi::class.java),
        )
    }
}
