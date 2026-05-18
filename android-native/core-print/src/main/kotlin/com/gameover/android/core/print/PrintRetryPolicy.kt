package com.gameover.android.core.print

object PrintRetryPolicy {
    fun nextDelayMs(attempt: Int, baseMs: Long = 1_500L, maxMs: Long = 60_000L): Long {
        // Exponential backoff: baseMs * 2^(attempt-1), capped by maxMs.
        val step = baseMs * (1L shl (attempt - 1).coerceAtLeast(0))
        return step.coerceAtMost(maxMs)
    }
}
