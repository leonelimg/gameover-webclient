package com.gameover.android.core.network.dto

import com.google.gson.annotations.SerializedName

data class AppVersionDto(
    @SerializedName("versionCode") val versionCode: Int,
    @SerializedName("versionName") val versionName: String,
    @SerializedName("apkUrl") val apkUrl: String,
    @SerializedName("isMandatory") val isMandatory: Boolean,
    @SerializedName("releaseNotes") val releaseNotes: String?
)
