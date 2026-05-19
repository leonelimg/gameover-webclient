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
interface RecentTicketDao {
    @Query("SELECT * FROM recent_tickets ORDER BY createdAt DESC LIMIT :limit")
    suspend fun list(limit: Int = 10): List<RecentTicketEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(items: List<RecentTicketEntity>)

    @Query("DELETE FROM recent_tickets")
    suspend fun clear()
}

@Dao
interface SummaryCacheDao {
    @Query("SELECT * FROM summary_cache WHERE id = 1")
    suspend fun get(): SummaryCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SummaryCacheEntity)

    @Query("DELETE FROM summary_cache")
    suspend fun clear()
}

@Dao
interface PendingSalesDao {
    @Query("SELECT * FROM pending_sales ORDER BY createdAt ASC")
    suspend fun list(): List<PendingSaleEntity>

    @Query("SELECT * FROM pending_sales WHERE status = :status ORDER BY createdAt ASC")
    suspend fun listByStatus(status: String): List<PendingSaleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: PendingSaleEntity)

    @Query("DELETE FROM pending_sales WHERE id = :id")
    suspend fun remove(id: String)

    @Query("UPDATE pending_sales SET attempts = :attempts, status = :status, lastError = :lastError WHERE id = :id")
    suspend fun updateStatus(id: String, attempts: Int, status: String, lastError: String?)
}

@Dao
interface PrinterDeviceDao {
    @Query("SELECT * FROM printer_device ORDER BY COALESCE(lastConnectedAt, 0) DESC")
    suspend fun list(): List<PrinterDeviceEntity>

    @Query("SELECT * FROM printer_device WHERE macAddress = :macAddress LIMIT 1")
    suspend fun find(macAddress: String): PrinterDeviceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: PrinterDeviceEntity)
}

@Dao
interface PrintJobDao {
    @Query("SELECT * FROM print_jobs ORDER BY nextAttemptAt ASC")
    fun observeJobs(): Flow<List<PrintJobEntity>>

    @Query("SELECT * FROM print_jobs WHERE status IN (:statuses) ORDER BY nextAttemptAt ASC")
    suspend fun nextPending(statuses: List<String> = listOf("pending", "retrying")): List<PrintJobEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: PrintJobEntity)

    @Query("UPDATE print_jobs SET status = :status, attempts = :attempts, nextAttemptAt = :nextAttemptAt, lastError = :lastError WHERE id = :id")
    suspend fun updateStatus(
        id: String,
        status: String,
        attempts: Int,
        nextAttemptAt: Long,
        lastError: String?
    )

    @Query("DELETE FROM print_jobs WHERE id = :id")
    suspend fun delete(id: String)
}
