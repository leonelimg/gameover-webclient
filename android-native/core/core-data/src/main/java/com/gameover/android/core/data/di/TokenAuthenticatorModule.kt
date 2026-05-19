package com.gameover.android.core.data.di

import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.interceptor.TokenAuthenticator
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object TokenAuthenticatorModule {

    @Provides
    @Singleton
    fun provideTokenAuthenticator(
        tokenDataStore: TokenDataStore,
        authApi: AuthApi,
    ): TokenAuthenticator = TokenAuthenticator(
        // Use cached token (non-blocking) for the refresh token provider
        refreshTokenProvider = { tokenDataStore.getCachedRefreshToken() },
        onTokenRefreshed = { access, refresh -> runBlocking { tokenDataStore.saveTokens(access, refresh) } },
        onRefreshFailed = { runBlocking { tokenDataStore.clearSession() } },
        authApiProvider = { authApi },
    )
}
