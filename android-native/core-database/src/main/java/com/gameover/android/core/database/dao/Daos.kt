package com.gameover.android.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.gameover.android.core.database.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {
    @Query("SELECT * FROM session WHERE id = 1")
    suspend fun getSession(): SessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SessionEntity)

    @Query("DELETE FROM session")
    suspend fun clear()
}

@Dao
interface DrawCacheDao {
    @Query("SELECT * FROM draw_cache ORDER BY closeTime DESC")
    fun observeAll(): Flow<List<DrawCacheEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(items: List<DrawCacheEntity>)

    @Query("DELETE FROM draw_cache")
    suspend fun clear()
}

@Dao
interface PendingSalesDao {
    @Query("SELECT * FROM pending_sales ORDER BY createdAt ASC")
    suspend fun list(): List<PendingSaleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: PendingSaleEntity)

    @Query("DELETE FROM pending_sales WHERE id = :id")
    suspend fun remove(id: String)

    @Query("UPDATE pending_sales SET attempts = :attempts, status = :status, lastError = :lastError WHERE id = :id")
    suspend fun updateStatus(id: String, attempts: Int, status: String, lastError: String?)
}

@Dao
interface PrintJobDao {
    @Query("SELECT * FROM print_jobs ORDER BY nextAttemptAt ASC")
    fun observeJobs(): Flow<List<PrintJobEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: PrintJobEntity)

    @Query("DELETE FROM print_jobs WHERE id = :id")
    suspend fun delete(id: String)
}
