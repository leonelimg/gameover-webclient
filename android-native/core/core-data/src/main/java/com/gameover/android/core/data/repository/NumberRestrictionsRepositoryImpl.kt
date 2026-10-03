package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.GlobalNumberRestriction
import com.gameover.android.core.domain.repository.NumberRestrictionsRepository
import com.gameover.android.core.network.api.NumberRestrictionsApi
import javax.inject.Inject

class NumberRestrictionsRepositoryImpl @Inject constructor(
    private val api: NumberRestrictionsApi
) : NumberRestrictionsRepository {
    override suspend fun getGlobalNumbers(drawTypeId: String?): List<GlobalNumberRestriction> {
        return api.getGlobalNumbers(drawTypeId).items.map {
            GlobalNumberRestriction(
                id = it.id ?: "",
                number = it.number,
                limit = it.limit
            )
        }
    }
}
