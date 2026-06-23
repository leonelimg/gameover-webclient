package com.gameover.android.core.data.di

import android.content.Context
import androidx.room.Room
import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.data.local.db.AppDatabase
import com.gameover.android.core.data.local.db.PendingSaleDao
import com.gameover.android.core.data.repository.*
import com.gameover.android.core.domain.repository.*
import com.gameover.android.core.network.interceptor.AuthInterceptor
import com.google.gson.Gson
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataModule {

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "gameover_db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun providePendingSaleDao(db: AppDatabase): PendingSaleDao = db.pendingSaleDao()

    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenDataStore: TokenDataStore): AuthInterceptor =
        AuthInterceptor { tokenDataStore.getCachedAccessToken() }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class DataBindsModule {

    @Binds
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    abstract fun bindDrawsRepository(impl: DrawsRepositoryImpl): DrawsRepository

    @Binds
    abstract fun bindTicketsRepository(impl: TicketsRepositoryImpl): TicketsRepository

    @Binds
    abstract fun bindReportsRepository(impl: ReportsRepositoryImpl): ReportsRepository

    @Binds
    abstract fun bindAnnouncementRepository(impl: AnnouncementRepositoryImpl): AnnouncementRepository

    @Binds
    abstract fun bindOfflineQueueRepository(impl: OfflineQueueRepositoryImpl): OfflineQueueRepository

    @Binds
    abstract fun bindDataRefreshNotifier(impl: DataRefreshNotifierImpl): DataRefreshNotifier

    @Binds
    abstract fun bindFrontendSettingsRepository(impl: FrontendSettingsRepositoryImpl): FrontendSettingsRepository

    @Binds
    abstract fun bindCashMovementsRepository(impl: CashMovementsRepositoryImpl): CashMovementsRepository
}
