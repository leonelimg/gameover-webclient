package com.gameover.android.feature.sales.domain

import org.junit.Test

class SalesValidationTest {
    private val validator = SalesValidation()

    @Test(expected = IllegalArgumentException::class)
    fun `fails when special amount exceeds regular`() {
        validator.validate(
            draw = DrawRules(
                closeTimeIso = "2099-01-01T23:59:59Z",
                minutosPreviosCierre = 10,
                status = "abierto",
                hasSpecialMultiplier = true,
                restrictedNumbers = emptyList()
            ),
            lines = listOf(SaleLineInput(number = "12", amount = 10.0, specialAmount = 15.0))
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `fails when restricted number exceeds limit`() {
        validator.validate(
            draw = DrawRules(
                closeTimeIso = "2099-01-01T23:59:59Z",
                minutosPreviosCierre = 10,
                status = "abierto",
                hasSpecialMultiplier = false,
                restrictedNumbers = listOf(RestrictedNumberRule(number = "45", limit = 20.0, sold = 19.0))
            ),
            lines = listOf(SaleLineInput(number = "45", amount = 2.0, specialAmount = 0.0))
        )
    }
}
