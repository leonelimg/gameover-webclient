package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.repository.CreateTicketLine
import com.gameover.android.core.domain.repository.DataRefreshNotifier
import com.gameover.android.core.domain.repository.TicketsRepository
import com.gameover.android.core.network.api.TicketsApi
import com.gameover.android.core.network.dto.CancelTicketRequest
import com.gameover.android.core.network.dto.CreateTicketLineRequestDto
import com.gameover.android.core.network.dto.CreateTicketRequest
import com.gameover.android.core.network.mapper.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

class TicketsRepositoryImpl @Inject constructor(
    private val ticketsApi: TicketsApi,
    private val dataRefreshNotifier: DataRefreshNotifier,
) : TicketsRepository {
    override suspend fun getTickets(drawId: String?, includeCanceled: Boolean): List<Ticket> = withContext(Dispatchers.IO) {
        val response = ticketsApi.getTickets(drawId = drawId, includeCanceled = if (includeCanceled) true else null)
        if (!response.isSuccessful) throw Exception("Error al cargar tickets: ${response.code()}")
        response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getTicket(id: String): Ticket = withContext(Dispatchers.IO) {
        val response = ticketsApi.getTicket(id)
        if (!response.isSuccessful) throw Exception("Ticket no encontrado: ${response.code()}")
        val createdTicket = response.body()!!.toDomain()
        dataRefreshNotifier.notifyDataChanged()
        createdTicket
    }

    override suspend fun createTicket(drawId: String, customerName: String, lines: List<CreateTicketLine>): Ticket = withContext(Dispatchers.IO) {
        val request = CreateTicketRequest(
            drawId = drawId,
            customerName = customerName,
            lines = lines.map {
                CreateTicketLineRequestDto(
                    number = it.number,
                    amount = it.amount,
                    specialAmount = it.specialAmount ?: 0.0,
                    isNicaEspecial = it.isNicaEspecial,
                )
            },
        )
        val response = ticketsApi.createTicket(request)
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: ""
            val msg = try {
                com.google.gson.Gson().fromJson(errorBody, Map::class.java)["message"] as? String ?: "Error al registrar venta"
            } catch (_: Exception) { "Error al registrar venta" }
            throw Exception(msg)
        }
        val updatedTicket = response.body()!!.toDomain()
        dataRefreshNotifier.notifyDataChanged()
        updatedTicket
    }

    override suspend fun markPrinted(id: String): Ticket = withContext(Dispatchers.IO) {
        val response = ticketsApi.markPrinted(id)
        if (!response.isSuccessful) throw Exception("Error al marcar como impreso: ${response.code()}")
        response.body()!!.toDomain()
    }

    override suspend fun cancelTicket(id: String, reason: String?): Ticket = withContext(Dispatchers.IO) {
        val response = ticketsApi.cancelTicket(id, CancelTicketRequest(reason))
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: ""
            val msg = try {
                com.google.gson.Gson().fromJson(errorBody, Map::class.java)["message"] as? String ?: "Error al anular ticket"
            } catch (_: Exception) { "Error al anular ticket" }
            throw Exception(msg)
        }
        val updatedTicket = response.body()!!.toDomain()
        dataRefreshNotifier.notifyDataChanged()
        updatedTicket
    }
}
