package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.CashMovementBalance
import com.gameover.android.core.domain.model.CashMovementTarget
import com.gameover.android.core.domain.model.CashMovementHistoryItem
import com.gameover.android.core.domain.model.CashMovementEventSummaryResponse
import com.gameover.android.core.domain.repository.CashMovementsRepository
import com.gameover.android.core.network.api.CashMovementsApi
import com.gameover.android.core.network.mapper.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

class CashMovementsRepositoryImpl @Inject constructor(
    private val cashMovementsApi: CashMovementsApi
) : CashMovementsRepository {
    override suspend fun getBalance(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?
    ): CashMovementBalance = withContext(Dispatchers.IO) {
        val response = cashMovementsApi.getBalance(targetUserId, fromDate, toDate)
        if (!response.isSuccessful) throw Exception("Error al cargar balance: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Cuerpo del balance vacío")
    }

    override suspend fun getTargets(): List<CashMovementTarget> = withContext(Dispatchers.IO) {
        val response = cashMovementsApi.getTargets()
        if (!response.isSuccessful) throw Exception("Error al cargar usuarios destino: ${response.code()}")
        response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getHistory(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?,
        limit: Int?
    ): List<CashMovementHistoryItem> = withContext(Dispatchers.IO) {
        val response = cashMovementsApi.getHistory(targetUserId, fromDate, toDate, limit)
        if (!response.isSuccessful) throw Exception("Error al cargar historial: ${response.code()}")
        response.body()?.map { it.toDomain() } ?: emptyList()
    }

    override suspend fun getSummaryByEvent(
        targetUserId: String?,
        fromDate: String?,
        toDate: String?
    ): CashMovementEventSummaryResponse = withContext(Dispatchers.IO) {
        val response = cashMovementsApi.getSummaryByEvent(targetUserId, fromDate, toDate)
        if (!response.isSuccessful) throw Exception("Error al cargar resumen por evento: ${response.code()}")
        response.body()?.toDomain() ?: throw Exception("Cuerpo de resumen vacío")
    }
}

