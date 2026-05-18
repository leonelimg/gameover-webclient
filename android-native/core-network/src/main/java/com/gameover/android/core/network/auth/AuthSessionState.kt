package com.gameover.android.core.network.auth

import com.gameover.android.core.network.model.UserDto

data class AuthSessionState(
    val user: UserDto?,
    val accessToken: String?,
    val refreshToken: String?,
    val permissions: List<String>
) {
    val isAuthenticated: Boolean get() = user != null && !accessToken.isNullOrBlank()
}
