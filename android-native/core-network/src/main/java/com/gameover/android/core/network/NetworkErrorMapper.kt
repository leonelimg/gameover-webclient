package com.gameover.android.core.network

import com.gameover.android.core.common.AppError
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import org.json.JSONObject
import retrofit2.HttpException

object NetworkErrorMapper {
    fun toAppError(throwable: Throwable, fallback: String): AppError {
        return when (throwable) {
            is HttpException -> {
                val message = runCatching {
                    val raw = throwable.response()?.errorBody()?.string().orEmpty()
                    if (raw.isBlank()) fallback else {
                        val obj = JSONObject(raw)
                        obj.optString("message").ifBlank {
                            obj.optString("error").ifBlank { fallback }
                        }
                    }
                }.getOrDefault(fallback)
                AppError.Http(throwable.code(), message)
            }

            is SocketTimeoutException, is UnknownHostException, is IOException ->
                AppError.Network(fallback)

            is IllegalArgumentException ->
                AppError.Validation(throwable.message ?: fallback)

            else -> AppError.Unknown(throwable.message ?: fallback)
        }
    }
}
