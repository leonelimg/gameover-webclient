package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.CashMovementBalance
import com.gameover.android.core.domain.model.CashMovementTarget
import com.gameover.android.core.domain.model.CashMovementHistoryItem
import com.gameover.android.core.domain.model.CashMovementEventSummaryResponse

interface CashMovementsRepository {
    suspend fun getBalance(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?
    ): CashMovementBalance

    suspend fun getTargets(): List<CashMovementTarget>

    suspend fun getHistory(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?,
        limit: Int?
    ): List<CashMovementHistoryItem>

    suspend fun getSummaryByEvent(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?
    ): CashMovementEventSummaryResponse
}

