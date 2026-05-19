package com.gameover.android.core.domain.repository

import kotlinx.coroutines.flow.Flow

interface OfflineQueueRepository {
    suspend fun enqueue(drawId: String, customerName: String, linesJson: String)
    suspend fun getPending(): List<PendingSale>
    suspend fun markSuccess(id: Long)
    suspend fun markFailed(id: Long, error: String, retryCount: Int)
    fun getPendingCount(): Flow<Int>
}

data class PendingSale(
    val id: Long,
    val drawId: String,
    val customerName: String,
    val linesJson: String,
    val createdAt: Long,
    val retryCount: Int,
    val lastError: String?,
)
