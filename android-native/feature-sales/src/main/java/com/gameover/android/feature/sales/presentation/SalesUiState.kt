package com.gameover.android.feature.sales.presentation

import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.model.Ticket

sealed class SaleResult {
    object Idle : SaleResult()
    object Loading : SaleResult()
    data class Success(val ticket: Ticket) : SaleResult()
    data class Error(val message: String) : SaleResult()
    data class Offline(val message: String) : SaleResult()
}

data class SalesUiState(
    val draws: List<Draw> = emptyList(),
    val selectedDrawId: String = "",
    val customerName: String = "",
    val lines: List<SaleLine> = listOf(SaleLine()),
    val saleResult: SaleResult = SaleResult.Idle,
    val isLoadingDraws: Boolean = false,
    val pendingCount: Int = 0,
    val isOnline: Boolean = true,
    val lastTicket: Ticket? = null,
    val isPrintingTicket: Boolean = false,
    val printStatusMessage: String? = null,
    val drawTotalSales: Double = 0.0,
) {
    val selectedDraw: Draw? get() = draws.find { it.id == selectedDrawId }
    val hasSpecialMultiplier: Boolean get() = selectedDraw?.specialMultiplier != null
    val openDraws: List<Draw> get() = draws.filter { it.isOpen() }
    val total: Double get() = lines.sumOf { line ->
        val base = line.amount.toDoubleOrNull() ?: 0.0
        val special = if (hasSpecialMultiplier) (line.specialAmount.toDoubleOrNull() ?: 0.0) else 0.0
        base + special
    }
}
