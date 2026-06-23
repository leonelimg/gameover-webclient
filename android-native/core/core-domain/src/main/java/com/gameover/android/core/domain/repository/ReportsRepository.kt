package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.DrawListEntry
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber
import com.gameover.android.core.domain.model.BalanceBreakdownResponse
import com.gameover.android.core.domain.model.User

interface ReportsRepository {
    suspend fun getSummary(fromDate: String? = null, toDate: String? = null, drawId: String? = null): ReportSummary
    suspend fun getTopNumbers(drawId: String, limit: Int = 10): List<TopNumber>
    suspend fun getRecentTickets(limit: Int = 5): List<Ticket>
    suspend fun getDrawLists(drawId: String): List<DrawListEntry>

    suspend fun getBalanceBreakdown(
        drawId: String? = null,
        userId: String? = null,
        fromDate: String? = null,
        toDate: String? = null
    ): BalanceBreakdownResponse

    suspend fun getUsers(): List<User>
}

