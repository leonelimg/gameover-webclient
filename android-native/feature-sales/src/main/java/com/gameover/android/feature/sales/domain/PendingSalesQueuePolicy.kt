package com.gameover.android.feature.sales.domain

object PendingSalesQueuePolicy {
    fun shouldQueueOffline(error: Throwable): Boolean {
        val message = error.message?.lowercase().orEmpty()
        return "timeout" in message || "network" in message || "conex" in message
    }
}
