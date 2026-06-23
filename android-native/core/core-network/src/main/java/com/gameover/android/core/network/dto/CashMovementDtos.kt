package com.gameover.android.core.network.dto

data class CashMovementBalanceTotalsDto(
    val openingBalance: Double,
    val totalDeposits: Double,
    val totalWithdrawals: Double,
    val totalSales: Double,
    val totalPrizes: Double,
    val ticketCount: Int,
    val balance: Double
)

data class CashMovementBalanceResponseDto(
    val totals: CashMovementBalanceTotalsDto
)

data class CashMovementTargetDto(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String,
    val status: String,
    val canOperate: Boolean
)

data class CashMovementActorDto(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String
)

data class CashMovementHistoryItemDto(
    val id: String,
    val targetUserId: String,
    val createdById: String,
    val type: String, // "deposito" | "retiro" | "venta"
    val amount: Double,
    val note: String?,
    val createdAt: String,
    val canceledAt: String?,
    val canceledById: String?,
    val createdBy: CashMovementActorDto,
    val targetUser: CashMovementActorDto,
    val source: String, // "cash-movement" | "ticket-sale"
    val referenceCode: String?,
    val balanceAfterTransaction: Double?
)

data class CashMovementEventSummaryTotalsDto(
    val openingBalance: Double,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double
)

data class CashMovementEventSummaryRowDto(
    val eventId: String,
    val eventName: String,
    val eventDate: String,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double,
    val balanceAfterTransaction: Double
)

data class CashMovementEventSummaryResponseDto(
    val targetUser: CashMovementActorDto,
    val totals: CashMovementEventSummaryTotalsDto,
    val rows: List<CashMovementEventSummaryRowDto>
)

