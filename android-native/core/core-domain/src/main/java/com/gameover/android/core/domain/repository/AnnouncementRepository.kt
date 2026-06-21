package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.Announcement

interface AnnouncementRepository {
    suspend fun getActiveAnnouncements(): List<Announcement>
    suspend fun dismissAnnouncement(id: Int)
}
