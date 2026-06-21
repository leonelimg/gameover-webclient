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

data class DrawListEntryDto(
    val number: String,
    val totalAmount: Double
)

// Backend draw-lists response DTOs
data class DrawListNumberDto(
    val number: String,
    val total: Double
)

data class DrawListResponseDto(
    val filters: Map<String, Any?>,
    val totals: Map<String, Any?>,
    val numbers: List<DrawListNumberDto>
)
