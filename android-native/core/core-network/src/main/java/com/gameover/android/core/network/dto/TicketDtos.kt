package com.gameover.android.core.network.dto

data class TicketLineDto(
    val number: String,
    val amount: Double,
    val specialAmount: Double? = null,
    val isNicaEspecial: Boolean = false,
)

data class TicketDto(
    val id: String,
    val code: String,
    val drawId: String,
    val sellerId: String,
    val associateId: String,
    val customerName: String,
    val lines: List<TicketLineDto>,
    val total: Double,
    val createdAt: String,
    val printedAt: String? = null,
    val paymentStatus: String = "pendiente",
    val paidAt: String? = null,
    val canceledAt: String? = null,
    val canceledById: String? = null,
    val cancelReason: String? = null,
    val draw: DrawSummaryDto? = null,
    val seller: UserSummaryDto? = null,
    val associate: UserSummaryDto? = null,
)

data class DrawSummaryDto(
    val id: String,
    val name: String,
    val specialMultiplier: SpecialMultiplierDto? = null,
)

data class UserSummaryDto(val id: String, val fullName: String, val username: String)

data class CreateTicketRequest(
    val drawId: String,
    val customerName: String,
    val lines: List<TicketLineDto>,
)

data class CancelTicketRequest(val reason: String? = null)
