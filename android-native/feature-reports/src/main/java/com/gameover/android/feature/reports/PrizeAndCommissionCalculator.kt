package com.gameover.android.feature.reports

import kotlin.math.round

data class TicketLine(val number: String, val amount: Double, val specialAmount: Double?)

data class FinancialInput(
    val winnerNumber: String?,
    val lines: List<TicketLine>,
    val ticketTotal: Double,
    val regularMultiplier: Double,
    val specialMultiplier: Double?,
    val commissionPercent: Double
)

data class FinancialOutput(
    val prize: Double,
    val commission: Double
)

object PrizeAndCommissionCalculator {
    fun calculate(input: FinancialInput): FinancialOutput {
        val normalizedWinner = normalizeNumber(input.winnerNumber)
        val prize = if (normalizedWinner.isNullOrBlank()) {
            0.0
        } else {
            input.lines.sumOf { line ->
                val lineNumber = normalizeNumber(line.number)
                if (lineNumber != normalizedWinner) return@sumOf 0.0

                val special = line.specialAmount ?: 0.0
                if (input.specialMultiplier != null && special > 0) {
                    (line.amount + special) * input.regularMultiplier * input.specialMultiplier
                } else {
                    line.amount * input.regularMultiplier
                }
            }
        }

        val commission = input.ticketTotal * (input.commissionPercent / 100.0)
        return FinancialOutput(round2(prize), round2(commission))
    }

    private fun round2(value: Double): Double = round(value * 100.0) / 100.0

    private fun normalizeNumber(value: String?): String {
        return value.orEmpty().trim().trimStart('0')
    }
}
