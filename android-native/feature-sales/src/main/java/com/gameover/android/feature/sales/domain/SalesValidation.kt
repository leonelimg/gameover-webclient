package com.gameover.android.feature.sales.domain

import java.time.Instant

data class SaleLineInput(
    val number: String,
    val amount: Double,
    val specialAmount: Double
)

data class RestrictedNumberRule(val number: String, val limit: Double, val sold: Double)

data class DrawRules(
    val closeTimeIso: String,
    val minutosPreviosCierre: Int,
    val status: String,
    val hasSpecialMultiplier: Boolean,
    val restrictedNumbers: List<RestrictedNumberRule>
)

class SalesValidation {
    fun validate(draw: DrawRules, lines: List<SaleLineInput>, nowMs: Long = System.currentTimeMillis()) {
        if (draw.status == "finalizado") {
            throw IllegalArgumentException("No se puede vender en un sorteo finalizado.")
        }

        val closeTime = Instant.parse(draw.closeTimeIso).toEpochMilli()
        val cutoff = closeTime - draw.minutosPreviosCierre * 60_000L
        if (nowMs >= cutoff || nowMs > closeTime) {
            throw IllegalArgumentException("El sorteo no está en horario de venta.")
        }

        lines.forEach { line ->
            require(Regex("^\\d{2}$").matches(line.number)) { "Todos los números deben tener exactamente 2 dígitos." }
            require(line.amount > 0) { "Monto inválido para número ${line.number}." }
            if (draw.hasSpecialMultiplier) {
                require(line.specialAmount >= 0) { "El monto especial no puede ser negativo." }
                require(line.specialAmount <= line.amount) {
                    "El monto especial del número ${line.number} no puede superar el monto regular."
                }
            }

            val restricted = draw.restrictedNumbers.firstOrNull { it.number == line.number }
            if (restricted != null && restricted.sold + line.amount > restricted.limit) {
                throw IllegalArgumentException("Número ${line.number} alcanzó su límite.")
            }
        }
    }
}
