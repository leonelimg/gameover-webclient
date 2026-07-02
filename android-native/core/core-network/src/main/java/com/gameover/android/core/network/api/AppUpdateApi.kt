package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.AppVersionDto
import retrofit2.Response
import retrofit2.http.GET

interface AppUpdateApi {
    @GET("public/app/version.json")
    suspend fun getLatestVersion(): Response<AppVersionDto>
}
