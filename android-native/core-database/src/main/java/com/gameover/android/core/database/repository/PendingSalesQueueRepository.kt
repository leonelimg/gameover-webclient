package com.gameover.android.core.database.repository

import com.gameover.android.core.database.dao.PendingSalesDao
import com.gameover.android.core.database.entity.PendingSaleEntity
import java.util.UUID

class PendingSalesQueueRepository(private val dao: PendingSalesDao) {
    suspend fun enqueue(payloadJson: String) {
        dao.enqueue(
            PendingSaleEntity(
                id = UUID.randomUUID().toString(),
                payloadJson = payloadJson,
                createdAt = System.currentTimeMillis(),
                attempts = 0,
                status = "pending",
                lastError = null
            )
        )
    }

    suspend fun allPending(): List<PendingSaleEntity> = dao.list()

    suspend fun markFailed(id: String, attempts: Int, error: String?) {
        dao.updateStatus(id, attempts, "failed", error)
    }

    suspend fun markSynced(id: String) {
        dao.remove(id)
    }
}
