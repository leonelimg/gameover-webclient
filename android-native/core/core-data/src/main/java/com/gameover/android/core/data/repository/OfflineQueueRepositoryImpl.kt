package com.gameover.android.core.data.repository

import com.gameover.android.core.data.local.db.PendingSaleDao
import com.gameover.android.core.data.local.db.PendingSaleEntity
import com.gameover.android.core.domain.repository.OfflineQueueRepository
import com.gameover.android.core.domain.repository.PendingSale
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class OfflineQueueRepositoryImpl @Inject constructor(
    private val dao: PendingSaleDao,
) : OfflineQueueRepository {
    override suspend fun enqueue(drawId: String, customerName: String, linesJson: String) {
        dao.insert(PendingSaleEntity(drawId = drawId, customerName = customerName, linesJson = linesJson))
    }

    override suspend fun getPending(): List<PendingSale> =
        dao.getPending().map { PendingSale(it.id, it.drawId, it.customerName, it.linesJson, it.createdAt, it.retryCount, it.lastError) }

    override suspend fun markSuccess(id: Long) = dao.delete(id)

    override suspend fun markFailed(id: Long, error: String, retryCount: Int) {
        if (retryCount >= 5) {
            dao.markFailed(id, error)
        } else {
            dao.updateRetry(id, retryCount, error)
        }
    }

    override fun getPendingCount(): Flow<Int> = dao.getPendingCount()
}
