package com.gameover.android.core.domain.model

data class ReportSummary(
    val totalSales: Double,
    val ticketCount: Int,
    val drawCount: Int,
    val userCount: Int,
    val totalPrizes: Double,
    val totalCommissions: Double,
)

data class TopNumber(val number: String, val totalAmount: Double, val ticketCount: Int)
