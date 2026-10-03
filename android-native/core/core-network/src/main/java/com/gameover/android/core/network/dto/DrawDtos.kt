package com.gameover.android.core.network.dto

data class DrawTypeDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val digits: Int? = 2,
    val multiplier: Double? = 80.0,
    val maxDrawSales: Double? = null,
    val globalNumberLimit: Double? = null,
    val restrictedNumbers: List<RestrictedNumberDto>? = null,
)

data class DrawDto(
    val id: String,
    val drawTypeId: String? = null,
    val name: String,
    val closeTime: String,
    val minutosPreviosCierre: Int,
    val winnerNumber: String? = null,
    val status: String,
    val drawType: DrawTypeDto? = null,
    val restrictedNumbers: List<RestrictedNumberDto>? = null,
    val specialMultiplier: SpecialMultiplierDto? = null,
    val createdAt: String? = null,
)

data class RestrictedNumberDto(val number: String, val limit: Double)

data class SpecialMultiplierDto(val id: String, val name: String, val value: Int)

// Response DTO for /draws/search endpoint with pagination
data class DrawSearchResponseDto(
    val items: List<DrawDto>,
    val total: Int,
    val page: Int,
    val pageSize: Int,
    val totalPages: Int,
)
