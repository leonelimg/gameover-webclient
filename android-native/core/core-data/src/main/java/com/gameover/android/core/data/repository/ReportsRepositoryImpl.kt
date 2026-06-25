package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.DrawListEntry
import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber
import com.gameover.android.core.domain.model.BalanceBreakdownResponse
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.model.WinningTicketsReport
import com.gameover.android.core.domain.model.MarkPaidResult
import com.gameover.android.core.domain.repository.ReportsRepository
import com.gameover.android.core.network.api.ReportsApi
import com.gameover.android.core.network.api.TicketsApi
import com.gameover.android.core.network.dto.MarkPaidRequestDto
import com.gameover.android.core.network.mapper.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

class ReportsRepositoryImpl @Inject constructor(
    private val reportsApi: ReportsApi,
    private val ticketsApi: TicketsApi,
) : ReportsRepository {
    override suspend fun getSummary(fromDate: String?, toDate: String?, drawId: String?): ReportSummary = withContext(Dispatchers.IO) {
        val response = reportsApi.getSummary(fromDate, toDate, drawId)
        if (!response.isSuccessful) throw Exception("Error al cargar resumen: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Cuerpo del resumen vacío")
    }

    override suspend fun getTopNumbers(drawId: String, limit: Int): List<TopNumber> = withContext(Dispatchers.IO) {
        val response = reportsApi.getTopNumbers(drawId, limit)
        if (!response.isSuccessful) throw Exception("Error al cargar números top: ${response.code()}")
        response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getRecentTickets(limit: Int): List<Ticket> = withContext(Dispatchers.IO) {
        val response = ticketsApi.getTickets()
        if (!response.isSuccessful) throw Exception("Error al cargar tickets recientes: ${response.code()}")
        (response.body() ?: emptyList()).take(limit).map { it.toDomain() }
    }

    override suspend fun getDrawLists(drawId: String): List<DrawListEntry> = withContext(Dispatchers.IO) {
        val response = reportsApi.getDrawLists(drawId)
        if (!response.isSuccessful) throw Exception("Error al cargar lista de sorteo: ${response.code()}")
        response.body()?.toDomain() ?: emptyList()
    }

    override suspend fun getBalanceBreakdown(
        drawId: String?,
        userId: String?,
        fromDate: String?,
        toDate: String?
    ): BalanceBreakdownResponse = withContext(Dispatchers.IO) {
        val response = reportsApi.getBalanceBreakdown(drawId, userId, fromDate, toDate)
        if (!response.isSuccessful) throw Exception("Error al cargar desglose de balance: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Cuerpo de desglose vacío")
    }

    override suspend fun getUsers(): List<User> = withContext(Dispatchers.IO) {
        val response = reportsApi.getUsers()
        if (!response.isSuccessful) throw Exception("Error al cargar usuarios: ${response.code()}")
        response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getWinningTickets(drawId: String): WinningTicketsReport = withContext(Dispatchers.IO) {
        val response = reportsApi.getWinningTickets(drawId)
        if (!response.isSuccessful) throw Exception("Error al cargar tickets ganadores: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Cuerpo de tickets ganadores vacío")
    }

    override suspend fun markPaid(ticketId: String): MarkPaidResult = withContext(Dispatchers.IO) {
        val response = reportsApi.markPaid(MarkPaidRequestDto(ticketId = ticketId))
        if (!response.isSuccessful) throw Exception("Error al marcar como pagado: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Respuesta de pago vacía")
    }
}
