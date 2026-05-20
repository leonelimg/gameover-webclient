package com.gameover.android.core.domain.repository

import kotlinx.coroutines.flow.Flow

interface DataRefreshNotifier {
    val refreshEvents: Flow<Unit>
    suspend fun notifyDataChanged()
}

