package com.gameover.android.core.domain.repository

import com.gameover.android.core.domain.model.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    suspend fun login(username: String, password: String): LoginResult
    suspend fun logout()
    suspend fun refreshToken(): Boolean
    fun getStoredUser(): Flow<User?>
    fun getAccessToken(): Flow<String?>
}

data class LoginResult(val user: User, val accessToken: String, val refreshToken: String)
