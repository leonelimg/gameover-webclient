package com.gameover.android.core.domain.model

data class DrawType(
    val id: String,
    val name: String,
    val description: String? = null,
    val digits: Int = 2,
    val multiplier: Double = 80.0,
    val maxDrawSales: Double? = null,
    val globalNumberLimit: Double? = null,
    val restrictedNumbers: List<RestrictedNumber> = emptyList(),
)

data class Draw(
    val id: String,
    val drawTypeId: String? = null,
    val name: String,
    val closeTime: String, // ISO-8601
    val minutosPreviosCierre: Int,
    val winnerNumber: String? = null,
    val status: DrawStatus,
    val drawType: DrawType? = null,
    val restrictedNumbers: List<RestrictedNumber> = emptyList(),
    val specialMultiplier: SpecialMultiplier? = null,
    val createdAt: String,
) {
    fun isOpen(): Boolean {
        return try {
            val closeMs = java.time.Instant.parse(closeTime).toEpochMilli()
            val cutoff = closeMs - minutosPreviosCierre * 60_000L
            val now = System.currentTimeMillis()
            status != DrawStatus.finalizado && now < cutoff
        } catch (e: Exception) { false }
    }
}

enum class DrawStatus { pendiente, abierto, cerrado, finalizado }
data class RestrictedNumber(val number: String, val limit: Double)
