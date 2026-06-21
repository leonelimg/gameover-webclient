package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.DrawListEntry
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber

interface ReportsRepository {
    suspend fun getSummary(fromDate: String? = null, toDate: String? = null, drawId: String? = null): ReportSummary
    suspend fun getTopNumbers(drawId: String, limit: Int = 10): List<TopNumber>
    suspend fun getRecentTickets(limit: Int = 5): List<Ticket>
    suspend fun getDrawLists(drawId: String): List<DrawListEntry>
}
