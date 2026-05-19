package com.gameover.android.core.domain.model

data class User(
    val id: String,
    val fullName: String,
    val username: String,
    val email: String,
    val phone: String,
    val role: UserRole,
    val status: UserStatus,
    val planId: String? = null,
    val parentId: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

enum class UserRole { admin, asociado, vendedor }
enum class UserStatus { activo, bloqueado, archivado }
