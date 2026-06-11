package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.FrontendTicketSettings
import com.gameover.android.core.domain.repository.FrontendSettingsRepository
import com.gameover.android.core.network.api.FrontendSettingsApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

class FrontendSettingsRepositoryImpl @Inject constructor(
    private val frontendSettingsApi: FrontendSettingsApi,
) : FrontendSettingsRepository {

    override suspend fun getTicketAppearance(): FrontendTicketSettings = withContext(Dispatchers.IO) {
        val response = frontendSettingsApi.getTicketAppearance()
        if (!response.isSuccessful) {
            throw Exception("No se pudo cargar configuración de ticket: ${response.code()}")
        }

        val body = response.body() ?: throw Exception("Respuesta vacía de configuración de ticket")
        FrontendTicketSettings(
            ticketTitle = body.ticketTitle,
            footerNote = body.footerNote,
            ticketCodeFontSize = body.ticketCodeFontSize,
        )
    }
}