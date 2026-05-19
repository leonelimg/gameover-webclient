package com.gameover.android.core.network.model

data class LoginRequest(val username: String, val password: String)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto
)

data class RefreshRequest(val refreshToken: String)

data class RefreshResponse(val accessToken: String, val refreshToken: String)

data class UserDto(
    val id: String,
    val fullName: String,
    val username: String,
    val role: String,
    val status: String,
    val planId: String?,
    val parentId: String?
)

data class PermissionsResponse(val permissions: List<String>)

data class ApiErrorResponse(val message: String? = null, val error: String? = null)
