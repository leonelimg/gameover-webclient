package com.gameover.android.feature.sales.domain

object SalesInputRules {
    private val TWO_DIGIT_REGEX = Regex("^\\d{2}$")

    fun isTwoDigitNumber(number: String): Boolean = TWO_DIGIT_REGEX.matches(number.trim())
}
