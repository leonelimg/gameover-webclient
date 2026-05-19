package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.network.api.TicketsApi
import com.gameover.android.core.network.dto.CancelTicketRequest
import com.gameover.android.core.network.dto.CreateTicketRequest
import com.gameover.android.core.network.dto.TicketLineDto
import com.gameover.android.core.network.mapper.toDomain
import javax.inject.Inject

class TicketsRepositoryImpl @Inject constructor(
    private val ticketsApi: TicketsApi,
) : TicketsRepository {
    override suspend fun getTickets(drawId: String?, includeCanceled: Boolean): List<Ticket> {
        val response = ticketsApi.getTickets(drawId = drawId, includeCanceled = if (includeCanceled) true else null)
        if (!response.isSuccessful) throw Exception("Error al cargar tickets")
        return response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getTicket(id: String): Ticket {
        val response = ticketsApi.getTicket(id)
        if (!response.isSuccessful) throw Exception("Ticket no encontrado")
        return response.body()!!.toDomain()
    }

    override suspend fun createTicket(drawId: String, customerName: String, lines: List<CreateTicketLine>): Ticket {
        val request = CreateTicketRequest(
            drawId = drawId,
            customerName = customerName,
            lines = lines.map { TicketLineDto(it.number, it.amount, it.specialAmount, it.isNicaEspecial) },
        )
        val response = ticketsApi.createTicket(request)
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: ""
            val msg = try {
                com.google.gson.Gson().fromJson(errorBody, Map::class.java)["message"] as? String ?: "Error al registrar venta"
            } catch (_: Exception) { "Error al registrar venta" }
            throw Exception(msg)
        }
        return response.body()!!.toDomain()
    }

    override suspend fun markPrinted(id: String): Ticket {
        val response = ticketsApi.markPrinted(id)
        if (!response.isSuccessful) throw Exception("Error al marcar como impreso")
        return response.body()!!.toDomain()
    }

    override suspend fun cancelTicket(id: String, reason: String?): Ticket {
        val response = ticketsApi.cancelTicket(id, CancelTicketRequest(reason))
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: ""
            val msg = try {
                com.google.gson.Gson().fromJson(errorBody, Map::class.java)["message"] as? String ?: "Error al anular ticket"
            } catch (_: Exception) { "Error al anular ticket" }
            throw Exception(msg)
        }
        return response.body()!!.toDomain()
    }
}
