package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber
import com.gameover.android.core.domain.repository.ReportsRepository
import com.gameover.android.core.network.api.ReportsApi
import com.gameover.android.core.network.api.TicketsApi
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
}
