package com.gameover.android.core.network

import android.content.Context
import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.auth.AuthInterceptor
import com.gameover.android.core.network.auth.AuthSessionManager
import com.gameover.android.core.network.auth.SecureTokenStorage
import com.gameover.android.core.network.auth.TokenAuthenticator
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

object NetworkModule {
    fun createSessionManager(context: Context, baseUrl: String): AuthSessionManager {
        val plainRetrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
        val storage = SecureTokenStorage(context)
        val authApi = plainRetrofit.create(AuthApi::class.java)
        return AuthSessionManager(authApi, storage)
    }

    fun createBusinessApi(context: Context, baseUrl: String): Pair<BusinessApi, AuthSessionManager> {
        val storage = SecureTokenStorage(context)
        val authApi = Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(AuthApi::class.java)

        val sessionManager = AuthSessionManager(authApi, storage)

        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(sessionManager))
            .authenticator(TokenAuthenticator(sessionManager, storage))
            .addInterceptor(logging)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()

        return retrofit.create(BusinessApi::class.java) to sessionManager
    }
}
