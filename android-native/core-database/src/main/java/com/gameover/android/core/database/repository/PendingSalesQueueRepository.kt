package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.PendingSalesDao
import com.gameover.android.core.database.entity.PendingSaleEntity
import javax.inject.Inject
import java.util.UUID

class PendingSalesQueueRepository @Inject constructor(private val dao: PendingSalesDao) {
    suspend fun enqueue(payloadJson: String) {
        dao.enqueue(
            PendingSaleEntity(
                id = UUID.randomUUID().toString(),
                payloadJson = payloadJson,
                createdAt = System.currentTimeMillis(),
                attempts = 0,
                status = STATUS_PENDING,
                lastError = null
            )
        )
    }

    suspend fun allPending(): List<PendingSaleEntity> = dao.list()
    suspend fun pendingOnly(): List<PendingSaleEntity> = dao.listByStatus(STATUS_PENDING)
    suspend fun failedOnly(): List<PendingSaleEntity> = dao.listByStatus(STATUS_FAILED)
    suspend fun syncedOnly(): List<PendingSaleEntity> = dao.listByStatus(STATUS_SYNCED)

    suspend fun markFailed(id: String, attempts: Int, error: String?) {
        dao.updateStatus(id, attempts, STATUS_FAILED, error)
    }

    suspend fun markSynced(id: String) {
        dao.updateStatus(id, 0, STATUS_SYNCED, null)
    }

    suspend fun resetToPending(id: String) {
        dao.updateStatus(id, 0, STATUS_PENDING, null)
    }

    companion object {
        const val STATUS_PENDING = "pending"
        const val STATUS_FAILED = "failed"
        const val STATUS_SYNCED = "synced"
    }
}
