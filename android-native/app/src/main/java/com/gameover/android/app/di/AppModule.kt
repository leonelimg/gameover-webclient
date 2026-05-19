package com.gameover.android.app.di

import android.content.Context
import com.gameover.android.core.database.GameOverDatabase
import com.gameover.android.core.database.dao.PendingSalesDao
import com.gameover.android.core.database.dao.PrintJobDao
import com.gameover.android.core.database.dao.PrinterDeviceDao
import com.gameover.android.core.database.dao.RecentTicketDao
import com.gameover.android.core.database.dao.SessionDao
import com.gameover.android.core.database.dao.SummaryCacheDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

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
