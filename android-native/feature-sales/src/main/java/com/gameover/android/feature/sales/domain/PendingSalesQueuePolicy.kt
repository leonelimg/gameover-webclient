package com.gameover.android.feature.sales.domain

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object PendingSalesQueuePolicy {
    fun shouldQueueOffline(error: Throwable): Boolean {
        return error is SocketTimeoutException ||
            error is UnknownHostException ||
            error is IOException
    }
}
