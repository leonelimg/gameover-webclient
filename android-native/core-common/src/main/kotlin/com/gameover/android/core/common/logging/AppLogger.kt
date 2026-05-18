package com.gameover.android.core.common.logging

interface Logger {
    fun d(tag: String, message: String)
    fun e(tag: String, message: String, throwable: Throwable? = null)
}

object AppLogger {
    private var logger: Logger = NoOpLogger

    fun init(logger: Logger) {
        this.logger = logger
    }

    fun d(tag: String, message: String) = logger.d(tag, message)
    fun e(tag: String, message: String, throwable: Throwable? = null) = logger.e(tag, message, throwable)
}

private object NoOpLogger : Logger {
    override fun d(tag: String, message: String) = Unit
    override fun e(tag: String, message: String, throwable: Throwable?) = Unit
}
