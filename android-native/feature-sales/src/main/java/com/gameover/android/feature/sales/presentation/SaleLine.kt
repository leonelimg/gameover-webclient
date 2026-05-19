package com.gameover.android.feature.sales.presentation

import java.util.UUID

data class SaleLine(
    val id: String = UUID.randomUUID().toString(),
    val number: String = "",
    val amount: String = "",
    val specialAmount: String = "",
)
