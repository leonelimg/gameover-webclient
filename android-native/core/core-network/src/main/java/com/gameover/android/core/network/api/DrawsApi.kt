package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.DrawDto
import com.gameover.android.core.network.dto.DrawSearchResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface DrawsApi {
    @GET("api/draws/search")
    suspend fun getDraws(
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 100,
    ): Response<DrawSearchResponseDto>
}
