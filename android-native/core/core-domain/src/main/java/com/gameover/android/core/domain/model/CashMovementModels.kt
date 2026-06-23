package com.gameover.android.core.domain.model

data class CashMovementTarget(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String,
    val status: String,
    val canOperate: Boolean
)

data class CashMovementActor(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String
)

data class CashMovementHistoryItem(
    val id: String,
    val targetUserId: String,
    val createdById: String,
    val type: String, // "deposito" | "retiro" | "venta"
    val amount: Double,
    val note: String?,
    val createdAt: String,
    val canceledAt: String?,
    val canceledById: String?,
    val createdBy: CashMovementActor,
    val targetUser: CashMovementActor,
    val source: String, // "cash-movement" | "ticket-sale"
    val referenceCode: String?,
    val balanceAfterTransaction: Double?
)

data class CashMovementEventSummaryTotals(
    val openingBalance: Double,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double
)

data class CashMovementEventSummaryRow(
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

data class CashMovementEventSummaryResponse(
    val targetUser: CashMovementActor,
    val totals: CashMovementEventSummaryTotals,
    val rows: List<CashMovementEventSummaryRow>
)
