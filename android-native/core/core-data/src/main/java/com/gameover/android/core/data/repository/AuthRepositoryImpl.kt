package com.gameover.android.core.data.repository

import com.gameover.android.core.data.local.TokenDataStore
import com.gameover.android.core.domain.model.User
import com.gameover.android.core.domain.repository.AuthRepository
import com.gameover.android.core.domain.repository.LoginResult
import com.gameover.android.core.network.api.AuthApi
import com.gameover.android.core.network.dto.LoginRequest
import com.gameover.android.core.network.mapper.toDomain
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject

class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenDataStore: TokenDataStore,
    private val gson: Gson,
) : AuthRepository {

    override suspend fun login(username: String, password: String): LoginResult = withContext(Dispatchers.IO) {
        val response = authApi.login(LoginRequest(username, password))
        if (!response.isSuccessful) {
            val error = response.errorBody()?.string() ?: "Error de autenticación"
            throw Exception(parseErrorMessage(error))
        }
        val body = response.body()!!
        val user = body.user.toDomain()
        tokenDataStore.saveTokens(body.accessToken, body.refreshToken)
        tokenDataStore.saveUser(gson.toJson(user))
        LoginResult(user, body.accessToken, body.refreshToken)
    }

    override suspend fun logout() = withContext(Dispatchers.IO) {
        try { authApi.logout() } catch (_: Exception) {}
        tokenDataStore.clearSession()
    }

    override suspend fun refreshToken(): Boolean = withContext(Dispatchers.IO) {
        val refreshToken = tokenDataStore.getRefreshTokenOnce() ?: return@withContext false
        try {
            val response = authApi.refresh(com.gameover.android.core.network.dto.RefreshRequest(refreshToken))
            if (response.isSuccessful) {
                val body = response.body()!!
                tokenDataStore.saveTokens(body.accessToken, body.refreshToken)
                true
            } else false
        } catch (_: Exception) { false }
    }

    override fun getStoredUser(): Flow<User?> = tokenDataStore.userJson.map { json ->
        json?.let { runCatching { gson.fromJson(it, User::class.java) }.getOrNull() }
    }

    override fun getAccessToken(): Flow<String?> = tokenDataStore.accessToken

    private fun parseErrorMessage(errorBody: String): String {
        return try {
            val map = gson.fromJson(errorBody, Map::class.java)
            map["message"] as? String ?: errorBody
        } catch (_: Exception) { errorBody }
    }
}
