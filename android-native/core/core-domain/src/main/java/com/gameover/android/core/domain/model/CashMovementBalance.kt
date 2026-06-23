package com.gameover.android.core.domain.model

data class CashMovementBalanceTotals(
    val openingBalance: Double,
    val totalDeposits: Double,
    val totalWithdrawals: Double,
    val totalSales: Double,
    val totalPrizes: Double,
    val ticketCount: Int,
    val balance: Double
)

data class CashMovementBalance(
    val totals: CashMovementBalanceTotals
)
