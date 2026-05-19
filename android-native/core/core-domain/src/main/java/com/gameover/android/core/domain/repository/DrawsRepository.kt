package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.Draw

interface DrawsRepository {
    suspend fun getDraws(): List<Draw>
}
