package com.gameover.android.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.gameover.android.core.database.dao.*
import com.gameover.android.core.database.entity.*

@Database(
    entities = [
        SessionEntity::class,
        DrawCacheEntity::class,
        RecentTicketEntity::class,
        SummaryCacheEntity::class,
        PendingSaleEntity::class,
        PrinterDeviceEntity::class,
        PrintJobEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class GameOverDatabase : RoomDatabase() {
    abstract fun sessionDao(): SessionDao
    abstract fun drawCacheDao(): DrawCacheDao
    abstract fun recentTicketDao(): RecentTicketDao
    abstract fun summaryCacheDao(): SummaryCacheDao
    abstract fun pendingSalesDao(): PendingSalesDao
    abstract fun printerDeviceDao(): PrinterDeviceDao
    abstract fun printJobDao(): PrintJobDao

    companion object {
        @Volatile private var instance: GameOverDatabase? = null

        fun getInstance(context: Context): GameOverDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    GameOverDatabase::class.java,
                    "gameover_android.db"
                ).build().also { instance = it }
            }
        }
    }
}
