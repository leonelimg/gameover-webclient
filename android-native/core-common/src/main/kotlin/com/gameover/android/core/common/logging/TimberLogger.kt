package com.gameover.android.core.common.logging

import timber.log.Timber

class TimberLogger : Logger {
    init {
        if (Timber.forest().isEmpty()) {
            Timber.plant(Timber.DebugTree())
        }
    }

    override fun d(tag: String, message: String) {
        Timber.tag(tag).d(message)
    }

    override fun e(tag: String, message: String, throwable: Throwable?) {
        Timber.tag(tag).e(throwable, message)
    }
}
