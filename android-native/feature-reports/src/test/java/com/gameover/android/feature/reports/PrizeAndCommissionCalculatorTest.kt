package com.gameover.android.feature.reports

import org.junit.Assert.assertEquals
import org.junit.Test

class PrizeAndCommissionCalculatorTest {
    @Test
    fun `calculates regular plus special winning formula and commission`() {
        val result = PrizeAndCommissionCalculator.calculate(
            FinancialInput(
                winnerNumber = "07",
                lines = listOf(
                    TicketLine(number = "07", amount = 10.0, specialAmount = 5.0),
                    TicketLine(number = "11", amount = 8.0, specialAmount = null)
                ),
                ticketTotal = 18.0,
                regularMultiplier = 5.0,
                specialMultiplier = 3.0,
                commissionPercent = 10.0
            )
        )

        assertEquals(225.0, result.prize, 0.0)
        assertEquals(1.8, result.commission, 0.0)
    }
}
