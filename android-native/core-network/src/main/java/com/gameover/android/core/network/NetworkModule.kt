package com.gameover.android.core.network

import android.content.Context
import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.api.BusinessApi
import com.gameover.android.core.network.auth.AuthInterceptor
import com.gameover.android.core.network.auth.AuthSessionManager
import com.gameover.android.core.network.auth.SecureTokenStorage
import com.gameover.android.core.network.auth.TokenAuthenticator
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideBaseUrl(): String = NetworkConfig.BASE_URL

    @Provides
    @Singleton
    fun provideTokenStorage(@ApplicationContext context: Context): SecureTokenStorage {
        return SecureTokenStorage(context)
    }

    @Provides
    @Singleton
    fun provideAuthApi(baseUrl: String): AuthApi {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideAuthSessionManager(
        authApi: AuthApi,
        storage: SecureTokenStorage
    ): AuthSessionManager {
        return AuthSessionManager(authApi, storage)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        sessionManager: AuthSessionManager,
        storage: SecureTokenStorage
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(sessionManager))
            .authenticator(TokenAuthenticator(sessionManager, storage))
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideBusinessApi(
        baseUrl: String,
        client: OkHttpClient
    ): BusinessApi {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(BusinessApi::class.java)
    }
}
