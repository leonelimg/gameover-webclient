package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.FrontendTicketSettings

interface FrontendSettingsRepository {
    suspend fun getTicketAppearance(): FrontendTicketSettings
}