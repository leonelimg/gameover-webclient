package com.gameover.android.core.domain.model

data class Draw(
    val id: String,
    val name: String,
    val closeTime: String, // ISO-8601
    val minutosPreviosCierre: Int,
    val winnerNumber: String? = null,
    val status: DrawStatus,
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
