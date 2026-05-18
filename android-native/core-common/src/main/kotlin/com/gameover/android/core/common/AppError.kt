package com.gameover.android.core.common

sealed interface AppError {
    data class Http(val code: Int, val message: String) : AppError
    data class Network(val message: String = "Sin conexión") : AppError
    data class Validation(val message: String) : AppError
    data class Permission(val message: String) : AppError
    data class Unknown(val message: String) : AppError
}
