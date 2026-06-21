package com.gameover.android.core.network.api

import com.gameover.android.core.network.dto.AnnouncementDto
import retrofit2.Response
import retrofit2.http.*

interface AnnouncementsApi {
    @GET("api/announcements/active")
    suspend fun getActiveAnnouncements(): Response<List<AnnouncementDto>>

    @POST("api/announcements/{id}/dismiss")
    suspend fun dismissAnnouncement(@Path("id") id: Int): Response<Unit>
}
