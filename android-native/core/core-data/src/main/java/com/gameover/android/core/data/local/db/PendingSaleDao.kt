package com.gameover.android.core.data.local.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingSaleDao {
    @Query("SELECT * FROM pending_sale WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getPending(): List<PendingSaleEntity>

    @Query("SELECT COUNT(*) FROM pending_sale WHERE status = 'pending'")
    fun getPendingCount(): Flow<Int>

    @Insert
    suspend fun insert(entity: PendingSaleEntity)

    @Query("DELETE FROM pending_sale WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE pending_sale SET retryCount = :retryCount, lastError = :error WHERE id = :id")
    suspend fun updateRetry(id: Long, retryCount: Int, error: String?)

    @Query("UPDATE pending_sale SET status = 'failed', lastError = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String?)
}
