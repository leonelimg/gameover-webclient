package com.gameover.android.feature.dashboard.presentation

import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber
import com.gameover.android.core.domain.model.DashboardRange

data class DashboardUiState(
    val isLoading: Boolean = false,
    val summary: ReportSummary? = null,
    val recentTickets: List<Ticket> = emptyList(),
    val topNumbers: List<TopNumber> = emptyList(),
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val customFromDate: String = "",
    val customToDate: String = "",
    val error: String? = null,
    val isOnline: Boolean = true,
    val announcementCount: Int = 0,
)
