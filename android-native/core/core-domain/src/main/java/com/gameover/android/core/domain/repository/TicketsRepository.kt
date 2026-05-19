package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.Ticket

interface TicketsRepository {
    suspend fun getTickets(drawId: String? = null, includeCanceled: Boolean = false): List<Ticket>
    suspend fun getTicket(id: String): Ticket
    suspend fun createTicket(drawId: String, customerName: String, lines: List<CreateTicketLine>): Ticket
    suspend fun markPrinted(id: String): Ticket
    suspend fun cancelTicket(id: String, reason: String?): Ticket
}

data class CreateTicketLine(
    val number: String,
    val amount: Double,
    val specialAmount: Double? = null,
    val isNicaEspecial: Boolean = false,
)
