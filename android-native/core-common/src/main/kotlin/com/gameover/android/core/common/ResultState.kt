package com.gameover.android.core.common

sealed interface ResultState<out T> {
    data class Success<T>(val data: T) : ResultState<T>
    data class Error(val error: AppError) : ResultState<Nothing>
    data object Loading : ResultState<Nothing>
}
