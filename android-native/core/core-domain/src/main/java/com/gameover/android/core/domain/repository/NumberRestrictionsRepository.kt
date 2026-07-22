package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.GlobalNumberRestriction

interface NumberRestrictionsRepository {
    suspend fun getGlobalNumbers(): List<GlobalNumberRestriction>
}
