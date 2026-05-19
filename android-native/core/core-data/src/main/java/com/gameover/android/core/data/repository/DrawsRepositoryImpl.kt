package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Draw
import com.gameover.android.core.domain.repository.DrawsRepository
import com.gameover.android.core.network.api.DrawsApi
import com.gameover.android.core.network.mapper.toDomain
import javax.inject.Inject

class DrawsRepositoryImpl @Inject constructor(
    private val drawsApi: DrawsApi,
) : DrawsRepository {
    override suspend fun getDraws(): List<Draw> {
        val response = drawsApi.getDraws()
        if (!response.isSuccessful) throw Exception("Error al cargar sorteos")
        return response.body()?.map { it.toDomain() } ?: emptyList()
    }
}
