package com.gameover.android.core.domain.model

data class Plan(
    val id: String,
    val name: String,
    val multiplier: Double,
    val commission: Double,
    val masterId: String? = null,
    val createdAt: String,
)
