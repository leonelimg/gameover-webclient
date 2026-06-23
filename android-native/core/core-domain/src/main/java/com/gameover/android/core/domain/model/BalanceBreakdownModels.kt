package com.gameover.android.core.domain.model

data class BalanceBreakdownTotals(
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double
)

data class AssociateDrawBreakdownRow(
    val drawId: String,
    val drawName: String,
    val drawCloseTime: String?,
    val lastTicketCreatedAt: String?,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double
)

data class AssociateBreakdownRow(
    val associateId: String,
    val associateName: String,
    val parentId: String?,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double,
    val draws: List<AssociateDrawBreakdownRow>
)

data class BalanceBreakdownResponse(
    val totals: BalanceBreakdownTotals,
    val rows: List<AssociateBreakdownRow>
)
