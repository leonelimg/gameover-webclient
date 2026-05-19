package com.gameover.android.core.domain.model

data class TicketLine(
    val number: String,
    val amount: Double,
    val specialAmount: Double? = null,
    val isNicaEspecial: Boolean = false,
)

enum class PaymentStatus { pendiente, pagado }

data class Ticket(
    val id: String,
    val code: String,
    val drawId: String,
    val sellerId: String,
    val associateId: String,
    val customerName: String,
    val lines: List<TicketLine>,
    val total: Double,
    val createdAt: String,
    val printedAt: String? = null,
    val paymentStatus: PaymentStatus = PaymentStatus.pendiente,
    val paidAt: String? = null,
    val canceledAt: String? = null,
    val canceledById: String? = null,
    val cancelReason: String? = null,
    val draw: DrawSummary? = null,
    val seller: UserSummary? = null,
)

data class DrawSummary(val id: String, val name: String, val specialMultiplier: SpecialMultiplierSummary? = null)
data class SpecialMultiplierSummary(val id: String, val name: String, val value: Int)
data class UserSummary(val id: String, val fullName: String, val username: String)
