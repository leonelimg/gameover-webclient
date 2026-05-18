package com.gameover.android.feature.tickets

object TicketRules {
    fun canReprint(canceledAt: String?): Boolean = canceledAt == null
    fun cancelReason(reason: String?): String? = reason?.trim()?.takeIf { it.isNotEmpty() }
}
