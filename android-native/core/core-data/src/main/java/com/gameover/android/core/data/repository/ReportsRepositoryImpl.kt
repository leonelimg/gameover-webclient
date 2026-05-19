package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.ReportSummary
import com.gameover.android.core.domain.model.Ticket
import com.gameover.android.core.domain.model.TopNumber
import com.gameover.android.core.domain.repository.ReportsRepository
import com.gameover.android.core.network.api.ReportsApi
import com.gameover.android.core.network.api.TicketsApi
import com.gameover.android.core.network.mapper.toDomain
import javax.inject.Inject

class ReportsRepositoryImpl @Inject constructor(
    private val reportsApi: ReportsApi,
    private val ticketsApi: TicketsApi,
) : ReportsRepository {
    override suspend fun getSummary(fromDate: String?, toDate: String?, drawId: String?): ReportSummary {
        val response = reportsApi.getSummary(fromDate, toDate, drawId)
        if (!response.isSuccessful) throw Exception("Error al cargar resumen")
        return response.body()!!.toDomain()
    }

    override suspend fun getTopNumbers(drawId: String, limit: Int): List<TopNumber> {
        val response = reportsApi.getTopNumbers(drawId, limit)
        if (!response.isSuccessful) throw Exception("Error al cargar números top")
        return response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getRecentTickets(limit: Int): List<Ticket> {
        val response = ticketsApi.getTickets()
        if (!response.isSuccessful) throw Exception("Error al cargar tickets recientes")
        return (response.body() ?: emptyList()).take(limit).map { it.toDomain() }
    }
}
