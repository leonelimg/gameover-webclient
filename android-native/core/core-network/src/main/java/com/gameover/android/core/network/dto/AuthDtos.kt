package com.gameover.android.core.network.dto

import com.google.gson.annotations.SerializedName

data class LoginRequest(val username: String, val password: String)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto,
)

data class RefreshRequest(val refreshToken: String)

data class RefreshResponse(val accessToken: String, val refreshToken: String)

data class UserDto(
    val id: String,
    val fullName: String,
    val username: String,
    val email: String,
    val phone: String,
    val role: String,
    val status: String,
    val planId: String? = null,
    val parentId: String? = null,
    val createdAt: String,
    val updatedAt: String,
)
