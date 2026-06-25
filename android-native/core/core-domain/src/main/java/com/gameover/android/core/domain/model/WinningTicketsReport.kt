package com.gameover.android.core.domain.model

data class WinningTicketsReport(
    val draw: WinningTicketsDraw,
    val tickets: List<WinningTicket>,
    val paidTickets: List<WinningTicket>,
    val totals: WinningTicketsTotals
)

data class WinningTicketsDraw(
    val id: String,
    val name: String,
    val winnerNumber: String?,
    val hasWinnerNumber: Boolean
)

data class WinningTicket(
    val ticketId: String,
    val code: String,
    val customerName: String,
    val seller: WinningTicketSeller,
    val createdAt: String,
    val paymentStatus: String,
    val paidAt: String?,
    val paidBy: WinningTicketUser?,
    val winningNumbers: List<String>,
    val prizeAmount: Double
)

data class WinningTicketSeller(
    val id: String,
    val fullName: String,
    val username: String,
    val plan: WinningTicketPlan?
)

data class WinningTicketPlan(
    val id: String,
    val name: String,
    val multiplier: Double,
    val commission: Double
)

data class WinningTicketUser(
    val id: String,
    val fullName: String,
    val username: String
)

data class WinningTicketsTotals(
    val totalToPay: Double,
    val totalPaid: Double,
    val totalPending: Double,
    val winnersCount: Int,
    val paidCount: Int,
    val pendingCount: Int
)

data class MarkPaidResult(
    val ticket: Ticket,
    val prizeAmount: Double
)

