package com.gameover.android.core.network.dto

data class DrawDto(
    val id: String,
    val name: String,
    val closeTime: String,
    val minutosPreviosCierre: Int,
    val winnerNumber: String? = null,
    val status: String,
    val restrictedNumbers: List<RestrictedNumberDto> = emptyList(),
    val specialMultiplier: SpecialMultiplierDto? = null,
    val createdAt: String,
)

data class RestrictedNumberDto(val number: String, val limit: Double)

data class SpecialMultiplierDto(val id: String, val name: String, val value: Int)
