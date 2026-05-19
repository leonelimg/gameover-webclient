package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.DrawDto
import retrofit2.Response
import retrofit2.http.GET

interface DrawsApi {
    @GET("api/draws")
    suspend fun getDraws(): Response<List<DrawDto>>
}
