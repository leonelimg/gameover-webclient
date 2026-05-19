package com.gameover.android.core.network.dto

data class ReportSummaryDto(
    val totalSales: Double,
    val ticketCount: Int,
    val drawCount: Int,
    val userCount: Int,
    val totalPrizes: Double,
    val totalCommissions: Double,
)

data class TopNumberDto(val number: String, val totalAmount: Double, val ticketCount: Int)
