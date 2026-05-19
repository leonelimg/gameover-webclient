package com.gameover.android.app.di

import android.content.Context
import com.gameover.android.app.BuildConfig
import com.gameover.android.core.database.GameOverDatabase
import com.gameover.android.core.database.dao.PendingSalesDao
import com.gameover.android.core.database.dao.PrintJobDao
import com.gameover.android.core.database.dao.PrinterDeviceDao
import com.gameover.android.core.database.dao.RecentTicketDao
import com.gameover.android.core.database.dao.SessionDao
import com.gameover.android.core.database.dao.SummaryCacheDao
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
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideSecureTokenStorage(@ApplicationContext context: Context): SecureTokenStorage =
        SecureTokenStorage(context)

    @Provides
    @Singleton
    fun provideAuthApi(): AuthApi {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideAuthSessionManager(
        authApi: AuthApi,
        tokenStorage: SecureTokenStorage
    ): AuthSessionManager = AuthSessionManager(authApi, tokenStorage)

    @Provides
    @Singleton
    fun provideBusinessApi(
        sessionManager: AuthSessionManager,
        tokenStorage: SecureTokenStorage
    ): BusinessApi {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(sessionManager))
            .authenticator(TokenAuthenticator(sessionManager, tokenStorage))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
            .create(BusinessApi::class.java)
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): GameOverDatabase =
        GameOverDatabase.getInstance(context)

    @Provides fun provideSessionDao(db: GameOverDatabase): SessionDao = db.sessionDao()
    @Provides fun provideSummaryCacheDao(db: GameOverDatabase): SummaryCacheDao = db.summaryCacheDao()
    @Provides fun provideRecentTicketDao(db: GameOverDatabase): RecentTicketDao = db.recentTicketDao()
    @Provides fun providePendingSalesDao(db: GameOverDatabase): PendingSalesDao = db.pendingSalesDao()
    @Provides fun providePrinterDeviceDao(db: GameOverDatabase): PrinterDeviceDao = db.printerDeviceDao()
    @Provides fun providePrintJobDao(db: GameOverDatabase): PrintJobDao = db.printJobDao()
}
