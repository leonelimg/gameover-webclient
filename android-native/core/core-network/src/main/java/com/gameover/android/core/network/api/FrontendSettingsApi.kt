package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.FrontendTicketSettingsDto
import retrofit2.Response
import retrofit2.http.GET

interface FrontendSettingsApi {
    @GET("api/frontend-settings/ticket-appearance")
    suspend fun getTicketAppearance(): Response<FrontendTicketSettingsDto>
}