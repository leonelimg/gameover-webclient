package com.gameover.android.core.domain.model

data class AppUpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val isMandatory: Boolean,
    val releaseNotes: String?
)
