package com.gameover.android.core.domain.util

object CurrencyFormatter {
    fun format(amount: Double): String {
        return "C$ %,.2f".format(amount)
    }
}
