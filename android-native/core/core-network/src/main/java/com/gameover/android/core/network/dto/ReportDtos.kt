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

data class BalanceBreakdownTotalsDto(
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double
)

data class AssociateDrawBreakdownRowDto(
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

data class AssociateBreakdownRowDto(
    val associateId: String,
    val associateName: String,
    val parentId: String?,
    val ticketCount: Int,
    val totalSales: Double,
    val totalPrizes: Double,
    val totalCommissions: Double,
    val balance: Double,
    val draws: List<AssociateDrawBreakdownRowDto>
)

data class BalanceBreakdownSectionDto(
    val totals: BalanceBreakdownTotalsDto,
    val rows: List<AssociateBreakdownRowDto>
)

data class BalanceBreakdownResponseDto(
    val byAssociate: BalanceBreakdownSectionDto
)

