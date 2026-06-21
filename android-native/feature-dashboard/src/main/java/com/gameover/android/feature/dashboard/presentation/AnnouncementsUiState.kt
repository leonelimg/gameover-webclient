package com.gameover.android.feature.dashboard.presentation

import com.gameover.android.core.domain.model.Announcement

data class AnnouncementsUiState(
    val isLoading: Boolean = false,
    val announcements: List<Announcement> = emptyList(),
    val error: String? = null,
)
