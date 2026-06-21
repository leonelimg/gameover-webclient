package com.gameover.android.core.domain.model

data class Announcement(
    val id: String,
    val name: String,
    val message: String?,
    val image: String?,
    val dismissable: Boolean,
)
