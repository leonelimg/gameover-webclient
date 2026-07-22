package com.gameover.android.core.network.api

import retrofit2.http.GET

interface NumberRestrictionsApi {
    @GET("api/number-restrictions/global-numbers")
    suspend fun getGlobalNumbers(): GlobalNumbersResponse
}

data class GlobalNumbersResponse(
    val items: List<GlobalNumberRestrictionDto>
)

data class GlobalNumberRestrictionDto(
    val id: String? = null,
    val number: String,
    val limit: Double
)
