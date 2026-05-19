package com.gameover.android.core.network.model

data class ReportSummaryDto(
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val userCount: Int,
    val drawCount: Int
)

data class TopNumberDto(val number: String, val total: Double)

data class RecentTicketDto(
    val id: String,
    val code: String,
    val drawId: String,
    val total: Double,
    val createdAt: String,
    val canceledAt: String? = null
)

data class WinningTicketsResponseDto(
    val draw: DrawWinnerDto,
    val tickets: List<WinningTicketDto>,
    val paidTickets: List<WinningTicketDto>,
    val totals: WinningTotalsDto
)

data class DrawWinnerDto(
    val id: String,
    val name: String,
    val winnerNumber: String?,
    val hasWinnerNumber: Boolean
)

data class WinningTicketDto(
    val ticketId: String,
    val code: String,
    val customerName: String,
    val prizeAmount: Double,
    val paymentStatus: String,
    val winningNumbers: List<String> = emptyList()
)

data class WinningTotalsDto(
    val totalToPay: Double,
    val totalPaid: Double,
    val totalPending: Double,
    val winnersCount: Int,
    val paidCount: Int,
    val pendingCount: Int
)
