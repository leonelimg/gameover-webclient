package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Announcement
import com.gameover.android.core.domain.repository.AnnouncementRepository
import com.gameover.android.core.network.api.AnnouncementsApi
import com.gameover.android.core.network.dto.toDomain
import javax.inject.Inject

class AnnouncementRepositoryImpl @Inject constructor(
    private val announcementsApi: AnnouncementsApi
) : AnnouncementRepository {

    override suspend fun getActiveAnnouncements(): List<Announcement> {
        val response = announcementsApi.getActiveAnnouncements()
        if (response.isSuccessful) {
            return response.body()?.map { it.toDomain() } ?: emptyList()
        } else {
            throw Exception("Error al obtener anuncios: ${response.code()}")
        }
    }

    override suspend fun dismissAnnouncement(id: Int) {
        val response = announcementsApi.dismissAnnouncement(id)
        if (!response.isSuccessful) {
            throw Exception("Error al descartar anuncio: ${response.code()}")
        }
    }
}
