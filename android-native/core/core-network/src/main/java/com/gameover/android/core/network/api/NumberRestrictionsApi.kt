package com.gameover.android.core.network.api

import retrofit2.http.GET
import retrofit2.http.Query

interface NumberRestrictionsApi {
    @GET("api/number-restrictions/global-numbers")
    suspend fun getGlobalNumbers(
        @Query("drawTypeId") drawTypeId: String? = null
    ): GlobalNumbersResponse
}

data class GlobalNumbersResponse(
    val items: List<GlobalNumberRestrictionDto>
)

data class GlobalNumberRestrictionDto(
    val id: String? = null,
    val number: String,
    val limit: Double
)
