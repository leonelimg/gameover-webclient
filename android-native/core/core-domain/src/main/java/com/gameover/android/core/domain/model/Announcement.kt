package com.gameover.android.core.domain.model

data class Announcement(
    val id: Int,
    val name: String,
    val message: String?,
    val image: String?,
    val dismissable: Boolean,
)
