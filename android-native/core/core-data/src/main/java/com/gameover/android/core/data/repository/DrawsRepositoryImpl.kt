package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.network.api.DrawsApi
import com.gameover.android.core.network.mapper.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

class DrawsRepositoryImpl @Inject constructor(
    private val drawsApi: DrawsApi,
) : DrawsRepository {
    override suspend fun getDraws(fromDate: String?, toDate: String?): List<Draw> = withContext(Dispatchers.IO) {
        val response = drawsApi.getDraws(fromDate = fromDate, toDate = toDate, page = 1, pageSize = 100)
        if (!response.isSuccessful) throw Exception("Error al cargar sorteos: ${response.code()}")
        response.body()?.items?.map { it.toDomain() } ?: emptyList()
    }
}
