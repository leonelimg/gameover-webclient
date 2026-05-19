package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.PrintJobDao
import com.gameover.android.core.database.entity.PrintJobEntity
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow

class PrintQueueRepository @Inject constructor(
    private val dao: PrintJobDao
) {
    fun observeJobs(): Flow<List<PrintJobEntity>> = dao.observeJobs()

    suspend fun enqueue(ticketJson: String, maxAttempts: Int = 5): String {
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        dao.upsert(
            PrintJobEntity(
                id = id,
                ticketJson = ticketJson,
                status = STATUS_PENDING,
                attempts = 0,
                maxAttempts = maxAttempts,
                nextAttemptAt = now,
                lastError = null
            )
        )
        return id
    }

    suspend fun nextPending(): List<PrintJobEntity> = dao.nextPending(listOf(STATUS_PENDING, STATUS_RETRYING))

    suspend fun markProcessing(id: String, attempts: Int) {
        dao.updateStatus(id, STATUS_PROCESSING, attempts, System.currentTimeMillis(), null)
    }

    suspend fun markCompleted(id: String) {
        dao.updateStatus(id, STATUS_COMPLETED, 0, System.currentTimeMillis(), null)
    }

    suspend fun markRetrying(id: String, attempts: Int, nextAttemptAt: Long, error: String?) {
        dao.updateStatus(id, STATUS_RETRYING, attempts, nextAttemptAt, error)
    }

    suspend fun markFailed(id: String, attempts: Int, error: String?) {
        dao.updateStatus(id, STATUS_FAILED, attempts, System.currentTimeMillis(), error)
    }

    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_PROCESSING = "processing"
        const val STATUS_RETRYING = "retrying"
        const val STATUS_COMPLETED = "completed"
        const val STATUS_FAILED = "failed"
    }
}
