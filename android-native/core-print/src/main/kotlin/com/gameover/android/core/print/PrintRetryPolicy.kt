package com.gameover.android.core.print

object PrintRetryPolicy {
    fun nextDelayMs(attempt: Int, baseMs: Long = 1_500L, maxMs: Long = 60_000L): Long {
        val step = baseMs * (1L shl (attempt - 1).coerceAtLeast(0))
        return step.coerceAtMost(maxMs)
    }
}
