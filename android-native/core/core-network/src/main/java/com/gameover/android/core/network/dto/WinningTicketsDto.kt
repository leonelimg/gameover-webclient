package com.gameover.android.core.network.dto

data class WinningTicketsResponseDto(
    val draw: WinningTicketsDrawDto,
    val tickets: List<WinningTicketDto>,
    val paidTickets: List<WinningTicketDto>,
    val totals: WinningTicketsTotalsDto
)

data class WinningTicketsDrawDto(
    val id: String,
    val name: String,
    val winnerNumber: String?,
    val hasWinnerNumber: Boolean
)

data class WinningTicketDto(
    val ticketId: String,
    val code: String,
    val customerName: String,
    val seller: WinningTicketSellerDto,
    val createdAt: String,
    val paymentStatus: String,
    val paidAt: String?,
    val paidBy: WinningTicketUserDto?,
    val winningNumbers: List<String>,
    val prizeAmount: Double
)

data class WinningTicketSellerDto(
    val id: String,
    val fullName: String,
    val username: String,
    val plan: WinningTicketPlanDto?
)

data class WinningTicketPlanDto(
    val id: String,
    val name: String,
    val multiplier: Double,
    val commission: Double
)

data class WinningTicketUserDto(
    val id: String,
    val fullName: String,
    val username: String
)

data class WinningTicketsTotalsDto(
    val totalToPay: Double,
    val totalPaid: Double,
    val totalPending: Double,
    val winnersCount: Int,
    val paidCount: Int,
    val pendingCount: Int
)

data class MarkPaidRequestDto(
    val ticketId: String
)

data class MarkPaidResponseDto(
    val ticket: TicketDto,
    val prizeAmount: Double
)


