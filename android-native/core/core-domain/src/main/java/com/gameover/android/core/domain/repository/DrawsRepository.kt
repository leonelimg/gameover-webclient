package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.Draw

interface DrawsRepository {
    suspend fun getDraws(fromDate: String? = null, toDate: String? = null): List<Draw>
}
