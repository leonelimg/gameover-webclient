package com.gameover.android.core.network.dto

import com.gameover.android.core.domain.model.Announcement

data class AnnouncementDto(
    val id: Int,
    val name: String,
    val message: String?,
    val image: String?,
    val startDate: String?,
    val endDate: String?,
)

fun AnnouncementDto.toDomain() = Announcement(
    id = id,
    name = name,
    message = message,
    image = image,
    dismissable = true // Assuming all are dismissable from mobile for now as per API doc
)
