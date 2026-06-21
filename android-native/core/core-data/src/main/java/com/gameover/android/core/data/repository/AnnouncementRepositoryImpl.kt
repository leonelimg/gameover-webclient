package com.gameover.android.core.data.repository

import com.gameover.android.core.domain.model.Announcement
import com.gameover.android.core.domain.repository.AnnouncementRepository
import com.gameover.android.core.network.api.AnnouncementsApi
import com.gameover.android.core.network.dto.toDomain
import javax.inject.Inject
import javax.inject.Named

class AnnouncementRepositoryImpl @Inject constructor(
    private val announcementsApi: AnnouncementsApi,
    @param:Named("baseUrl") private val baseUrl: String,
) : AnnouncementRepository {

    override suspend fun getActiveAnnouncements(): List<Announcement> {
        val response = announcementsApi.getActiveAnnouncements()
        if (response.isSuccessful) {
            return response.body()?.map {
                val domain = it.toDomain()
                domain.copy(image = toAbsoluteImageUrl(domain.image))
            } ?: emptyList()
        } else {
            throw Exception("Error al obtener anuncios: ${response.code()}")
        }
    }

    override suspend fun dismissAnnouncement(id: String) {
        val response = announcementsApi.dismissAnnouncement(id)
        if (!response.isSuccessful) {
            throw Exception("Error al descartar anuncio: ${response.code()}")
        }
    }

    private fun toAbsoluteImageUrl(imageUrl: String?): String? {
        if (imageUrl.isNullOrBlank()) return null
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl
        return if (imageUrl.startsWith("/")) "$baseUrl${imageUrl.removePrefix("/")}" else "$baseUrl$imageUrl"
    }
}
