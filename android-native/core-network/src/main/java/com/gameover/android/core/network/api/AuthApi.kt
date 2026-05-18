package com.gameover.android.core.network.api

import com.gameover.android.core.network.model.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("/api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("/api/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): RefreshResponse

    @POST("/api/auth/logout")
    suspend fun logout()

    @GET("/api/auth/me")
    suspend fun me(): UserDto

    @GET("/api/roles/my-permissions")
    suspend fun myPermissions(): PermissionsResponse
}
