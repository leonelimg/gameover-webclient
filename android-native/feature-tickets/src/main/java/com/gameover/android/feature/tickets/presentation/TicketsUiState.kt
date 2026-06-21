package com.gameover.android.feature.tickets.presentation

import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.DashboardRange

data class TicketsUiState(
    val tickets: List<Ticket> = emptyList(),
    val draws: List<Draw> = emptyList(),
    val searchQuery: String = "",
    val selectedDrawId: String = "",
    val includeCanceled: Boolean = false,
    val selectedRange: DashboardRange = DashboardRange.TODAY,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isOnline: Boolean = true,
) {
    val filteredTickets: List<Ticket> get() {
        var result = tickets

        // Client-side filtering for canceled tickets
        if (!includeCanceled) {
            result = result.filter { it.canceledAt == null }
        }

        // Filter by search query (date filtering is now server-side)
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().uppercase()
            result = result.filter { it.code.uppercase().contains(q) || it.customerName.uppercase().contains(q) }
        }
        return result
    }
}

data class TicketDetailUiState(
    val ticket: Ticket? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val cancelDialog: Boolean = false,
    val cancelReason: String = "",
    val isCanceling: Boolean = false,
    val isMarkingPrinted: Boolean = false,
    val operationSuccess: String? = null,
    val canCancel: Boolean = false,
)
